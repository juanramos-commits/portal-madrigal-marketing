import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useOutreachInboxes } from '../../hooks/useOutreachInboxes'
import { useOutreachDomains } from '../../hooks/useOutreachDomains'
import '../../styles/ventas-email.css'

const EMPTY_FORM = { email: '', display_name: '', domain_id: '', daily_limit: 30, signature_html: '' }

export default function OutreachInboxes() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const { inboxes, loading, cargar, crear, actualizar, eliminar } = useOutreachInboxes()
  const { domains, cargar: cargarDominios } = useOutreachDomains()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    cargar()
    cargarDominios()
  }, [cargar, cargarDominios])

  if (!tienePermiso('ventas.outreach.inboxes.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const handleCreate = async () => {
    try {
      await crear(form)
      showToast('Inbox creado correctamente', 'success')
      setShowModal(false)
      setForm(EMPTY_FORM)
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al crear inbox', 'error')
    }
  }

  const handleToggle = async (inbox, field) => {
    try {
      await actualizar(inbox.id, { [field]: !inbox[field] })
      showToast('Inbox actualizado', 'success')
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al actualizar', 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      await eliminar(id)
      showToast('Inbox eliminado', 'success')
      setDeleteConfirm(null)
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Inboxes Outreach</h1>
        {tienePermiso('ventas.outreach.inboxes.crear') && (
          <button className="ve-btn ve-btn--primary" onClick={() => setShowModal(true)}>
            Nuevo Inbox
          </button>
        )}
      </div>

      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando inboxes...</span>
        </div>
      ) : inboxes.length === 0 ? (
        <div className="ve-empty">No hay inboxes configurados.</div>
      ) : (
        <div className="ve-table-wrapper">
          <table className="ve-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Dominio</th>
                <th>Límite diario</th>
                <th>Enviados hoy</th>
                <th>Activo</th>
                <th>Warmup</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inboxes.map((inbox) => (
                <tr key={inbox.id} className="ve-table-row">
                  <td>{inbox.email}</td>
                  <td>{inbox.display_name || '—'}</td>
                  <td>{inbox.domain_name || '—'}</td>
                  <td>{inbox.daily_limit ?? '—'}</td>
                  <td>{inbox.sent_today ?? 0}</td>
                  <td>
                    <button
                      className={`ve-badge ${inbox.active ? 've-badge--green' : 've-badge--gray'}`}
                      onClick={() => tienePermiso('ventas.outreach.inboxes.editar') && handleToggle(inbox, 'active')}
                    >
                      {inbox.active ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td>
                    <button
                      className={`ve-badge ${inbox.warmup_mode ? 've-badge--blue' : 've-badge--gray'}`}
                      onClick={() => tienePermiso('ventas.outreach.inboxes.editar') && handleToggle(inbox, 'warmup_mode')}
                    >
                      {inbox.warmup_mode ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td>
                    <div className="ve-actions">
                      {tienePermiso('ventas.outreach.inboxes.eliminar') && (
                        deleteConfirm === inbox.id ? (
                          <>
                            <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={() => handleDelete(inbox.id)}>Confirmar</button>
                            <button className="ve-btn ve-btn--sm" onClick={() => setDeleteConfirm(null)}>No</button>
                          </>
                        ) : (
                          <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={() => setDeleteConfirm(inbox.id)}>Eliminar</button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="ve-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ve-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo Inbox</h2>
            <div className="ve-form-group">
              <label className="ve-label">Email</label>
              <input
                type="email"
                className="ve-input"
                placeholder="user@ejemplo.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="ve-form-group">
              <label className="ve-label">Nombre para mostrar</label>
              <input
                type="text"
                className="ve-input"
                placeholder="Juan García"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
            </div>
            <div className="ve-form-group">
              <label className="ve-label">Dominio</label>
              <select
                className="ve-select"
                value={form.domain_id}
                onChange={(e) => setForm({ ...form, domain_id: e.target.value })}
              >
                <option value="">Seleccionar dominio...</option>
                {(domains ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.domain}</option>
                ))}
              </select>
            </div>
            <div className="ve-form-group">
              <label className="ve-label">Límite diario</label>
              <input
                type="number"
                className="ve-input"
                value={form.daily_limit}
                onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })}
              />
            </div>
            <div className="ve-form-group">
              <label className="ve-label">Firma HTML</label>
              <textarea
                className="ve-input"
                rows={4}
                placeholder="<p>Firma aquí...</p>"
                value={form.signature_html}
                onChange={(e) => setForm({ ...form, signature_html: e.target.value })}
              />
            </div>
            <div className="ve-modal-actions">
              <button className="ve-btn" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="ve-btn ve-btn--primary" onClick={handleCreate}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
