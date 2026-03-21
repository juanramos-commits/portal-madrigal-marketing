import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Resolve WhatsApp access token with fallback chain:
 * 1. Explicit token passed as parameter (from caller function)
 * 2. Environment variable WA_ACCESS_TOKEN
 * 3. Database table ia_config (key = 'wa_access_token')
 *
 * Validates token length (Meta tokens are ~200 chars, minimum 100).
 * Returns null if no valid token found.
 */
export async function resolveWaToken(
  supabase: SupabaseClient,
  explicitToken?: string | null,
): Promise<string | null> {
  // 1. Explicit token from caller
  if (explicitToken && explicitToken.length >= 100) {
    return explicitToken
  }

  // 2. Environment variable
  const envToken = Deno.env.get('WA_ACCESS_TOKEN') ?? ''
  if (envToken.length >= 100) {
    return envToken
  }

  // 3. Database fallback
  try {
    const { data } = await supabase
      .from('ia_config')
      .select('value')
      .eq('key', 'wa_access_token')
      .maybeSingle()
    if (data?.value && data.value.length >= 100) {
      return data.value
    }
  } catch {
    // DB read failed — continue with null
  }

  return null
}
