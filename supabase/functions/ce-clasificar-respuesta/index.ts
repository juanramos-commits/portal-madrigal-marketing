import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Valid classification values. */
const VALID_CLASIFICACIONES = [
  "interesado",
  "no_ahora",
  "baja",
  "negativo",
  "irrelevante",
] as const;

type Clasificacion = (typeof VALID_CLASIFICACIONES)[number];

/** Map classification to enrollment estado. */
const CLASIFICACION_A_ESTADO: Record<Clasificacion, string> = {
  interesado: "interesado",
  baja: "baja",
  negativo: "negativo",
  no_ahora: "no_ahora",
  irrelevante: "activo", // irrelevant replies don't change enrollment flow
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { respuesta_id } = await req.json();
    if (!respuesta_id) {
      return jsonResponse({ error: "respuesta_id es obligatorio" }, 400);
    }

    // ── 1. Load respuesta with related data ──────────────────────────
    const { data: respuesta, error: respErr } = await supabase
      .from("ce_respuestas")
      .select(
        `
        id, cuerpo, envio_id, enrollment_id, contacto_id,
        ce_envios!inner (
          id, paso_id,
          ce_pasos!inner ( asunto_a, cuerpo_a )
        ),
        ce_enrollments!inner ( id, secuencia_id ),
        ce_contactos!inner ( id, nombre, empresa, cargo, email, telefono )
      `,
      )
      .eq("id", respuesta_id)
      .single();

    if (respErr || !respuesta) {
      return jsonResponse(
        { error: "Respuesta no encontrada", detail: respErr?.message },
        404,
      );
    }

    const envio = respuesta.ce_envios as any;
    const paso = envio.ce_pasos as any;
    const contacto = respuesta.ce_contactos as any;
    const replyCuerpo = respuesta.cuerpo ?? "";

    // ── 2-3. Build prompt and call OpenAI ────────────────────────────
    const systemPrompt = `You are an email classification assistant. Classify the following reply to a cold email into exactly one of these categories:
- interesado: the person shows interest, wants more info, or agrees to a meeting
- no_ahora: the person is not interested right now but leaves the door open for the future
- baja: the person explicitly asks to be removed from the list or to stop receiving emails
- negativo: the person responds negatively, rudely, or threatens action
- irrelevante: the reply is an auto-reply, out-of-office, delivery notification, or otherwise not a real human response

Reply with valid JSON only: {"clasificacion": "<category>", "confianza": <0.0-1.0>, "razon": "<brief reason in Spanish>"}`;

    const userPrompt = `ORIGINAL EMAIL SENT:
Subject: ${paso.asunto_a}
Body:
${paso.cuerpo_a}

RECIPIENT INFO:
Name: ${contacto.nombre ?? "N/A"}
Company: ${contacto.empresa ?? "N/A"}
Role: ${contacto.cargo ?? "N/A"}
Email: ${contacto.email}

THEIR REPLY:
${replyCuerpo}`;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return jsonResponse({ error: "ANTHROPIC_API_KEY no configurada" }, 500);
    }

    const aiResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt },
          ],
        }),
      },
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return jsonResponse(
        { error: "Anthropic API error", detail: errText },
        502,
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.content?.[0]?.text ?? "";

    // ── 4. Parse AI response ─────────────────────────────────────────
    let parsed: { clasificacion: string; confianza: number; razon: string };
    try {
      // Strip potential markdown code fences.
      const cleanJson = rawContent
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      return jsonResponse(
        {
          error: "No se pudo parsear la respuesta de IA",
          raw: rawContent,
        },
        500,
      );
    }

    const clasificacion = VALID_CLASIFICACIONES.includes(
      parsed.clasificacion as Clasificacion,
    )
      ? (parsed.clasificacion as Clasificacion)
      : "irrelevante";

    // ── 5. Update ce_respuestas ──────────────────────────────────────
    const { error: updRespErr } = await supabase
      .from("ce_respuestas")
      .update({
        clasificacion,
        clasificacion_ia_raw: parsed,
      })
      .eq("id", respuesta_id);

    if (updRespErr) {
      return jsonResponse(
        { error: "Error actualizando respuesta", detail: updRespErr.message },
        500,
      );
    }

    // ── 6. Update enrollment estado ──────────────────────────────────
    const nuevoEstado = CLASIFICACION_A_ESTADO[clasificacion];
    const enrollmentUpdate: Record<string, unknown> = {
      estado: nuevoEstado,
    };

    // For "no_ahora", set a follow-up 14 days from now.
    if (clasificacion === "no_ahora") {
      const followup = new Date();
      followup.setDate(followup.getDate() + 14);
      enrollmentUpdate.followup_at = followup.toISOString();
    }

    await supabase
      .from("ce_enrollments")
      .update(enrollmentUpdate)
      .eq("id", respuesta.enrollment_id);

    // ── 7. If interested → create CRM lead ───────────────────────────
    let crmLeadId: string | null = null;

    if (clasificacion === "interesado") {
      // Create lead in ventas_leads.
      const { data: lead, error: leadErr } = await supabase
        .from("ventas_leads")
        .insert({
          nombre: contacto.nombre ?? contacto.email,
          nombre_negocio: contacto.empresa ?? null,
          email: contacto.email,
          telefono: contacto.telefono,
          fuente: "cold_email",
        })
        .select("id")
        .single();

      if (leadErr) {
        console.error("Error creating lead:", leadErr.message);
      } else if (lead) {
        crmLeadId = lead.id;

        // Find the first active pipeline stage.
        const { data: etapa } = await supabase
          .from("ventas_etapas")
          .select("id")
          .eq(
            "pipeline_id",
            supabase
              .from("ventas_pipelines")
              .select("id")
              .order("created_at", { ascending: true })
              .limit(1),
          )
          .order("orden", { ascending: true })
          .limit(1)
          .single();

        // Fallback: query pipeline first, then etapa.
        let etapaId = etapa?.id;
        if (!etapaId) {
          const { data: pipeline } = await supabase
            .from("ventas_pipelines")
            .select("id")
            .order("created_at", { ascending: true })
            .limit(1)
            .single();

          if (pipeline) {
            const { data: etapaFallback } = await supabase
              .from("ventas_etapas")
              .select("id")
              .eq("pipeline_id", pipeline.id)
              .order("orden", { ascending: true })
              .limit(1)
              .single();
            etapaId = etapaFallback?.id;
          }
        }

        if (etapaId) {
          await supabase.from("ventas_lead_pipeline").insert({
            lead_id: crmLeadId,
            etapa_id: etapaId,
          });
        }

        // Link lead back to respuesta and contacto.
        await Promise.all([
          supabase
            .from("ce_respuestas")
            .update({ crm_lead_id: crmLeadId })
            .eq("id", respuesta_id),
          supabase
            .from("ce_contactos")
            .update({ crm_lead_id: crmLeadId })
            .eq("id", contacto.id),
        ]);
      }
    }

    // ── 8. Return result ─────────────────────────────────────────────
    return jsonResponse({
      clasificacion,
      confianza: parsed.confianza,
      razon: parsed.razon,
      crm_lead_id: crmLeadId,
    });
  } catch (err) {
    console.error("ce-clasificar-respuesta error:", err);
    return jsonResponse(
      { error: "Error interno", detail: String(err) },
      500,
    );
  }
});
