import { useState, useEffect } from 'react'

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
)

export default function BibliotecaFormSeccion({ seccion, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (seccion) {
      setNombre(seccion.nombre || '')
      setDescripcion(seccion.descripcion || '')
    }
  }, [seccion])

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim() || null })
      onCerrar()
    } catch (e) {
      setError(e.message || 'Error al guardar sección')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="bib-modal-overlay" onClick={onCerrar} />
      <div className="bib-modal bib-modal-sm">
        <div className="bib-modal-header">
          <h2>{seccion ? 'Editar sección' : 'Nueva sección'}</h2>
          <button className="bib-modal-close" onClick={onCerrar}><CloseIcon /></button>
        </div>
        <div className="bib-modal-body">
          <div className="bib-field">
            <label>Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Enlaces de pago"
            />
          </div>
          <div className="bib-field">
            <label>Descripción</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción opcional de la sección"
              rows={3}
            />
          </div>
          {error && <div className="bib-error-msg">{error}</div>}
        </div>
        <div className="bib-modal-actions">
          <button className="bib-btn-ghost" onClick={onCerrar} disabled={saving}>Cancelar</button>
          <button className="bib-btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando...' : seccion ? 'Guardar cambios' : 'Crear sección'}
          </button>
        </div>
      </div>
    </>
  )
}
