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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { enrollment_id, paso_id } = await req.json();
    if (!enrollment_id || !paso_id) {
      return jsonResponse(
        { error: "enrollment_id y paso_id son obligatorios" },
        400,
      );
    }

    // ── 1. Load enrollment with contacto ─────────────────────────────
    const { data: enrollment, error: enrollErr } = await supabase
      .from("ce_enrollments")
      .select(
        `
        id, contacto_id,
        ce_contactos!inner (
          id, nombre, empresa, cargo, email, campos_custom
        )
      `,
      )
      .eq("id", enrollment_id)
      .single();

    if (enrollErr || !enrollment) {
      return jsonResponse(
        { error: "Enrollment no encontrado", detail: enrollErr?.message },
        404,
      );
    }

    // ── 2. Load the paso template ────────────────────────────────────
    const { data: paso, error: pasoErr } = await supabase
      .from("ce_secuencia_pasos")
      .select("id, asunto, cuerpo")
      .eq("id", paso_id)
      .single();

    if (pasoErr || !paso) {
      return jsonResponse(
        { error: "Paso no encontrado", detail: pasoErr?.message },
        404,
      );
    }

    const contacto = enrollment.ce_contactos as any;

    // ── 3-4. Build prompt and call Claude ─────────────────────────────
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return jsonResponse({ error: "ANTHROPIC_API_KEY no configurada" }, 500);
    }

    const systemPrompt = `You are an expert cold email copywriter. Rewrite the following cold email to be personally relevant to the recipient.

Rules:
- Keep the same language as the original (Spanish).
- Keep it short and natural — 3 to 6 sentences max for the body.
- Do NOT add any HTML, links, images, or formatting. Plain text only.
- Do NOT change the core offer or message. Just personalize the opener and connection points.
- Make it sound like one human writing to another, not a template.
- Return valid JSON only: {"asunto": "<personalized subject>", "cuerpo": "<personalized body>"}`;

    const contactInfo = [
      contacto.nombre ? `Name: ${contacto.nombre}` : null,
      contacto.empresa ? `Company: ${contacto.empresa}` : null,
      contacto.cargo ? `Role: ${contacto.cargo}` : null,
      contacto.email ? `Email: ${contacto.email}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Include custom fields if available.
    let customFieldsInfo = "";
    if (
      contacto.campos_custom &&
      typeof contacto.campos_custom === "object" &&
      Object.keys(contacto.campos_custom).length > 0
    ) {
      const entries = Object.entries(contacto.campos_custom)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      if (entries) {
        customFieldsInfo = `\nAdditional info:\n${entries}`;
      }
    }

    const userPrompt = `ORIGINAL EMAIL TEMPLATE:
Subject: ${paso.asunto}
Body:
${paso.cuerpo}

RECIPIENT INFO:
${contactInfo}${customFieldsInfo}`;

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
          max_tokens: 1024,
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

    // ── 5. Parse response ────────────────────────────────────────────
    let parsed: { asunto: string; cuerpo: string };
    try {
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

    if (!parsed.asunto || !parsed.cuerpo) {
      return jsonResponse(
        {
          error: "Respuesta de IA incompleta",
          raw: rawContent,
        },
        500,
      );
    }

    // ── 6. Return personalized content ───────────────────────────────
    return jsonResponse({
      asunto_personalizado: parsed.asunto,
      cuerpo_personalizado: parsed.cuerpo,
    });
  } catch (err) {
    console.error("ce-personalizar-ia error:", err);
    return jsonResponse(
      { error: "Error interno", detail: String(err) },
      500,
    );
  }
});
