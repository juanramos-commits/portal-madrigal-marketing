import { useState } from 'react'
import Select from '../ui/Select'
import Modal from '../ui/Modal'

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
    if (saving) return
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
    <Modal
      open={true}
      onClose={onCerrar}
      title="Nuevo Lead"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn--secondary ui-btn--md" onClick={onCerrar} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" form="crm-nuevo-lead-form" className="ui-btn ui-btn--primary ui-btn--md" disabled={saving}>
            {saving ? 'Creando...' : 'Crear Lead'}
          </button>
        </>
      }
    >
      <form id="crm-nuevo-lead-form" className="crm-form" onSubmit={handleSubmit}>
        {error && (
          <div className="crm-form-error">
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
          <Select
            value={form.categoria_id}
            onChange={e => handleChange('categoria_id', e.target.value)}
          >
            <option value="">Sin categoría</option>
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
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
      </form>
    </Modal>
  )
}
