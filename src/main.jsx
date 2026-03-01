import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Limpiar service workers y cachés residuales
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  })
}
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name))
  })
}

createRoot(document.getElementById('root')).render(<App />)
