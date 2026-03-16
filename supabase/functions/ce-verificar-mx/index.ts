import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMX } from "../_shared/mx-verifier.ts";

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

const MAX_BATCH = 500;
const CONCURRENT_CHECKS = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const contactoIds: string[] | undefined = body.contacto_ids;
    const allUnverified: boolean = body.all_unverified ?? false;

    // ── 1-2. Fetch contacts to verify ────────────────────────────────
    let contacts: { id: string; email: string }[];

    if (allUnverified) {
      const { data, error } = await supabase
        .from("ce_contactos")
        .select("id, email")
        .is("mx_valido", null)
        .eq("estado", "activo")
        .limit(MAX_BATCH);

      if (error) {
        return jsonResponse(
          { error: "Error cargando contactos", detail: error.message },
          500,
        );
      }
      contacts = data ?? [];
    } else if (contactoIds && contactoIds.length > 0) {
      const ids = contactoIds.slice(0, MAX_BATCH);
      const { data, error } = await supabase
        .from("ce_contactos")
        .select("id, email")
        .in("id", ids);

      if (error) {
        return jsonResponse(
          { error: "Error cargando contactos", detail: error.message },
          500,
        );
      }
      contacts = data ?? [];
    } else {
      return jsonResponse(
        { error: "Debe enviar contacto_ids o all_unverified: true" },
        400,
      );
    }

    if (contacts.length === 0) {
      return jsonResponse({ verificados: 0, validos: 0, invalidos: 0 });
    }

    // ── 3. Verify MX in concurrent batches ───────────────────────────
    const results: { id: string; email: string; valid: boolean }[] = [];

    for (let i = 0; i < contacts.length; i += CONCURRENT_CHECKS) {
      const chunk = contacts.slice(i, i + CONCURRENT_CHECKS);
      const chunkResults = await Promise.all(
        chunk.map(async (c) => {
          const mx = await verifyMX(c.email);
          return { id: c.id, email: c.email, valid: mx.valid };
        }),
      );
      results.push(...chunkResults);
    }

    // ── 4. Batch update ce_contactos ─────────────────────────────────
    const now = new Date().toISOString();
    const validIds = results.filter((r) => r.valid).map((r) => r.id);
    const invalidIds = results.filter((r) => !r.valid).map((r) => r.id);

    // Update valid contacts.
    if (validIds.length > 0) {
      const { error: updErr } = await supabase
        .from("ce_contactos")
        .update({ mx_valido: true, mx_verificado_at: now })
        .in("id", validIds);

      if (updErr) {
        console.error("Error updating valid contacts:", updErr.message);
      }
    }

    // Update invalid contacts.
    if (invalidIds.length > 0) {
      const { error: updErr } = await supabase
        .from("ce_contactos")
        .update({ mx_valido: false, mx_verificado_at: now })
        .in("id", invalidIds);

      if (updErr) {
        console.error("Error updating invalid contacts:", updErr.message);
      }
    }

    // ── 5. Pause active enrollments for invalid contacts ─────────────
    if (invalidIds.length > 0) {
      const { error: pauseErr } = await supabase
        .from("ce_enrollments")
        .update({ estado: "pausado" })
        .in("contacto_id", invalidIds)
        .in("estado", ["activo", "esperando"]);

      if (pauseErr) {
        console.error("Error pausing enrollments:", pauseErr.message);
      }
    }

    // ── 6. Return summary ────────────────────────────────────────────
    return jsonResponse({
      verificados: results.length,
      validos: validIds.length,
      invalidos: invalidIds.length,
    });
  } catch (err) {
    console.error("ce-verificar-mx error:", err);
    return jsonResponse(
      { error: "Error interno", detail: String(err) },
      500,
    );
  }
});
