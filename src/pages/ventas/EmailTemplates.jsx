import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEmailTemplates } from '../../hooks/useEmailTemplates'
import TemplateBlockEditor from '../../components/ventas/email/TemplateBlockEditor'
import TemplatePreview from '../../components/ventas/email/TemplatePreview'
import '../../styles/ventas-email.css'

export default function EmailTemplates() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const {
    templates,
    loading,
    cargar,
    crear,
    actualizar,
    duplicar,
    eliminar,
  } = useEmailTemplates()

  const [search, setSearch] = useState('')
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [form, setForm] = useState({ name: '', subject: '', category: '', blocks: [] })

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!tienePermiso('ventas.email.plantillas.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const filtered = templates.filter((t) =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase())
  )

  const openEditor = (template) => {
    setEditingTemplate(template?.id || 'nuevo')
    setForm({
      name: template?.name || '',
      subject: template?.subject || '',
      category: template?.category || '',
      blocks: template?.blocks || [],
    })
  }

  const closeEditor = () => {
    setEditingTemplate(null)
    setForm({ name: '', subject: '', category: '', blocks: [] })
  }

  const handleSave = async () => {
    try {
      const id = editingTemplate === 'nuevo' ? null : editingTemplate
      if (id) {
        await actualizar(id, form)
      } else {
        await crear(form)
      }
      showToast('Plantilla guardada', 'success')
      closeEditor()
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error')
    }
  }

  const handleDuplicate = async (e, template) => {
    e.stopPropagation()
    try {
      await duplicar(template.id)
      showToast('Plantilla duplicada', 'success')
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al duplicar', 'error')
    }
  }

  const handleDelete = async (e, template) => {
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar la plantilla "${template.name}"?`)) return
    try {
      await eliminar(template.id)
      showToast('Plantilla eliminada', 'success')
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Plantillas</h1>
        {tienePermiso('ventas.email.plantillas.crear') && (
          <button className="ve-btn ve-btn--primary" onClick={() => openEditor(null)}>
            Nueva Plantilla
          </button>
        )}
      </div>

      {/* Search */}
      <div className="ve-toolbar">
        <input
          type="text"
          className="ve-search-input"
          placeholder="Buscar plantillas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando plantillas...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ve-empty">No se encontraron plantillas.</div>
      ) : (
        <div className="ve-card-grid">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="ve-card ve-card--clickable"
              onClick={() => openEditor(t)}
            >
              <div className="ve-card-body">
                <h3 className="ve-card-title">{t.name}</h3>
                {t.category && (
                  <span className="ve-badge ve-badge--blue">{t.category}</span>
                )}
                <span className="ve-card-meta">{t.blocks?.length ?? 0} bloques</span>
              </div>
              <div className="ve-card-preview">
                <TemplatePreview blocks={t.blocks} subject={t.subject} miniature />
              </div>
              <div className="ve-card-actions" onClick={(e) => e.stopPropagation()}>
                <button className="ve-btn ve-btn--sm" onClick={(e) => { e.stopPropagation(); openEditor(t) }}>Editar</button>
                <button className="ve-btn ve-btn--sm" onClick={(e) => handleDuplicate(e, t)}>Duplicar</button>
                <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={(e) => handleDelete(e, t)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editingTemplate && (
        <div className="ve-modal-overlay" onClick={closeEditor}>
          <div className="ve-modal ve-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ve-modal-header">
              <h2>{editingTemplate === 'nuevo' ? 'Nueva Plantilla' : 'Editar Plantilla'}</h2>
              <button className="ve-modal-close" onClick={closeEditor}>&times;</button>
            </div>
            <div className="ve-modal-body">
              <div className="ve-editor-layout">
                <div className="ve-editor-form">
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
                    <label className="ve-label">Asunto</label>
                    <input
                      type="text"
                      className="ve-input"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    />
                  </div>
                  <div className="ve-form-group">
                    <label className="ve-label">Categoría</label>
                    <input
                      type="text"
                      className="ve-input"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    />
                  </div>
                  <TemplateBlockEditor
                    blocks={form.blocks}
                    onChange={(blocks) => setForm({ ...form, blocks })}
                  />
                </div>
                <div className="ve-editor-preview">
                  <h3 className="ve-section-title">Vista previa</h3>
                  <TemplatePreview blocks={form.blocks} subject={form.subject} />
                </div>
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
