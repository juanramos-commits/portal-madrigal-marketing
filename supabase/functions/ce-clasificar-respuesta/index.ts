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
  "interesado_email",
  "no_ahora",
  "baja",
  "negativo",
  "irrelevante",
] as const;

type Clasificacion = (typeof VALID_CLASIFICACIONES)[number];

/** Map classification to enrollment estado. */
const CLASIFICACION_A_ESTADO: Record<Clasificacion, string> = {
  interesado: "interesado",
  interesado_email: "interesado",
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

    // ── 2-3. Build prompt and call Anthropic ──────────────────────────
    const systemPrompt = `Eres un asistente de clasificación de respuestas a emails de prospección comercial para una agencia de marketing de bodas (Madrigal Marketing). Clasifica cada respuesta en UNA categoría y decide si requiere respuesta por email.

CATEGORÍAS (elige exactamente UNA):
- interesado: Acepta contacto por WhatsApp o responde positivamente sin hacer preguntas que requieran respuesta por email. Incluye:
  • Dice "sí", "vale", "perfecto", "escríbeme", "cuéntame"
  • Da su teléfono o pide contacto por WhatsApp
  • Responde brevemente aceptando ("Ok", "Sin problema", "Genial")
- interesado_email: Muestra interés PERO hace preguntas concretas o pide que le respondan por email. Incluye:
  • Hace preguntas sobre precios, cómo funciona, garantías, referencias
  • Pregunta sobre compatibilidad con su situación ("solo trabajo como X, ¿sirve?")
  • Pide explícitamente que le respondan por correo ("respóndeme por aquí")
  • Cualquier respuesta que necesite una contestación personalizada por email
- no_ahora: SOLO si dice explícitamente "ahora no" o "quizás más adelante". NO uses esta categoría para preguntas o dudas.
- baja: Pide explícitamente ser eliminado de la lista o que no le escriban más.
- negativo: Responde con un "No" seco, de forma brusca, o amenaza.
- irrelevante: Respuestas automáticas (autoresponder, out-of-office, acuse de recibo automático). Señales: asunto empieza con "Auto:", texto genérico sin contexto personal, firma institucional sin contenido real.

REGLAS IMPORTANTES:
- Si DUDA entre interesado e interesado_email, elige interesado_email. Es mejor reenviar de más que perder una pregunta.
- Una pregunta SIEMPRE es interés (interesado o interesado_email), NUNCA es "no_ahora".
- "No gracias" sin más = negativo. "No me interesa ahora" = no_ahora.
- Los autoresponders son SIEMPRE irrelevante, aunque digan "nos pondremos en contacto".
- Si alguien dice "cuéntame por aquí" (por email) = interesado_email.
- Si alguien dice "escríbeme al WhatsApp" = interesado.

Responde SOLO con JSON válido: {"clasificacion": "<categoría>", "confianza": <0.0-1.0>, "razon": "<razón breve en español>"}`;

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

    // ── 6b. If "baja" → mark contact and add to blacklist ──────────
    if (clasificacion === "baja") {
      await supabase
        .from("ce_contactos")
        .update({ estado: "baja" })
        .eq("id", contacto.id);

      await supabase.from("ce_blacklist").insert({
        tipo: "email",
        valor: contacto.email.toLowerCase(),
        motivo: `Solicitud de baja: ${parsed.razon || "clasificado por IA"}`,
      }).then(() => {}).catch(() => {
        // Ignore duplicate – already blacklisted
      });
    }

    // ── 7. If interested → create CRM lead ───────────────────────────
    let crmLeadId: string | null = null;

    if (clasificacion === "interesado" || clasificacion === "interesado_email") {
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

        // Get first pipeline and its first etapa
        const { data: pipeline } = await supabase
          .from("ventas_pipelines")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        if (pipeline) {
          const { data: primeraEtapa } = await supabase
            .from("ventas_etapas")
            .select("id")
            .eq("pipeline_id", pipeline.id)
            .order("orden", { ascending: true })
            .limit(1)
            .single();

          if (primeraEtapa) {
            await supabase.from("ventas_lead_pipeline").insert({
              lead_id: crmLeadId,
              pipeline_id: pipeline.id,
              etapa_id: primeraEtapa.id,
            });
          }
        }

        // Auto-assign setter via reparto config
        try {
          await supabase.rpc("ventas_asignar_lead_automatico", { p_lead_id: crmLeadId });
        } catch {
          // Non-critical — lead is still created
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

    // ── 8. Forward to email if interesado_email ───────────────────────
    let emailForwarded = false;

    if (clasificacion === "interesado_email") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const notifyEmail = "info@madrigalmarketing.es";

      if (resendApiKey) {
        try {
          const fwdResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Cold Email Bot <info@mail.madrigalmarketing.es>",
              to: [notifyEmail],
              subject: `[Respuesta Cold Email] ${contacto.nombre ?? contacto.email} - necesita respuesta`,
              text: `RESPUESTA QUE REQUIERE CONTESTACIÓN POR EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

De: ${contacto.nombre ?? "?"} (${contacto.email})
Empresa: ${contacto.empresa ?? "N/A"}
Teléfono: ${contacto.telefono ?? "N/A"}

Su respuesta:
${replyCuerpo}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Clasificación IA: ${clasificacion} (confianza: ${parsed.confianza})
Razón: ${parsed.razon}
${crmLeadId ? `Lead CRM: creado` : ""}

Para responder, escribe directamente a: ${contacto.email}`,
            }),
          });

          emailForwarded = fwdResp.ok;
          if (!fwdResp.ok) {
            console.error("ce-clasificar-respuesta: forward email error:", await fwdResp.text());
          }
        } catch (fwdErr: any) {
          console.error("ce-clasificar-respuesta: forward email failed:", fwdErr.message);
        }
      }
    }

    // ── 9. Return result ─────────────────────────────────────────────
    return jsonResponse({
      clasificacion,
      confianza: parsed.confianza,
      razon: parsed.razon,
      crm_lead_id: crmLeadId,
      email_forwarded: emailForwarded,
    });
  } catch (err) {
    console.error("ce-clasificar-respuesta error:", err);
    return jsonResponse(
      { error: "Error interno", detail: String(err) },
      500,
    );
  }
});
