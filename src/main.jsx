import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global error handlers — prevent silent failures from crashing the app
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise]', event.reason)
  // Prevent the browser default (would log a second error in some browsers)
  event.preventDefault()
})

window.addEventListener('error', (event) => {
  // Catch chunk load failures (lazy imports failing due to network)
  if (event.message?.includes('Loading chunk') || event.message?.includes('Failed to fetch dynamically imported module')) {
    console.error('[Chunk Load Error] Recargando app...', event.message)
    // Clear module cache and reload — the new deploy probably changed chunk hashes
    window.location.reload()
  }
})

createRoot(document.getElementById('root')).render(<App />)
