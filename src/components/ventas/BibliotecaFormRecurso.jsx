import { useState, useEffect } from 'react'
import Checkbox from '../ui/Checkbox'
import Select from '../ui/Select'
import Modal from '../ui/Modal'

const TIPOS = [
  { value: 'enlace_pago', label: 'Enlace de pago' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'video', label: 'Vídeo' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'otro', label: 'Otro' },
]

const ROLES_OPTIONS = [
  { value: 'setter', label: 'Setter' },
  { value: 'closer', label: 'Closer' },
  { value: 'director_ventas', label: 'Director de ventas' },
  { value: 'super_admin', label: 'Super admin' },
]

export default function BibliotecaFormRecurso({ recurso, secciones, seccionIdInicial, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [url, setUrl] = useState('')
  const [tipo, setTipo] = useState('otro')
  const [seccionId, setSeccionId] = useState('')
  const [visiblePara, setVisiblePara] = useState(['setter', 'closer', 'director_ventas', 'super_admin'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (recurso) {
      setNombre(recurso.nombre || '')
      setDescripcion(recurso.descripcion || '')
      setUrl(recurso.url || '')
      setTipo(recurso.tipo || 'otro')
      setSeccionId(recurso.seccion_id || '')
      setVisiblePara(recurso.visible_para || ['setter', 'closer', 'director_ventas', 'super_admin'])
    } else if (seccionIdInicial) {
      setSeccionId(seccionIdInicial)
    }
  }, [recurso?.id, seccionIdInicial])

  const toggleRol = (rol) => {
    setVisiblePara(prev => {
      if (prev.includes(rol)) {
        // Prevent unchecking the last role
        if (prev.length <= 1) return prev
        return prev.filter(r => r !== rol)
      }
      return [...prev, rol]
    })
  }

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (!seccionId) {
      setError('Selecciona una sección')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onGuardar({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        url: url.trim() || null,
        tipo,
        seccion_id: seccionId,
        visible_para: visiblePara,
      })
      onCerrar()
    } catch (e) {
      setError(e.message || 'Error al guardar recurso')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onCerrar}
      title={recurso ? 'Editar recurso' : 'Nuevo recurso'}
      footer={
        <>
          <button className="bib-btn-ghost" onClick={onCerrar} disabled={saving}>Cancelar</button>
          <button className="bib-btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando...' : recurso ? 'Guardar cambios' : 'Crear recurso'}
          </button>
        </>
      }
    >
      <div className="bib-field">
        <label>Nombre *</label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Enlace de pago mensual"
        />
      </div>
      <div className="bib-field">
        <label>Descripción</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder="Descripción opcional"
          rows={2}
        />
      </div>
      <div className="bib-field">
        <label>Enlace / Valor</label>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="URL o valor de texto"
        />
      </div>
      <div className="bib-form-row">
        <div className="bib-field">
          <label>Tipo</label>
          <Select value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div className="bib-field">
          <label>Sección *</label>
          <Select value={seccionId} onChange={e => setSeccionId(e.target.value)}>
            <option value="">Seleccionar sección</option>
            {secciones.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="bib-field">
        <label>Visibilidad por rol</label>
        <div className="bib-roles-selector">
          {ROLES_OPTIONS.map(r => (
            <label key={r.value} className="bib-role-check">
              <Checkbox
                checked={visiblePara.includes(r.value)}
                onChange={() => toggleRol(r.value)}
              />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <div className="bib-error-msg">{error}</div>}
    </Modal>
  )
}
