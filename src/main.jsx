import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ============================================================
// CHUNK LOADING ERROR HANDLER
// Detecta cuando un deploy nuevo ha invalidado los assets
// y fuerza una recarga limpia (máximo 1 vez cada 10 segundos)
// ============================================================
const RELOAD_KEY = 'portal-chunk-reload'

function handleChunkError(message) {
  const isChunkError =
    message?.includes('Failed to fetch dynamically imported module') ||
    message?.includes('Importing a module script failed') ||
    message?.includes('error loading dynamically imported module') ||
    message?.includes('Loading chunk') ||
    message?.includes('Loading CSS chunk')

  if (!isChunkError) return

  // Evitar reload loop: solo recargar 1 vez cada 10 segundos
  const lastReload = sessionStorage.getItem(RELOAD_KEY)
  const now = Date.now()

  if (!lastReload || (now - parseInt(lastReload)) > 10000) {
    sessionStorage.setItem(RELOAD_KEY, now.toString())
    console.warn('[Portal] Nueva versión detectada. Recargando...')
    window.location.reload()
  } else {
    console.error('[Portal] Error de carga persistente tras recarga.')
  }
}

window.addEventListener('error', (event) => {
  handleChunkError(event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message || String(event.reason)
  handleChunkError(message)
  // Solo prevenir el log duplicado si NO es un chunk error
  if (!message?.includes('chunk') && !message?.includes('dynamically imported')) {
    console.error('[Unhandled Promise]', event.reason)
  }
  event.preventDefault()
})

createRoot(document.getElementById('root')).render(<App />)