import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEmailSegments } from '../../hooks/useEmailSegments'
import SegmentRuleBuilder from '../../components/ventas/email/SegmentRuleBuilder'
import '../../styles/ventas-email.css'

export default function EmailSegments() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const {
    segments,
    loading,
    cargar,
    crear,
    actualizar,
    eliminar,
    preview,
  } = useEmailSegments()

  const [editingSegment, setEditingSegment] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', rules: [] })
  const [previewCount, setPreviewCount] = useState(null)

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!tienePermiso('ventas.email.segmentos.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const openEditor = (segment) => {
    setEditingSegment(segment?.id || 'nuevo')
    setForm({
      name: segment?.name || '',
      description: segment?.description || '',
      rules: segment?.rules || [],
    })
    setPreviewCount(null)
  }

  const closeEditor = () => {
    setEditingSegment(null)
    setForm({ name: '', description: '', rules: [] })
    setPreviewCount(null)
  }

  const handleSave = async () => {
    try {
      const id = editingSegment === 'nuevo' ? null : editingSegment
      if (id) {
        await actualizar(id, form)
      } else {
        await crear(form)
      }
      showToast('Segmento guardado', 'success')
      closeEditor()
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error')
    }
  }

  const handleDelete = async (e, segment) => {
    e.stopPropagation()
    if (segment.is_system) return
    if (!window.confirm(`¿Eliminar el segmento "${segment.name}"?`)) return
    try {
      await eliminar(segment.id)
      showToast('Segmento eliminado', 'success')
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  const handlePreview = async () => {
    try {
      const { data } = await preview(editingSegment === 'nuevo' ? null : editingSegment)
      setPreviewCount(data)
    } catch (err) {
      showToast(err.message || 'Error al previsualizar', 'error')
    }
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Segmentos</h1>
        {tienePermiso('ventas.email.segmentos.crear') && (
          <button className="ve-btn ve-btn--primary" onClick={() => openEditor(null)}>
            Nuevo Segmento
          </button>
        )}
      </div>

      {/* Segments List */}
      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando segmentos...</span>
        </div>
      ) : segments.length === 0 ? (
        <div className="ve-empty">No hay segmentos creados.</div>
      ) : (
        <div className="ve-list">
          {segments.map((s) => (
            <div
              key={s.id}
              className={`ve-list-item ve-list-item--clickable${editingSegment === s.id ? ' ve-list-item--active' : ''}`}
              onClick={() => !s.is_system && openEditor(s)}
            >
              <div className="ve-list-item-content">
                <div className="ve-list-item-header">
                  <span className="ve-list-item-title">{s.name}</span>
                  {s.is_system && <span className="ve-badge ve-badge--blue">Sistema</span>}
                </div>
                {s.description && <p className="ve-list-item-desc">{s.description}</p>}
                <div className="ve-list-item-meta">
                  <span>{s.contact_count ?? 0} contactos</span>
                  {s.last_evaluated_at && (
                    <span>Evaluado: {new Date(s.last_evaluated_at).toLocaleDateString('es-ES')}</span>
                  )}
                </div>
              </div>
              {!s.is_system && (
                <div className="ve-list-item-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="ve-btn ve-btn--sm" onClick={() => openEditor(s)}>Editar</button>
                  <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={(e) => handleDelete(e, s)}>Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor Panel */}
      {editingSegment && (
        <div className="ve-modal-overlay" onClick={closeEditor}>
          <div className="ve-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ve-modal-header">
              <h2>{editingSegment === 'nuevo' ? 'Nuevo Segmento' : 'Editar Segmento'}</h2>
              <button className="ve-modal-close" onClick={closeEditor}>&times;</button>
            </div>
            <div className="ve-modal-body">
              <div className="ve-form-group">
                <label className="ve-label">Nombre</label>
                <input
                  type="text"
                  className="ve-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="ve-form-group">
                <label className="ve-label">Descripción</label>
                <textarea
                  className="ve-textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="ve-form-group">
                <label className="ve-label">Reglas</label>
                <SegmentRuleBuilder
                  rules={form.rules}
                  onChange={(rules) => setForm({ ...form, rules })}
                />
              </div>
              <div className="ve-preview-section">
                <button className="ve-btn" onClick={handlePreview}>Previsualizar</button>
                {previewCount !== null && (
                  <span className="ve-preview-count">{previewCount} contactos coinciden</span>
                )}
              </div>
            </div>
            <div className="ve-modal-footer">
              <button className="ve-btn" onClick={closeEditor}>Cancelar</button>
              <button className="ve-btn ve-btn--primary" onClick={handleSave}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
