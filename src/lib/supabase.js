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

// Custom fetch with automatic retry on transient network errors
const fetchWithRetry = (url, options = {}) => {
  const maxRetries = 2
  const retryDelay = 1000

  const attempt = (retryCount) =>
    fetch(url, options).then((response) => {
      // Retry on 502/503/504 (server temporarily down)
      if (retryCount < maxRetries && response.status >= 502 && response.status <= 504) {
        return new Promise((resolve) =>
          setTimeout(() => resolve(attempt(retryCount + 1)), retryDelay * (retryCount + 1))
        )
      }
      return response
    }).catch((err) => {
      // Retry on network errors (offline, DNS failure, connection reset)
      // Never retry AbortError — it means the request was intentionally cancelled (e.g. navigation)
      if (retryCount < maxRetries && err.name === 'TypeError') {
        return new Promise((resolve, reject) =>
          setTimeout(() => attempt(retryCount + 1).then(resolve, reject), retryDelay * (retryCount + 1))
        )
      }
      throw err
    })

  return attempt(0)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    storageKey: 'madrigal-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithRetry,
  },
})
export { supabaseUrl, supabaseAnonKey }
