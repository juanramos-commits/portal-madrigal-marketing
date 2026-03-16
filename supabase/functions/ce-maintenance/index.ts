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

    const summary = {
      warmup_advanced: 0,
      auto_paused: 0,
      followups_reactivated: 0,
      stale_cleaned: 0,
      mx_reset: 0,
      errors: [] as string[],
    };

    // ── 1. Advance warm-up ───────────────────────────────────────────
    try {
      const { data, error } = await supabase.rpc("ce_avanzar_warmup");
      if (error) {
        summary.errors.push(`warmup RPC: ${error.message}`);
      } else {
        summary.warmup_advanced = typeof data === "number" ? data : 0;
      }
    } catch (err) {
      // If RPC doesn't exist or fails, do it manually.
      console.error("ce_avanzar_warmup RPC failed, running manual:", err);

      // Load ramping accounts and advance their warmup day.
      const { data: accounts, error: accErr } = await supabase
        .from("ce_cuentas_email")
        .select("id, warmup_dia_actual, warmup_max")
        .eq("estado", "ramping");

      if (accErr) {
        summary.errors.push(`warmup query: ${accErr.message}`);
      } else if (accounts) {
        for (const acc of accounts) {
          const newDay = (acc.warmup_dia_actual ?? 0) + 1;

          // Check if the account has reached its max warm-up limit.
          // Fetch the effective limit for this day to see if it matches warmup_max.
          const update: Record<string, unknown> = {
            warmup_dia_actual: newDay,
          };

          if (acc.warmup_max && newDay >= acc.warmup_max) {
            update.estado = "resting";
          }

          const { error: updErr } = await supabase
            .from("ce_cuentas_email")
            .update(update)
            .eq("id", acc.id);

          if (!updErr) {
            summary.warmup_advanced++;
          }
        }
      }
    }

    // ── 2. Check auto-pause (bounce & complaint thresholds) ──────────
    try {
      const { data, error } = await supabase.rpc("ce_check_auto_pausa");
      if (error) {
        summary.errors.push(`auto_pausa RPC: ${error.message}`);
      } else {
        summary.auto_paused = typeof data === "number" ? data : 0;
      }
    } catch (err) {
      // Manual fallback: check bounce/complaint rates per account.
      console.error("ce_check_auto_pausa RPC failed, running manual:", err);

      // Load thresholds from config.
      const { data: configRows } = await supabase
        .from("ce_config")
        .select("clave, valor")
        .in("clave", ["bounce_threshold", "complaint_threshold"]);

      const config = new Map<string, string>();
      for (const row of configRows ?? []) {
        config.set(row.clave, row.valor);
      }

      const bounceThreshold = Number(config.get("bounce_threshold")) || 0.05;
      const complaintThreshold =
        Number(config.get("complaint_threshold")) || 0.001;

      // Get active sending accounts.
      const { data: activeAccounts } = await supabase
        .from("ce_cuentas_email")
        .select("id")
        .in("estado", ["ramping", "resting"]);

      if (activeAccounts) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const since = sevenDaysAgo.toISOString();

        for (const acc of activeAccounts) {
          // Count sends, bounces, complaints in last 7 days.
          const [sendsRes, bouncesRes, complaintsRes] = await Promise.all([
            supabase
              .from("ce_envios")
              .select("id", { count: "exact", head: true })
              .eq("cuenta_id", acc.id)
              .gte("enviado_at", since),
            supabase
              .from("ce_envios")
              .select("id", { count: "exact", head: true })
              .eq("cuenta_id", acc.id)
              .eq("estado", "bounced")
              .gte("enviado_at", since),
            supabase
              .from("ce_envios")
              .select("id", { count: "exact", head: true })
              .eq("cuenta_id", acc.id)
              .eq("estado", "complained")
              .gte("enviado_at", since),
          ]);

          const totalSent = sendsRes.count ?? 0;
          if (totalSent === 0) continue;

          const bounceRate = (bouncesRes.count ?? 0) / totalSent;
          const complaintRate = (complaintsRes.count ?? 0) / totalSent;

          if (
            bounceRate > bounceThreshold ||
            complaintRate > complaintThreshold
          ) {
            const { error: pauseErr } = await supabase
              .from("ce_cuentas_email")
              .update({ estado: "paused" })
              .eq("id", acc.id);

            if (!pauseErr) {
              summary.auto_paused++;
            }
          }
        }
      }
    }

    // ── 3. Process follow-ups ────────────────────────────────────────
    try {
      const now = new Date().toISOString();

      const { data: followups, error: fuErr } = await supabase
        .from("ce_enrollments")
        .select("id, secuencia_id, paso_actual")
        .eq("estado", "no_ahora")
        .lte("followup_at", now);

      if (fuErr) {
        summary.errors.push(`followups query: ${fuErr.message}`);
      } else if (followups && followups.length > 0) {
        for (const enrollment of followups) {
          // Calculate next send time: random offset within the next 2 hours.
          const proximoEnvio = new Date();
          proximoEnvio.setMinutes(
            proximoEnvio.getMinutes() + Math.floor(Math.random() * 120),
          );

          const { error: updErr } = await supabase
            .from("ce_enrollments")
            .update({
              estado: "activo",
              followup_at: null,
              proximo_envio_at: proximoEnvio.toISOString(),
            })
            .eq("id", enrollment.id);

          if (!updErr) {
            summary.followups_reactivated++;
          }
        }
      }
    } catch (err) {
      summary.errors.push(`followups: ${String(err)}`);
    }

    // ── 4. Clean stale enrollments ───────────────────────────────────
    try {
      // Find enrollments that are active but whose contact is no longer active.
      const { data: stale, error: staleErr } = await supabase
        .from("ce_enrollments")
        .select(
          `
          id,
          ce_contactos!inner ( estado )
        `,
        )
        .eq("estado", "activo")
        .neq("ce_contactos.estado", "activo")
        .limit(1000);

      if (staleErr) {
        summary.errors.push(`stale query: ${staleErr.message}`);
      } else if (stale && stale.length > 0) {
        const staleIds = stale.map((e: any) => e.id);

        const { error: updErr } = await supabase
          .from("ce_enrollments")
          .update({ estado: "baja" })
          .in("id", staleIds);

        if (updErr) {
          summary.errors.push(`stale update: ${updErr.message}`);
        } else {
          summary.stale_cleaned = staleIds.length;
        }
      }
    } catch (err) {
      summary.errors.push(`stale: ${String(err)}`);
    }

    // ── 5. MX re-verification reset ─────────────────────────────────
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString();

      const { data: oldVerified, error: oldErr } = await supabase
        .from("ce_contactos")
        .select("id")
        .not("mx_verificado_at", "is", null)
        .lt("mx_verificado_at", cutoff)
        .eq("estado", "activo")
        .limit(1000);

      if (oldErr) {
        summary.errors.push(`mx_reset query: ${oldErr.message}`);
      } else if (oldVerified && oldVerified.length > 0) {
        const ids = oldVerified.map((c: any) => c.id);

        const { error: resetErr } = await supabase
          .from("ce_contactos")
          .update({ mx_valido: null })
          .in("id", ids);

        if (resetErr) {
          summary.errors.push(`mx_reset update: ${resetErr.message}`);
        } else {
          summary.mx_reset = ids.length;
        }
      }
    } catch (err) {
      summary.errors.push(`mx_reset: ${String(err)}`);
    }

    // ── Return summary ───────────────────────────────────────────────
    return jsonResponse(summary);
  } catch (err) {
    console.error("ce-maintenance error:", err);
    return jsonResponse(
      { error: "Error interno", detail: String(err) },
      500,
    );
  }
});
