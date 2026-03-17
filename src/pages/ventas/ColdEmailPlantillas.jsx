import { useState } from 'react'
import { useCEPlantillas } from '../../hooks/useCEPlantillas'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const VARIABLES = [
  { key: '{{nombre}}', desc: 'Nombre del contacto' },
  { key: '{{empresa}}', desc: 'Empresa del contacto' },
  { key: '{{cargo}}', desc: 'Cargo del contacto' },
  { key: '{{email}}', desc: 'Email del contacto' },
  { key: '{{telefono}}', desc: 'Telefono del contacto' },
  { key: '{{dominio_empresa}}', desc: 'Nombre derivado del dominio del email' },
  { key: '{{categoria}}', desc: 'Categoria del contacto' },
  { key: '{{zona}}', desc: 'Zona del contacto' },
]

const CATEGORIAS = ['general', 'primer_contacto', 'seguimiento', 're_engagement', 'referencia']

const emptyForm = {
  nombre: '',
  categoria: 'general',
  asunto: '',
  cuerpo: '',
}

export default function ColdEmailPlantillas() {
  const { tienePermiso } = useAuth()
  const { showToast: addToast } = useToast()

  const {
    plantillas,
    loading,
    error,
    crear: crearPlantilla,
    actualizar: actualizarPlantilla,
    eliminar: eliminarPlantilla,
  } = useCEPlantillas()

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [guardando, setGuardando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const openNew = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditingId(p.id)
    setForm({
      nombre: p.nombre || '',
      categoria: p.categoria || 'general',
      asunto: p.asunto || '',
      cuerpo: p.cuerpo || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.asunto.trim()) {
      addToast('Nombre y asunto son requeridos', 'error')
      return
    }
    setGuardando(true)
    try {
      if (editingId) {
        await actualizarPlantilla(editingId, form)
        addToast('Plantilla actualizada', 'success')
      } else {
        await crearPlantilla(form)
        addToast('Plantilla creada', 'success')
      }
      setShowModal(false)
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await eliminarPlantilla(id)
      addToast('Plantilla eliminada', 'success')
      setConfirmDelete(null)
      if (editingId === id) setShowModal(false)
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const insertVariable = (varKey) => {
    setForm((prev) => ({
      ...prev,
      cuerpo: prev.cuerpo + varKey,
    }))
  }

  if (!tienePermiso('cold_email.plantillas.ver')) {
    return (
      <div className="ce-page">
        <div className="ce-error" role="alert">No tienes permiso para ver plantillas.</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="ce-page">
        <div className="ce-loading" role="status">
          <div className="ce-spinner" aria-hidden="true" />
          <span>Cargando plantillas...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ce-page">
        <div className="ce-error" role="alert">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="ce-page">
      <div className="ce-page-header">
        <h1 className="ce-page-title">Plantillas</h1>
        {tienePermiso('cold_email.plantillas.crear') && (
          <button className="ce-btn ce-btn-primary" onClick={openNew}>
            + Nueva Plantilla
          </button>
        )}
      </div>

      {/* Grid */}
      {plantillas?.length > 0 ? (
        <div className="ce-card-grid">
          {plantillas.map((p) => (
            <div
              key={p.id}
              className="ce-template-card"
              onClick={() => openEdit(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openEdit(p)}
            >
              <div className="ce-template-card-header">
                <h3 className="ce-template-card-name">{p.nombre}</h3>
                <span className="ce-badge ce-badge-info">{p.categoria || 'general'}</span>
              </div>
              <div className="ce-template-card-asunto">
                <strong>Asunto:</strong> {p.asunto}
              </div>
              <div className="ce-template-card-body">
                {(p.cuerpo || '').slice(0, 100)}{(p.cuerpo || '').length > 100 ? '...' : ''}
              </div>
              {p.cuerpo && (
                <div className="ce-template-vars">
                  {VARIABLES.filter((v) => p.cuerpo.includes(v.key)).map((v) => (
                    <span key={v.key} className="ce-tag ce-tag-var">{v.key}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="ce-empty">
          <div className="ce-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <p>No hay plantillas.</p>
          {tienePermiso('cold_email.plantillas.crear') && (
            <button className="ce-btn ce-btn-primary" onClick={openNew}>
              Crear primera plantilla
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="ce-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ce-modal ce-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="ce-modal-header">
              <h3>{editingId ? 'Editar Plantilla' : 'Nueva Plantilla'}</h3>
              <button className="ce-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="ce-modal-body">
              <div className="ce-form-grid">
                <div className="ce-form-field">
                  <label className="ce-label">Nombre</label>
                  <input
                    type="text"
                    className="ce-input"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Nombre de la plantilla"
                  />
                </div>
                <div className="ce-form-field">
                  <label className="ce-label">Categoria</label>
                  <select
                    className="ce-select"
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>{c.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ce-form-field">
                <label className="ce-label">Asunto</label>
                <input
                  type="text"
                  className="ce-input"
                  value={form.asunto}
                  onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                  placeholder="Asunto del email"
                />
              </div>

              <div className="ce-form-field">
                <label className="ce-label">Cuerpo (texto plano)</label>
                <textarea
                  className="ce-textarea"
                  rows={10}
                  value={form.cuerpo}
                  onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
                  placeholder="Escribe el contenido del email..."
                />
                {/(?:https?:\/\/|www\.)[^\s]+/i.test(form.cuerpo || '') && (
                  <div className="ce-warning-inline">Los enlaces se eliminan automaticamente al enviar para evitar filtros de spam.</div>
                )}
              </div>

              {/* Variables helper */}
              <div className="ce-variables-helper">
                <span className="ce-label">Variables disponibles:</span>
                <div className="ce-variables-list">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      className="ce-btn ce-btn-sm ce-btn-var"
                      onClick={() => insertVariable(v.key)}
                      title={v.desc}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="ce-modal-footer">
              {editingId && tienePermiso('cold_email.plantillas.eliminar') && (
                <div className="ce-modal-footer-left">
                  {confirmDelete === editingId ? (
                    <>
                      <span className="ce-text-danger">Confirmar eliminacion?</span>
                      <button className="ce-btn ce-btn-sm ce-btn-danger" onClick={() => handleDelete(editingId)}>
                        Si, eliminar
                      </button>
                      <button className="ce-btn ce-btn-sm ce-btn-secondary" onClick={() => setConfirmDelete(null)}>
                        No
                      </button>
                    </>
                  ) : (
                    <button className="ce-btn ce-btn-sm ce-btn-danger" onClick={() => setConfirmDelete(editingId)}>
                      Eliminar
                    </button>
                  )}
                </div>
              )}
              <button className="ce-btn ce-btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button
                className="ce-btn ce-btn-primary"
                disabled={guardando}
                onClick={handleSave}
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
