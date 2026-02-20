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

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export { supabaseUrl, supabaseAnonKey }
