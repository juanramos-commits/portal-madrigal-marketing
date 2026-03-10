import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const msg = 'Faltan variables de entorno: VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Configúralas como Build Arguments en Easypanel y redespliega.'
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;padding:24px"><div style="max-width:500px;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:24px"><h2 style="color:#dc2626;margin:0 0 8px">Error de configuración</h2><p style="color:#7f1d1d;margin:0">${msg}</p></div></div>`
  }
  throw new Error(msg)
}

// Custom fetch with automatic retry on transient network errors + timeout
const FETCH_TIMEOUT = 10000 // 10 seconds

const fetchWithRetry = (url, options = {}) => {
  const maxRetries = 1
  const retryDelay = 1500

  const attempt = (retryCount) => {
    // Add timeout via AbortController (unless caller already provided a signal)
    let controller
    let timeoutId
    const fetchOptions = { ...options }
    if (!fetchOptions.signal) {
      controller = new AbortController()
      fetchOptions.signal = controller.signal
      timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    }

    return fetch(url, fetchOptions).then((response) => {
      if (timeoutId) clearTimeout(timeoutId)
      // Retry on 502/503/504 (server temporarily down)
      if (retryCount < maxRetries && response.status >= 502 && response.status <= 504) {
        return new Promise((resolve) =>
          setTimeout(() => resolve(attempt(retryCount + 1)), retryDelay * (retryCount + 1))
        )
      }
      return response
    }).catch((err) => {
      if (timeoutId) clearTimeout(timeoutId)
      // Retry on network errors (offline, DNS failure, connection reset) or timeouts
      // Never retry AbortError from caller's signal
      if (retryCount < maxRetries && (err.name === 'TypeError' || (err.name === 'AbortError' && controller))) {
        return new Promise((resolve, reject) =>
          setTimeout(() => attempt(retryCount + 1).then(resolve, reject), retryDelay * (retryCount + 1))
        )
      }
      throw err
    })
  }

  return attempt(0)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    storageKey: 'madrigal-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Disable navigator.locks — it blocks ALL supabase operations (rpc, from, etc.)
    // behind getSession() → initializePromise → token refresh network call.
    // Without this, a slow token refresh (10s+ timeout) blocks the entire app.
    // Trade-off: multiple tabs could race on token refresh, but Supabase handles that gracefully.
    lock: async (name, acquireTimeout, fn) => fn(),
  },
  global: {
    fetch: fetchWithRetry,
  },
})
export { supabaseUrl, supabaseAnonKey }

// ── smartRpc: ALWAYS bypasses supabase-js for RPC calls ──
// supabase.rpc() internally calls getSession() which can hang on initializePromise
// or have stale internal state. Instead, we ALWAYS read the fresh access_token
// from localStorage (supabase-js updates it there on token refresh) and call
// PostgREST directly via fetch(). Zero supabase-js overhead, zero lock contention.
// If the token is expired, PostgREST returns 401 and we throw TOKEN_EXPIRED.

export function markSupabaseReady() { /* kept for backward compat, no-op now */ }
export function clearCachedAccessToken() { /* kept for backward compat, no-op now */ }

function getAccessTokenFromStorage() {
  try {
    const raw = localStorage.getItem('madrigal-auth')
    if (raw) {
      const parsed = JSON.parse(raw)
      const session = parsed?.session || parsed
      if (session?.access_token) return session.access_token
    }
  } catch (_) { /* ignore */ }
  return null
}

export async function smartRpc(rpcName, params, signal) {
  const token = getAccessTokenFromStorage()
  if (!token) {
    // No token at all — fall back to supabase.rpc() (will trigger auth flow)
    let query = supabase.rpc(rpcName, params)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    return data
  }
  // Direct fetch — always, no supabase-js involvement
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  if (signal) {
    if (signal.aborted) { clearTimeout(timeoutId); controller.abort() }
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED')
    }
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`RPC ${rpcName} failed (${response.status}): ${text}`)
    }
    return response.json()
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}
