import { useState } from 'react'
import { Check, X } from 'lucide-react'
import Modal from '../ui/Modal'
import { formatMoneda, formatFecha } from '../../utils/formatters'
import WalletTableSkeleton from './WalletTableSkeleton'

const estadoConfig = {
  pendiente: { label: 'Pendiente', className: 'wt-badge-pendiente' },
  aprobado: { label: 'Aprobado', className: 'wt-badge-aprobado' },
  rechazado: { label: 'Rechazado', className: 'wt-badge-rechazado' },
}

const tabs = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: 'rechazado', label: 'Rechazados' },
  { key: 'todos', label: 'Todos' },
]

export default function WalletAdminRetiros({
  retiros,
  filtro,
  onFiltroChange,
  contadores,
  onAprobar,
  onRechazar,
  loading,
}) {
  const [modal, setModal] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)

  const handleAprobar = async (retiroId) => {
    setSubmitting(true)
    setModalError(null)
    try {
      await onAprobar(retiroId)
      setModal(null)
    } catch (err) {
      setModalError(err.message || 'Error al aprobar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRechazar = async (retiroId) => {
    if (!motivo.trim()) { setModalError('El motivo es obligatorio'); return }
    setSubmitting(true)
    setModalError(null)
    try {
      await onRechazar(retiroId, motivo)
      setModal(null)
      setMotivo('')
    } catch (err) {
      setModalError(err.message || 'Error al rechazar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="wt-admin-retiros">
      {/* Tabs */}
      <div className="wt-tabs-mini">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`wt-tab-mini${filtro === t.key ? ' active' : ''}`}
            onClick={() => onFiltroChange(t.key)}
          >
            {t.label} ({contadores[t.key] || 0})
          </button>
        ))}
      </div>

      {loading && retiros.length === 0 ? (
        <WalletTableSkeleton rows={5} cols={6} />
      ) : retiros.length === 0 ? (
        <div className="wt-empty">No hay retiros</div>
      ) : (
        <>
          {/* Desktop */}
          <div className="wt-desktop-only">
            <div className="wt-table-wrap">
              <table className="wt-table">
                <thead>
                  <tr>
                    <th>Miembro</th>
                    <th>Fecha</th>
                    <th>Importe</th>
                    <th>IBAN</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {retiros.map(r => {
                    const estado = estadoConfig[r.estado] || estadoConfig.pendiente
                    return (
                      <tr key={r.id}>
                        <td className="wt-cell-bold">{r.usuario?.nombre || r.usuario?.email || '-'}</td>
                        <td>{formatFecha(r.created_at)}</td>
                        <td className="wt-cell-bold">{formatMoneda(r.monto)}</td>
                        <td className="wt-cell-small">{r.cuenta_bancaria_iban || '-'}</td>
                        <td><span className={`wt-badge ${estado.className}`}>{estado.label}</span></td>
                        <td>
                          {r.estado === 'pendiente' && (
                            <div className="wt-actions-cell">
                              <button className="wt-action-btn wt-action-approve" onClick={() => setModal({ type: 'aprobar', retiro: r })}>
                                <Check size={14} /> Aprobar
                              </button>
                              <button className="wt-action-btn wt-action-reject" onClick={() => setModal({ type: 'rechazar', retiro: r })}>
                                <X size={14} /> Rechazar
                              </button>
                            </div>
                          )}
                          {r.estado !== 'pendiente' && '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="wt-mobile-only">
            {retiros.map(r => {
              const estado = estadoConfig[r.estado] || estadoConfig.pendiente
              return (
                <div key={r.id} className="wt-admin-card">
                  <div className="wt-admin-card-top">
                    <span className={`wt-badge ${estado.className}`}>{estado.label}</span>
                    <span className="wt-amount-bold">{formatMoneda(r.monto)}</span>
                  </div>
                  <div className="wt-cell-title">{r.usuario?.nombre || '-'}</div>
                  <div className="wt-admin-card-meta">
                    <span>{formatFecha(r.created_at)}</span>
                    <span className="wt-cell-small">{r.cuenta_bancaria_iban || '-'}</span>
                  </div>
                  {r.estado === 'pendiente' && (
                    <div className="wt-admin-card-actions">
                      <button className="wt-action-btn wt-action-approve" onClick={() => setModal({ type: 'aprobar', retiro: r })}>
                        <Check size={14} /> Aprobar
                      </button>
                      <button className="wt-action-btn wt-action-reject" onClick={() => setModal({ type: 'rechazar', retiro: r })}>
                        <X size={14} /> Rechazar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal aprobar */}
      <Modal
        open={modal?.type === 'aprobar'}
        onClose={() => setModal(null)}
        title="Aprobar retiro"
        size="sm"
        footer={
          <>
            <button className="wt-btn-ghost" onClick={() => setModal(null)} disabled={submitting}>Cancelar</button>
            <button className="wt-btn-success" onClick={() => handleAprobar(modal?.retiro?.id)} disabled={submitting}>
              {submitting ? 'Aprobando...' : 'Aprobar'}
            </button>
          </>
        }
      >
        <p>
          ¿Aprobar el retiro de <strong>{formatMoneda(modal?.retiro?.monto)}</strong> para <strong>{modal?.retiro?.usuario?.nombre || '-'}</strong>?
        </p>
        <p className="wt-modal-hint">Se generará la factura automáticamente.</p>
        {modalError && <div className="wt-error-general">{modalError}</div>}
      </Modal>

      {/* Modal rechazar */}
      <Modal
        open={modal?.type === 'rechazar'}
        onClose={() => { setModal(null); setMotivo('') }}
        title="Rechazar retiro"
        size="sm"
        footer={
          <>
            <button className="wt-btn-ghost" onClick={() => { setModal(null); setMotivo('') }} disabled={submitting}>Cancelar</button>
            <button className="wt-btn-danger" onClick={() => handleRechazar(modal?.retiro?.id)} disabled={submitting}>
              {submitting ? 'Rechazando...' : 'Rechazar'}
            </button>
          </>
        }
      >
        <p>
          ¿Rechazar el retiro de <strong>{formatMoneda(modal?.retiro?.monto)}</strong> para <strong>{modal?.retiro?.usuario?.nombre || '-'}</strong>?
        </p>
        <div className="wt-field">
          <label>Motivo del rechazo *</label>
          <textarea value={motivo} onChange={e => { setMotivo(e.target.value); setModalError(null) }} rows={3} placeholder="Escribe el motivo..." />
        </div>
        {modalError && <div className="wt-error-general">{modalError}</div>}
      </Modal>
    </div>
  )
}
