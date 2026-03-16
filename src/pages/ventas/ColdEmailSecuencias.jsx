import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCESecuencias } from '../../hooks/useCESecuencias'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const ESTADOS = ['todas', 'activa', 'borrador', 'pausada', 'archivada']

const formatNum = (n) => Number(n || 0).toLocaleString('es-ES')
const formatPct = (n) => `${Number(n || 0).toFixed(1)}%`

export default function ColdEmailSecuencias() {
  const { tienePermiso } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [filtroEstado, setFiltroEstado] = useState('todas')

  const {
    secuencias,
    loading,
    error,
    crearSecuencia,
  } = useCESecuencias({ estado: filtroEstado === 'todas' ? null : filtroEstado })

  const handleNueva = async () => {
    try {
      const nueva = await crearSecuencia({ nombre: 'Nueva Secuencia', estado: 'borrador' })
      if (nueva?.id) {
        navigate(`/cold-email/secuencias/${nueva.id}`)
      }
    } catch (err) {
      addToast(`Error al crear secuencia: ${err.message}`, 'error')
    }
  }

  if (!tienePermiso('cold_email.secuencias.ver')) {
    return (
      <div className="ce-page">
        <div className="ce-error" role="alert">No tienes permiso para ver secuencias.</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="ce-page">
        <div className="ce-loading" role="status">
          <div className="ce-spinner" aria-hidden="true" />
          <span>Cargando secuencias...</span>
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
        <h1 className="ce-page-title">Secuencias</h1>
        {tienePermiso('cold_email.secuencias.crear') && (
          <button className="ce-btn ce-btn-primary" onClick={handleNueva}>
            + Nueva Secuencia
          </button>
        )}
      </div>

      {/* Status Filters */}
      <div className="ce-filter-pills">
        {ESTADOS.map((e) => (
          <button
            key={e}
            className={`ce-pill ${filtroEstado === e ? 'ce-pill-active' : ''}`}
            onClick={() => setFiltroEstado(e)}
          >
            {e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {/* Sequences Grid */}
      {secuencias?.length > 0 ? (
        <div className="ce-card-grid">
          {secuencias.map((seq) => (
            <div
              key={seq.id}
              className="ce-sequence-card"
              onClick={() => navigate(`/cold-email/secuencias/${seq.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/cold-email/secuencias/${seq.id}`)}
            >
              <div className="ce-sequence-card-header">
                <h3 className="ce-sequence-card-name">{seq.nombre}</h3>
                <span className={`ce-badge ce-badge-${seq.estado || 'borrador'}`}>
                  {seq.estado || 'borrador'}
                </span>
              </div>

              <div className="ce-sequence-stats">
                <div className="ce-stat">
                  <span className="ce-stat-value">{formatNum(seq.enrollados)}</span>
                  <span className="ce-stat-label">Enrollados</span>
                </div>
                <div className="ce-stat">
                  <span className="ce-stat-value">{formatNum(seq.enviados)}</span>
                  <span className="ce-stat-label">Enviados</span>
                </div>
                <div className="ce-stat">
                  <span className="ce-stat-value">{formatNum(seq.abiertos)}</span>
                  <span className="ce-stat-label">Abiertos</span>
                </div>
                <div className="ce-stat">
                  <span className="ce-stat-value">{formatNum(seq.respondidos)}</span>
                  <span className="ce-stat-label">Respondidos</span>
                </div>
                <div className="ce-stat">
                  <span className="ce-stat-value">{formatPct(seq.tasaRespuesta)}</span>
                  <span className="ce-stat-label">Tasa resp.</span>
                </div>
              </div>

              <div className="ce-sequence-card-footer">
                <span className="ce-text-muted">
                  {seq.cuentas_asignadas || 0} cuenta{seq.cuentas_asignadas !== 1 ? 's' : ''}
                </span>
                <span className="ce-text-muted">
                  {seq.created_at ? new Date(seq.created_at).toLocaleDateString('es-ES') : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ce-empty">
          <div className="ce-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
          </div>
          <p>No hay secuencias{filtroEstado !== 'todas' ? ` con estado "${filtroEstado}"` : ''}.</p>
          {tienePermiso('cold_email.secuencias.crear') && filtroEstado === 'todas' && (
            <button className="ce-btn ce-btn-primary" onClick={handleNueva}>
              Crear primera secuencia
            </button>
          )}
        </div>
      )}
    </div>
  )
}
