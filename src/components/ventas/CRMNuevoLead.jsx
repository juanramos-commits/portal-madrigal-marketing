import { useState } from 'react'

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
)

export default function CRMNuevoLead({ categorias = [], onCrear, onCerrar }) {
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    email: '',
    nombre_negocio: '',
    categoria_id: '',
    fuente: '',
    notas: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onCrear({
        ...form,
        categoria_id: form.categoria_id || null,
      })
      onCerrar()
    } catch (err) {
      setError(err.message || 'Error al crear el lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="crm-modal-overlay" onClick={onCerrar}>
      <div className="crm-modal" onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <h2>Nuevo Lead</h2>
          <button className="crm-modal-close" onClick={onCerrar}>
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="crm-modal-body">
            {error && (
              <div style={{ fontSize: 13, color: 'var(--error)', padding: '8px 12px', background: 'rgba(255,107,107,0.1)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <div className="crm-field">
              <label>Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => handleChange('nombre', e.target.value)}
                placeholder="Nombre del lead"
                autoFocus
              />
            </div>

            <div className="crm-field">
              <label>Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={e => handleChange('telefono', e.target.value)}
                placeholder="+34 600 000 000"
              />
            </div>

            <div className="crm-field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>

            <div className="crm-field">
              <label>Categoría</label>
              <select
                value={form.categoria_id}
                onChange={e => handleChange('categoria_id', e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="crm-field">
              <label>Nombre del negocio</label>
              <input
                type="text"
                value={form.nombre_negocio}
                onChange={e => handleChange('nombre_negocio', e.target.value)}
                placeholder="Nombre del negocio"
              />
            </div>

            <div className="crm-field">
              <label>Fuente</label>
              <input
                type="text"
                value={form.fuente}
                onChange={e => handleChange('fuente', e.target.value)}
                placeholder="Instagram, Web, Email Marketing..."
              />
            </div>

            <div className="crm-field">
              <label>Notas</label>
              <textarea
                value={form.notas}
                onChange={e => handleChange('notas', e.target.value)}
                placeholder="Notas iniciales..."
                rows={3}
              />
            </div>
          </div>

          <div className="crm-modal-footer">
            <button type="button" className="btn" onClick={onCerrar} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Creando...' : 'Crear Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
