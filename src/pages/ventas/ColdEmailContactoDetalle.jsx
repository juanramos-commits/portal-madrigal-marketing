import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCEContactos } from '../../hooks/useCEContactos'
import { useToast } from '../../contexts/ToastContext'

const TABS = ['Info', 'Historial', 'Notas']

export default function ColdEmailContactoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast: addToast } = useToast()

  const { cargarDetalle, actualizar } = useCEContactos()

  const [contacto, setContacto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [tab, setTab] = useState('Info')
  const [editData, setEditData] = useState(null)
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const loadContacto = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await cargarDetalle(id)
      setContacto(data)
      setEditData({
        nombre: data.nombre || '',
        email: data.email || '',
        empresa: data.empresa || '',
        cargo: data.cargo || '',
        telefono: data.telefono || '',
        categoria: data.categoria || '',
        zona: data.zona || '',
        etiquetas: (data.etiquetas || []).join(', '),
        campos_custom: data.campos_custom || {},
      })
      setNotas(data.notas || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id, cargarDetalle])

  useEffect(() => {
    loadContacto()
  }, [loadContacto])

  const handleSaveInfo = async () => {
    if (!editData) return
    setGuardando(true)
    try {
      await actualizar(id, {
        nombre: editData.nombre,
        email: editData.email,
        empresa: editData.empresa,
        cargo: editData.cargo,
        telefono: editData.telefono,
        categoria: editData.categoria,
        zona: editData.zona,
        etiquetas: editData.etiquetas
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        campos_custom: editData.campos_custom,
      })
      addToast('Contacto actualizado', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleSaveNotas = async () => {
    setGuardando(true)
    try {
      await actualizar(id, { notas })
      addToast('Notas guardadas', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="ce-page">
        <div className="ce-loading" role="status">
          <div className="ce-spinner" aria-hidden="true" />
          <span>Cargando contacto...</span>
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

  if (!contacto) {
    return (
      <div className="ce-page">
        <div className="ce-empty">Contacto no encontrado.</div>
      </div>
    )
  }

  return (
    <div className="ce-page">
      {/* Back button */}
      <button className="ce-btn-back" onClick={() => navigate('/cold-email/contactos')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
        Volver a contactos
      </button>

      {/* Header */}
      <div className="ce-detail-header">
        <div className="ce-detail-header-info">
          <div className="ce-avatar-lg">
            {(contacto.nombre || contacto.email || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="ce-detail-name">{contacto.nombre || contacto.email}</h1>
            <p className="ce-detail-sub">{contacto.email}</p>
            {contacto.empresa && <p className="ce-detail-sub">{contacto.empresa}</p>}
          </div>
        </div>
        <div className="ce-detail-header-actions">
          <span className={`ce-badge ce-badge-${contacto.estado || 'activo'}`}>
            {contacto.estado || 'activo'}
          </span>
          {contacto.crm_lead_id && (
            <Link to={`/ventas/crm/leads/${contacto.crm_lead_id}`} className="ce-btn ce-btn-secondary ce-btn-sm">
              Ver en CRM
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="ce-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`ce-tab ${tab === t ? 'ce-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="ce-tab-content">
        {/* Info Tab */}
        {tab === 'Info' && editData && (
          <div className="ce-form">
            <div className="ce-form-grid">
              <div className="ce-form-field">
                <label className="ce-label">Nombre</label>
                <input
                  type="text"
                  className="ce-input"
                  value={editData.nombre}
                  onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                />
              </div>
              <div className="ce-form-field">
                <label className="ce-label">Email</label>
                <input
                  type="email"
                  className="ce-input"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                />
              </div>
              <div className="ce-form-field">
                <label className="ce-label">Empresa</label>
                <input
                  type="text"
                  className="ce-input"
                  value={editData.empresa}
                  onChange={(e) => setEditData({ ...editData, empresa: e.target.value })}
                />
              </div>
              <div className="ce-form-field">
                <label className="ce-label">Cargo</label>
                <input
                  type="text"
                  className="ce-input"
                  value={editData.cargo}
                  onChange={(e) => setEditData({ ...editData, cargo: e.target.value })}
                />
              </div>
              <div className="ce-form-field">
                <label className="ce-label">Telefono</label>
                <input
                  type="tel"
                  className="ce-input"
                  value={editData.telefono}
                  onChange={(e) => setEditData({ ...editData, telefono: e.target.value })}
                />
              </div>
              <div className="ce-form-field">
                <label className="ce-label">Categoria</label>
                <input
                  type="text"
                  className="ce-input"
                  value={editData.categoria}
                  onChange={(e) => setEditData({ ...editData, categoria: e.target.value })}
                />
              </div>
              <div className="ce-form-field">
                <label className="ce-label">Zona</label>
                <input
                  type="text"
                  className="ce-input"
                  value={editData.zona}
                  onChange={(e) => setEditData({ ...editData, zona: e.target.value })}
                />
              </div>
              <div className="ce-form-field">
                <label className="ce-label">Etiquetas (separadas por coma)</label>
                <input
                  type="text"
                  className="ce-input"
                  value={editData.etiquetas}
                  onChange={(e) => setEditData({ ...editData, etiquetas: e.target.value })}
                />
              </div>
            </div>

            {/* Custom fields */}
            {editData.campos_custom && Object.keys(editData.campos_custom).length > 0 && (
              <div className="ce-form-section">
                <h3 className="ce-form-section-title">Campos personalizados</h3>
                <div className="ce-form-grid">
                  {Object.entries(editData.campos_custom).map(([key, value]) => (
                    <div key={key} className="ce-form-field">
                      <label className="ce-label">{key}</label>
                      <input
                        type="text"
                        className="ce-input"
                        value={value || ''}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            campos_custom: { ...editData.campos_custom, [key]: e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="ce-form-actions">
              <button
                className="ce-btn ce-btn-primary"
                disabled={guardando}
                onClick={handleSaveInfo}
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}

        {/* Historial Tab */}
        {tab === 'Historial' && (
          <div className="ce-timeline">
            {contacto?.ce_envios?.length > 0 ? (
              contacto.ce_envios.map((e, i) => (
                <div key={e.id || i} className="ce-timeline-item">
                  <div className="ce-timeline-dot" />
                  <div className="ce-timeline-content">
                    <div className="ce-timeline-header">
                      <span className={`ce-badge ce-badge-${e.estado || 'info'}`}>{e.estado}</span>
                      <span className="ce-timeline-date">
                        {e.created_at ? new Date(e.created_at).toLocaleString('es-ES') : ''}
                      </span>
                    </div>
                    <p className="ce-timeline-text">
                      {e.ce_pasos?.asunto_a || e.ce_pasos?.asunto_b || 'Envio'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="ce-empty">Sin historial de envios para este contacto.</div>
            )}
          </div>
        )}

        {/* Notas Tab */}
        {tab === 'Notas' && (
          <div className="ce-notas">
            <textarea
              className="ce-textarea"
              rows={10}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Escribe notas sobre este contacto..."
            />
            <div className="ce-form-actions">
              <button
                className="ce-btn ce-btn-primary"
                disabled={guardando}
                onClick={handleSaveNotas}
              >
                {guardando ? 'Guardando...' : 'Guardar notas'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
