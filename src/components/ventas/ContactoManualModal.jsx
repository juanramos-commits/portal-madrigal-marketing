import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Send, AlertCircle, CheckCircle, X } from 'lucide-react'
import '../../styles/agentes-ia.css'

function normalizarTelefono(raw) {
  // Strip spaces, dashes, parens
  let tel = raw.replace(/[\s\-\(\)]/g, '')
  // Add + if missing
  if (!tel.startsWith('+')) tel = '+' + tel
  return tel
}

function validarTelefono(telefono) {
  const normalized = normalizarTelefono(telefono)
  return /^\+\d{7,15}$/.test(normalized)
}

export default function ContactoManualModal({ open, onClose, agenteId }) {
  const [form, setForm] = useState({
    telefono: '',
    nombre: '',
    email: '',
    servicio: '',
  })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  if (!open) return null

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setError(null)
  }

  const handleEnviar = async (e) => {
    e.preventDefault()
    if (!form.telefono.trim()) {
      setError('El telefono es obligatorio')
      return
    }
    if (!validarTelefono(form.telefono.trim())) {
      setError('Formato de teléfono no válido. Ej: +34612345678, 34612345678, 612 345 678')
      return
    }

    setSending(true)
    setError(null)
    setResult(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const res = await fetch(`${supabaseUrl}/functions/v1/ia-outbound-primer-mensaje`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          agente_id: agenteId,
          telefono: normalizarTelefono(form.telefono.trim()),
          nombre: form.nombre.trim() || null,
          email: form.email.trim() || null,
          servicio: form.servicio.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`)

      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    setForm({ telefono: '', nombre: '', email: '', servicio: '' })
    setResult(null)
    setError(null)
    onClose()
  }

  return (
    <div className="ia-modal-overlay" onClick={handleClose}>
      <div className="ia-modal" onClick={e => e.stopPropagation()}>
        <div className="ia-modal-header">
          <h2>Contacto manual</h2>
          <button className="ia-modal-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="ia-import-result">
            <CheckCircle size={40} style={{ color: '#10b981' }} />
            <h3>Mensaje enviado</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
              {result.message || 'El primer mensaje ha sido enviado correctamente.'}
            </p>
            <button className="ia-btn ia-btn-primary" onClick={handleClose} style={{ marginTop: 12 }}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleEnviar}>
            <div className="ia-field">
              <label>Teléfono *</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={e => update('telefono', e.target.value)}
                placeholder="612 345 678 o +34612345678"
                autoFocus
              />
            </div>
            <div className="ia-field">
              <label>Nombre</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => update('nombre', e.target.value)}
                placeholder="Nombre del contacto"
              />
            </div>
            <div className="ia-field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="ia-field">
              <label>Servicio</label>
              <input
                type="text"
                value={form.servicio}
                onChange={e => update('servicio', e.target.value)}
                placeholder="Servicio de interes"
              />
            </div>

            {error && (
              <div className="ia-import-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="ia-modal-actions">
              <button type="button" className="ia-btn ia-btn-secondary" onClick={handleClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="ia-btn ia-btn-primary"
                disabled={sending || !form.telefono.trim()}
              >
                <Send size={14} />
                {sending ? 'Enviando...' : 'Enviar primer mensaje'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
