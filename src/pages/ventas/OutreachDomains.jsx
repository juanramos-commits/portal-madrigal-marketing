import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useOutreachDomains } from '../../hooks/useOutreachDomains'
import '../../styles/ventas-email.css'

const STATUS_COLORS = {
  active: 've-badge--green',
  warmup: 've-badge--blue',
  paused: 've-badge--yellow',
  disabled: 've-badge--gray',
}

const HEALTH_COLOR = (score) => {
  if (score >= 80) return 've-badge--green'
  if (score >= 50) return 've-badge--yellow'
  return 've-badge--red'
}

const EMPTY_FORM = { domain: '', daily_limit: 20, notes: '' }

export default function OutreachDomains() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const { domains, loading, cargar, crear, actualizar, eliminar } = useOutreachDomains()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!tienePermiso('ventas.outreach.dominios.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const handleCreate = async () => {
    try {
      await crear(form)
      showToast('Dominio creado correctamente', 'success')
      setShowModal(false)
      setForm(EMPTY_FORM)
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al crear dominio', 'error')
    }
  }

  const handleSaveEdit = async (id) => {
    try {
      await actualizar(id, editForm)
      showToast('Dominio actualizado', 'success')
      setEditingId(null)
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al actualizar', 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      await eliminar(id)
      showToast('Dominio eliminado', 'success')
      setDeleteConfirm(null)
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Dominios Outreach</h1>
        {tienePermiso('ventas.outreach.dominios.crear') && (
          <button className="ve-btn ve-btn--primary" onClick={() => setShowModal(true)}>
            Nuevo Dominio
          </button>
        )}
      </div>

      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando dominios...</span>
        </div>
      ) : domains.length === 0 ? (
        <div className="ve-empty">No hay dominios configurados.</div>
      ) : (
        <div className="ve-table-wrapper">
          <table className="ve-table">
            <thead>
              <tr>
                <th>Dominio</th>
                <th>Estado</th>
                <th>Health</th>
                <th>Warmup</th>
                <th>Límite diario</th>
                <th>SPF</th>
                <th>DKIM</th>
                <th>DMARC</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.id} className="ve-table-row">
                  {editingId === d.id ? (
                    <>
                      <td>{d.domain}</td>
                      <td>
                        <span className={`ve-badge ${STATUS_COLORS[d.status] || ''}`}>{d.status}</span>
                      </td>
                      <td>
                        <span className={`ve-badge ${HEALTH_COLOR(d.health_score ?? 0)}`}>{d.health_score ?? 0}</span>
                      </td>
                      <td>Día {d.warmup_day ?? 0} / 60</td>
                      <td>
                        <input
                          type="number"
                          className="ve-search-input"
                          style={{ width: '80px' }}
                          value={editForm.daily_limit ?? d.daily_limit}
                          onChange={(e) => setEditForm({ ...editForm, daily_limit: Number(e.target.value) })}
                        />
                      </td>
                      <td>{d.spf ? '\u2713' : '\u2717'}</td>
                      <td>{d.dkim ? '\u2713' : '\u2717'}</td>
                      <td>{d.dmarc ? '\u2713' : '\u2717'}</td>
                      <td>
                        <div className="ve-actions">
                          <button className="ve-btn ve-btn--sm ve-btn--primary" onClick={() => handleSaveEdit(d.id)}>Guardar</button>
                          <button className="ve-btn ve-btn--sm" onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{d.domain}</td>
                      <td>
                        <span className={`ve-badge ${STATUS_COLORS[d.status] || ''}`}>{d.status}</span>
                      </td>
                      <td>
                        <span className={`ve-badge ${HEALTH_COLOR(d.health_score ?? 0)}`}>{d.health_score ?? 0}</span>
                      </td>
                      <td>Día {d.warmup_day ?? 0} / 60</td>
                      <td>{d.daily_limit ?? '—'}</td>
                      <td>{d.spf ? '\u2713' : '\u2717'}</td>
                      <td>{d.dkim ? '\u2713' : '\u2717'}</td>
                      <td>{d.dmarc ? '\u2713' : '\u2717'}</td>
                      <td>
                        <div className="ve-actions">
                          {tienePermiso('ventas.outreach.dominios.editar') && (
                            <button
                              className="ve-btn ve-btn--sm"
                              onClick={() => { setEditingId(d.id); setEditForm({ daily_limit: d.daily_limit }) }}
                            >
                              Editar
                            </button>
                          )}
                          {tienePermiso('ventas.outreach.dominios.eliminar') && (
                            deleteConfirm === d.id ? (
                              <>
                                <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={() => handleDelete(d.id)}>Confirmar</button>
                                <button className="ve-btn ve-btn--sm" onClick={() => setDeleteConfirm(null)}>No</button>
                              </>
                            ) : (
                              <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={() => setDeleteConfirm(d.id)}>Eliminar</button>
                            )
                          )}
                        </div>
                      </td>
                    </>
                  )}
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
            <h2>Nuevo Dominio</h2>
            <div className="ve-form-group">
              <label className="ve-label">Dominio</label>
              <input
                type="text"
                className="ve-input"
                placeholder="ejemplo.com"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
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
              <label className="ve-label">Notas</label>
              <textarea
                className="ve-input"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
