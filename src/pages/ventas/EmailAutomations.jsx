import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEmailAutomations } from '../../hooks/useEmailAutomations'
import AutomationStepEditor from '../../components/ventas/email/AutomationStepEditor'
import '../../styles/ventas-email.css'

const STATUS_COLORS = {
  active: 've-badge--green',
  paused: 've-badge--yellow',
  draft: 've-badge--gray',
}

const STATUS_LABELS = {
  active: 'Activa',
  paused: 'Pausada',
  draft: 'Borrador',
}

export default function EmailAutomations() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const {
    automations,
    loading,
    cargar,
    crear,
    actualizar,
    eliminar,
    activar,
    desactivar,
  } = useEmailAutomations()

  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', trigger_type: '', steps: [] })

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!tienePermiso('ventas.email.automaciones.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const openEditor = (automation) => {
    const id = automation?.id || 'nuevo'
    setEditingId(id)
    setExpandedId(id)
    setForm({
      name: automation?.name || '',
      trigger_type: automation?.trigger_type || '',
      steps: automation?.steps || [],
    })
  }

  const closeEditor = () => {
    setEditingId(null)
    setForm({ name: '', trigger_type: '', steps: [] })
  }

  const handleSave = async () => {
    try {
      const id = editingId === 'nuevo' ? null : editingId
      if (id) {
        await actualizar(id, form)
      } else {
        await crear(form)
      }
      showToast('Automatización guardada', 'success')
      closeEditor()
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error')
    }
  }

  const handleToggle = async (e, automation) => {
    e.stopPropagation()
    try {
      if (automation.status === 'active') {
        await desactivar(automation.id)
        showToast('Automatización pausada', 'success')
      } else {
        await activar(automation.id)
        showToast('Automatización activada', 'success')
      }
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al cambiar estado', 'error')
    }
  }

  const handleDelete = async (e, automation) => {
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar "${automation.name}"?`)) return
    try {
      await eliminar(automation.id)
      showToast('Automatización eliminada', 'success')
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Automaciones</h1>
        {tienePermiso('ventas.email.automaciones.crear') && (
          <button className="ve-btn ve-btn--primary" onClick={() => openEditor(null)}>
            Nueva Automatización
          </button>
        )}
      </div>

      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando automaciones...</span>
        </div>
      ) : automations.length === 0 ? (
        <div className="ve-empty">No hay automaciones creadas.</div>
      ) : (
        <div className="ve-list">
          {automations.map((a) => (
            <div key={a.id} className="ve-list-item">
              <div
                className="ve-list-item-content ve-list-item--clickable"
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
              >
                <div className="ve-list-item-header">
                  <span className="ve-list-item-title">{a.name}</span>
                  <span className={`ve-badge ${STATUS_COLORS[a.status] || ''}`}>
                    {STATUS_LABELS[a.status] || a.status}
                  </span>
                </div>
                <div className="ve-list-item-meta">
                  <span>Trigger: {a.trigger_type}</span>
                  <span>{a.steps?.length ?? 0} pasos</span>
                  <span>{a.enrolled_count ?? 0} inscritos</span>
                </div>
              </div>

              <div className="ve-list-item-actions" onClick={(e) => e.stopPropagation()}>
                {tienePermiso('ventas.email.automaciones.activar') && a.status !== 'draft' && (
                  <button
                    className={`ve-btn ve-btn--sm ${a.status === 'active' ? 've-btn--warning' : 've-btn--primary'}`}
                    onClick={(e) => handleToggle(e, a)}
                  >
                    {a.status === 'active' ? 'Pausar' : 'Activar'}
                  </button>
                )}
                {tienePermiso('ventas.email.automaciones.crear') && (
                  <button className="ve-btn ve-btn--sm" onClick={(e) => { e.stopPropagation(); openEditor(a) }}>Editar</button>
                )}
                {tienePermiso('ventas.email.automaciones.crear') && (
                  <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={(e) => handleDelete(e, a)}>Eliminar</button>
                )}
              </div>

              {/* Expanded View */}
              {expandedId === a.id && editingId !== a.id && (
                <div className="ve-expanded-content">
                  <AutomationStepEditor steps={a.steps || []} readOnly />
                </div>
              )}

              {/* Editing View */}
              {editingId === a.id && (
                <div className="ve-expanded-content">
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
                    <label className="ve-label">Tipo de trigger</label>
                    <input
                      type="text"
                      className="ve-input"
                      value={form.trigger_type}
                      onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                    />
                  </div>
                  <AutomationStepEditor
                    steps={form.steps}
                    onChange={(steps) => setForm({ ...form, steps })}
                  />
                  <div className="ve-actions-bar">
                    <button className="ve-btn" onClick={closeEditor}>Cancelar</button>
                    <button className="ve-btn ve-btn--primary" onClick={handleSave}>Guardar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Automation Form */}
      {editingId === 'nuevo' && (
        <div className="ve-modal-overlay" onClick={closeEditor}>
          <div className="ve-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ve-modal-header">
              <h2>Nueva Automatización</h2>
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
                <label className="ve-label">Tipo de trigger</label>
                <input
                  type="text"
                  className="ve-input"
                  value={form.trigger_type}
                  onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                />
              </div>
              <AutomationStepEditor
                steps={form.steps}
                onChange={(steps) => setForm({ ...form, steps })}
              />
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
