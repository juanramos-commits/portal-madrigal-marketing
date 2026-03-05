import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Select from '../ui/Select'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'

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
  const [duplicados, setDuplicados] = useState(null) // null = not checked, [] = checked no dupes, [...] = dupes found
  const [ignorarDuplicados, setIgnorarDuplicados] = useState(false)

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    // Reset duplicate check when email/phone changes
    if (field === 'email' || field === 'telefono') {
      setDuplicados(null)
      setIgnorarDuplicados(false)
    }
  }

  const checkDuplicados = async () => {
    const email = form.email.trim() || null
    const telefono = form.telefono.trim() || null
    if (!email && !telefono) return []

    try {
      const { data } = await supabase.rpc('ventas_buscar_duplicados', {
        p_email: email,
        p_telefono: telefono,
      })
      return data || []
    } catch {
      return [] // On error, allow creation
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (!form.telefono.trim() && !form.email.trim()) {
      setError('Introduce al menos un teléfono o email')
      return
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('El formato del email no es válido')
      return
    }

    // Check for duplicates (only once, unless user changes email/phone)
    if (!ignorarDuplicados && duplicados === null) {
      setSaving(true)
      setError(null)
      const dupes = await checkDuplicados()
      setDuplicados(dupes)
      setSaving(false)

      if (dupes.length > 0) {
        return // Show duplicate warning, don't create yet
      }
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

  const handleCrearDeTodosFormas = async () => {
    setIgnorarDuplicados(true)
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
            {saving ? 'Comprobando...' : 'Crear Lead'}
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

        {/* Duplicate warning */}
        {duplicados && duplicados.length > 0 && !ignorarDuplicados && (
          <div className="crm-duplicados-warning">
            <div className="crm-duplicados-header">
              <AlertTriangle size={16} />
              <strong>Posibles duplicados encontrados</strong>
            </div>
            <div className="crm-duplicados-list">
              {duplicados.map(d => (
                <div key={d.id} className="crm-duplicado-item">
                  <span className="crm-duplicado-nombre">{d.nombre}</span>
                  <span className="crm-duplicado-match">
                    {d.match_tipo === 'email_y_telefono' ? 'Email y teléfono' :
                     d.match_tipo === 'email' ? 'Mismo email' : 'Mismo teléfono'}
                  </span>
                  {d.email && <span className="crm-duplicado-dato">{d.email}</span>}
                  {d.telefono && <span className="crm-duplicado-dato">{d.telefono}</span>}
                </div>
              ))}
            </div>
            <div className="crm-duplicados-actions">
              <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={onCerrar}>
                Cancelar
              </button>
              <button type="button" className="ui-btn ui-btn--warning ui-btn--sm" onClick={handleCrearDeTodosFormas}>
                Crear de todos modos
              </button>
            </div>
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
