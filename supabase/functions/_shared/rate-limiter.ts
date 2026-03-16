/**
 * Rate limiting logic for Cold Email daily send limits.
 *
 * Uses Supabase RPCs and the ce_config table to enforce per-account
 * and per-domain daily caps, random inter-send delays, and a global
 * pause switch.
 */

interface LimitResult {
  allowed: boolean;
  sent: number;
  limit: number;
}

/**
 * Check whether an account (cuenta) has remaining daily send quota.
 *
 * Calls RPCs:
 *   - ce_enviados_hoy(p_cuenta_id)  -> number of emails sent today
 *   - ce_limite_efectivo(p_cuenta_id) -> effective daily limit
 */
export async function checkAccountLimit(
  supabase: any,
  cuentaId: string,
): Promise<LimitResult> {
  const [sentRes, limitRes] = await Promise.all([
    supabase.rpc("ce_enviados_hoy", { p_cuenta_id: cuentaId }),
    supabase.rpc("ce_limite_efectivo", { p_cuenta_id: cuentaId }),
  ]);

  if (sentRes.error) {
    throw new Error(`ce_enviados_hoy failed: ${sentRes.error.message}`);
  }
  if (limitRes.error) {
    throw new Error(`ce_limite_efectivo failed: ${limitRes.error.message}`);
  }

  const sent: number = sentRes.data ?? 0;
  const limit: number = limitRes.data ?? 0;

  return {
    allowed: sent < limit,
    sent,
    limit,
  };
}

/**
 * Check whether a sending domain has remaining daily send quota.
 *
 * Calls RPC ce_enviados_hoy_dominio and reads ce_config.max_diario_por_dominio.
 */
export async function checkDomainLimit(
  supabase: any,
  dominio: string,
): Promise<LimitResult> {
  const [sentRes, configRes] = await Promise.all([
    supabase.rpc("ce_enviados_hoy_dominio", { p_dominio: dominio }),
    supabase
      .from("ce_config")
      .select("valor")
      .eq("clave", "max_diario_por_dominio")
      .single(),
  ]);

  if (sentRes.error) {
    throw new Error(
      `ce_enviados_hoy_dominio failed: ${sentRes.error.message}`,
    );
  }
  if (configRes.error) {
    throw new Error(
      `ce_config max_diario_por_dominio read failed: ${configRes.error.message}`,
    );
  }

  const sent: number = sentRes.data ?? 0;
  const limit: number = Number(configRes.data?.valor) || 0;

  return {
    allowed: sent < limit,
    sent,
    limit,
  };
}

/**
 * Return a random delay in milliseconds between the configured min and max
 * inter-send seconds. Reads delay_min_segundos and delay_max_segundos from
 * ce_config.
 */
export async function getRandomDelay(supabase: any): Promise<number> {
  const { data, error } = await supabase
    .from("ce_config")
    .select("clave, valor")
    .in("clave", ["delay_min_segundos", "delay_max_segundos"]);

  if (error) {
    throw new Error(`ce_config delay read failed: ${error.message}`);
  }

  const configMap = new Map<string, string>();
  for (const row of data ?? []) {
    configMap.set(row.clave, row.valor);
  }

  const minSeconds = Number(configMap.get("delay_min_segundos")) || 30;
  const maxSeconds = Number(configMap.get("delay_max_segundos")) || 90;

  const delaySeconds =
    minSeconds + Math.random() * (maxSeconds - minSeconds);

  return Math.round(delaySeconds * 1000);
}

/**
 * Check the global pause flag. Returns true if all sending should stop.
 */
export async function isPausedGlobally(supabase: any): Promise<boolean> {
  const { data, error } = await supabase
    .from("ce_config")
    .select("valor")
    .eq("clave", "pausa_global")
    .single();

  if (error) {
    // If the key does not exist, assume NOT paused.
    return false;
  }

  const val = String(data?.valor).toLowerCase();
  return val === "true" || val === "1" || val === "si" || val === "sí";
}
