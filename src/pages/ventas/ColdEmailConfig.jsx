import { useState, useEffect } from 'react'
import { useCECuentas } from '../../hooks/useCECuentas'
import { useCEConfig } from '../../hooks/useCEConfig'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const TABS_CONFIG = ['Cuentas', 'Blacklist', 'General']
const TIPOS_BLACKLIST = ['dominio', 'email']

const emptyCuentaForm = {
  nombre: '',
  email: '',
  resend_api_key: '',
  warmup_activo: true,
  warmup_max: 50,
  limite_diario: 50,
}

const emptyBlacklistForm = {
  tipo: 'dominio',
  valor: '',
  motivo: '',
}

export default function ColdEmailConfig() {
  const { tienePermiso } = useAuth()
  const { addToast } = useToast()

  const {
    cuentas,
    loading: cuentasLoading,
    error: cuentasError,
    crearCuenta,
    actualizarCuenta,
    eliminarCuenta,
  } = useCECuentas()

  const {
    config,
    blacklist,
    loading: configLoading,
    error: configError,
    actualizarConfig,
    agregarBlacklist,
    eliminarBlacklist,
  } = useCEConfig()

  const [tab, setTab] = useState('Cuentas')
  const [showCuentaModal, setShowCuentaModal] = useState(false)
  const [editingCuentaId, setEditingCuentaId] = useState(null)
  const [cuentaForm, setCuentaForm] = useState({ ...emptyCuentaForm })
  const [blacklistForm, setBlacklistForm] = useState({ ...emptyBlacklistForm })
  const [generalForm, setGeneralForm] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (config) {
      setGeneralForm({
        pausa_global: config.pausa_global || false,
        bounce_threshold: config.bounce_threshold ?? 5,
        complaint_threshold: config.complaint_threshold ?? 0.1,
        delay_min_seg: config.delay_min_seg ?? 60,
        delay_max_seg: config.delay_max_seg ?? 300,
        max_por_dominio: config.max_por_dominio ?? 3,
      })
    }
  }, [config])

  const loading = cuentasLoading || configLoading
  const error = cuentasError || configError

  const openNewCuenta = () => {
    setEditingCuentaId(null)
    setCuentaForm({ ...emptyCuentaForm })
    setShowCuentaModal(true)
  }

  const openEditCuenta = (cuenta) => {
    setEditingCuentaId(cuenta.id)
    setCuentaForm({
      nombre: cuenta.nombre || '',
      email: cuenta.email || '',
      resend_api_key: cuenta.resend_api_key || '',
      warmup_activo: cuenta.warmup_activo ?? true,
      warmup_max: cuenta.warmup_max ?? 50,
      limite_diario: cuenta.limite_diario ?? 50,
    })
    setShowCuentaModal(true)
  }

  const handleSaveCuenta = async () => {
    if (!cuentaForm.email.trim()) {
      addToast('Email es requerido', 'error')
      return
    }
    setGuardando(true)
    try {
      if (editingCuentaId) {
        await actualizarCuenta(editingCuentaId, cuentaForm)
        addToast('Cuenta actualizada', 'success')
      } else {
        await crearCuenta(cuentaForm)
        addToast('Cuenta creada', 'success')
      }
      setShowCuentaModal(false)
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleToggleCuenta = async (cuenta, nuevoEstado) => {
    try {
      await actualizarCuenta(cuenta.id, { estado: nuevoEstado })
      addToast(`Cuenta ${nuevoEstado}`, 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleAddBlacklist = async () => {
    if (!blacklistForm.valor.trim()) {
      addToast('Valor es requerido', 'error')
      return
    }
    setGuardando(true)
    try {
      await agregarBlacklist(blacklistForm)
      addToast('Entrada agregada a blacklist', 'success')
      setBlacklistForm({ ...emptyBlacklistForm })
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleDeleteBlacklist = async (id) => {
    try {
      await eliminarBlacklist(id)
      addToast('Entrada eliminada', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleSaveGeneral = async () => {
    if (!generalForm) return
    setGuardando(true)
    try {
      await actualizarConfig(generalForm)
      addToast('Configuracion guardada', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  if (!tienePermiso('cold_email.config.ver')) {
    return (
      <div className="ce-page">
        <div className="ce-error" role="alert">No tienes permiso para ver la configuracion.</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="ce-page">
        <div className="ce-loading" role="status">
          <div className="ce-spinner" aria-hidden="true" />
          <span>Cargando configuracion...</span>
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
        <h1 className="ce-page-title">Configuracion</h1>
      </div>

      {/* Tabs */}
      <div className="ce-tabs">
        {TABS_CONFIG.map((t) => (
          <button
            key={t}
            className={`ce-tab ${tab === t ? 'ce-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="ce-tab-content">
        {/* =================== CUENTAS TAB =================== */}
        {tab === 'Cuentas' && (
          <div className="ce-cuentas">
            <div className="ce-section-header">
              <h3>Cuentas de envio</h3>
              {tienePermiso('cold_email.config.editar') && (
                <button className="ce-btn ce-btn-primary ce-btn-sm" onClick={openNewCuenta}>
                  + Nueva Cuenta
                </button>
              )}
            </div>

            {cuentas?.length > 0 ? (
              <div className="ce-card-grid">
                {cuentas.map((cuenta) => {
                  const warmupDias = cuenta.warmup_dia_actual || 0
                  const warmupMax = cuenta.warmup_max || 50
                  const warmupPct = warmupMax > 0 ? Math.min((warmupDias / Math.ceil(warmupMax / 2)) * 100, 100) : 0
                  const healthScore = cuenta.health_score ?? null

                  return (
                    <div key={cuenta.id} className="ce-account-card">
                      <div className="ce-account-card-header">
                        <div>
                          <h4 className="ce-account-email">{cuenta.email}</h4>
                          {cuenta.nombre && <span className="ce-text-muted">{cuenta.nombre}</span>}
                          {cuenta.dominio && <span className="ce-text-muted"> | {cuenta.dominio}</span>}
                        </div>
                        <span className={`ce-badge ce-badge-${cuenta.estado || 'activa'}`}>
                          {cuenta.estado || 'activa'}
                        </span>
                      </div>

                      {/* Warmup progress */}
                      {cuenta.warmup_activo && (
                        <div className="ce-account-warmup">
                          <div className="ce-warmup-header">
                            <span className="ce-text-muted">Warm-up</span>
                            <span className="ce-text-muted">Dia {warmupDias}</span>
                          </div>
                          <div className="ce-warmup-bar">
                            <div className="ce-warmup-fill" style={{ width: `${warmupPct}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Health score */}
                      {healthScore != null && (
                        <div className="ce-account-health">
                          <span className="ce-text-muted">Salud (7d):</span>
                          <span className={`ce-health-score ${healthScore >= 80 ? 'ce-health-good' : healthScore >= 50 ? 'ce-health-warn' : 'ce-health-bad'}`}>
                            {healthScore}%
                          </span>
                        </div>
                      )}

                      {/* Send stats */}
                      <div className="ce-account-stats">
                        <span className="ce-text-muted">
                          Hoy: {cuenta.enviados_hoy || 0} / {cuenta.limite_diario || '---'}
                        </span>
                      </div>

                      {/* Actions */}
                      {tienePermiso('cold_email.config.editar') && (
                        <div className="ce-account-actions">
                          <button
                            className="ce-btn ce-btn-sm ce-btn-secondary"
                            onClick={() => openEditCuenta(cuenta)}
                          >
                            Editar
                          </button>
                          {cuenta.estado === 'activa' && (
                            <button
                              className="ce-btn ce-btn-sm ce-btn-warning"
                              onClick={() => handleToggleCuenta(cuenta, 'pausada')}
                            >
                              Pausar
                            </button>
                          )}
                          {cuenta.estado === 'pausada' && (
                            <button
                              className="ce-btn ce-btn-sm ce-btn-success"
                              onClick={() => handleToggleCuenta(cuenta, 'activa')}
                            >
                              Activar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="ce-empty">
                <div className="ce-empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 9.5h20"/></svg>
                </div>
                <p>No hay cuentas configuradas.</p>
                {tienePermiso('cold_email.config.editar') && (
                  <button className="ce-btn ce-btn-primary" onClick={openNewCuenta}>
                    Agregar primera cuenta
                  </button>
                )}
              </div>
            )}

            {/* Cuenta Modal */}
            {showCuentaModal && (
              <div className="ce-modal-overlay" onClick={() => setShowCuentaModal(false)}>
                <div className="ce-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="ce-modal-header">
                    <h3>{editingCuentaId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
                    <button className="ce-modal-close" onClick={() => setShowCuentaModal(false)}>&times;</button>
                  </div>
                  <div className="ce-modal-body">
                    <div className="ce-form-grid">
                      <div className="ce-form-field">
                        <label className="ce-label">Nombre</label>
                        <input
                          type="text"
                          className="ce-input"
                          value={cuentaForm.nombre}
                          onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })}
                          placeholder="Nombre identificador"
                        />
                      </div>
                      <div className="ce-form-field">
                        <label className="ce-label">Email</label>
                        <input
                          type="email"
                          className="ce-input"
                          value={cuentaForm.email}
                          onChange={(e) => setCuentaForm({ ...cuentaForm, email: e.target.value })}
                          placeholder="email@dominio.com"
                        />
                      </div>
                    </div>

                    <div className="ce-form-field">
                      <label className="ce-label">Resend API Key</label>
                      <input
                        type="password"
                        className="ce-input"
                        value={cuentaForm.resend_api_key}
                        onChange={(e) => setCuentaForm({ ...cuentaForm, resend_api_key: e.target.value })}
                        placeholder="re_..."
                      />
                    </div>

                    <div className="ce-form-grid">
                      <div className="ce-form-field">
                        <label className="ce-label">Limite diario</label>
                        <input
                          type="number"
                          className="ce-input"
                          min={1}
                          value={cuentaForm.limite_diario}
                          onChange={(e) => setCuentaForm({ ...cuentaForm, limite_diario: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="ce-form-field">
                        <label className="ce-label">Warmup max (emails/dia)</label>
                        <input
                          type="number"
                          className="ce-input"
                          min={1}
                          value={cuentaForm.warmup_max}
                          onChange={(e) => setCuentaForm({ ...cuentaForm, warmup_max: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>

                    <label className="ce-toggle-label">
                      <input
                        type="checkbox"
                        checked={cuentaForm.warmup_activo}
                        onChange={(e) => setCuentaForm({ ...cuentaForm, warmup_activo: e.target.checked })}
                      />
                      <span>Warmup activo</span>
                    </label>
                  </div>
                  <div className="ce-modal-footer">
                    <button className="ce-btn ce-btn-secondary" onClick={() => setShowCuentaModal(false)}>
                      Cancelar
                    </button>
                    <button
                      className="ce-btn ce-btn-primary"
                      disabled={guardando}
                      onClick={handleSaveCuenta}
                    >
                      {guardando ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================== BLACKLIST TAB =================== */}
        {tab === 'Blacklist' && (
          <div className="ce-blacklist">
            {tienePermiso('cold_email.config.editar') && (
              <div className="ce-blacklist-form">
                <div className="ce-form-inline">
                  <select
                    className="ce-select ce-select-sm"
                    value={blacklistForm.tipo}
                    onChange={(e) => setBlacklistForm({ ...blacklistForm, tipo: e.target.value })}
                  >
                    {TIPOS_BLACKLIST.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="ce-input"
                    value={blacklistForm.valor}
                    onChange={(e) => setBlacklistForm({ ...blacklistForm, valor: e.target.value })}
                    placeholder={blacklistForm.tipo === 'dominio' ? 'ejemplo.com' : 'user@ejemplo.com'}
                  />
                  <input
                    type="text"
                    className="ce-input"
                    value={blacklistForm.motivo}
                    onChange={(e) => setBlacklistForm({ ...blacklistForm, motivo: e.target.value })}
                    placeholder="Motivo (opcional)"
                  />
                  <button
                    className="ce-btn ce-btn-primary ce-btn-sm"
                    disabled={!blacklistForm.valor.trim() || guardando}
                    onClick={handleAddBlacklist}
                  >
                    Anadir
                  </button>
                </div>
              </div>
            )}

            {blacklist?.length > 0 ? (
              <div className="ce-table-wrapper">
                <table className="ce-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Motivo</th>
                      <th>Fecha</th>
                      {tienePermiso('cold_email.config.editar') && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {blacklist.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <span className="ce-badge ce-badge-info">{b.tipo}</span>
                        </td>
                        <td className="ce-td-name">{b.valor}</td>
                        <td className="ce-text-muted">{b.motivo || '---'}</td>
                        <td className="ce-text-muted">
                          {b.created_at ? new Date(b.created_at).toLocaleDateString('es-ES') : '---'}
                        </td>
                        {tienePermiso('cold_email.config.editar') && (
                          <td>
                            <button
                              className="ce-btn ce-btn-sm ce-btn-danger"
                              onClick={() => handleDeleteBlacklist(b.id)}
                            >
                              Eliminar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ce-empty">
                <div className="ce-empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                </div>
                <p>No hay entradas en la blacklist.</p>
              </div>
            )}
          </div>
        )}

        {/* =================== GENERAL TAB =================== */}
        {tab === 'General' && generalForm && (
          <div className="ce-general-config">
            <div className="ce-form-toggles">
              <label className="ce-toggle-label ce-toggle-label-lg">
                <input
                  type="checkbox"
                  checked={generalForm.pausa_global}
                  onChange={(e) => setGeneralForm({ ...generalForm, pausa_global: e.target.checked })}
                />
                <span>Pausa global</span>
                <span className="ce-text-muted">Detiene todos los envios mientras este activa</span>
              </label>
            </div>

            <div className="ce-form-grid">
              <div className="ce-form-field">
                <label className="ce-label">Bounce threshold (%)</label>
                <input
                  type="number"
                  className="ce-input"
                  min={0}
                  max={100}
                  step={0.1}
                  value={generalForm.bounce_threshold}
                  onChange={(e) => setGeneralForm({ ...generalForm, bounce_threshold: parseFloat(e.target.value) || 0 })}
                />
                <span className="ce-help-text">Porcentaje maximo de rebotes antes de pausar cuenta</span>
              </div>

              <div className="ce-form-field">
                <label className="ce-label">Complaint threshold (%)</label>
                <input
                  type="number"
                  className="ce-input"
                  min={0}
                  max={100}
                  step={0.01}
                  value={generalForm.complaint_threshold}
                  onChange={(e) => setGeneralForm({ ...generalForm, complaint_threshold: parseFloat(e.target.value) || 0 })}
                />
                <span className="ce-help-text">Porcentaje maximo de quejas antes de pausar cuenta</span>
              </div>

              <div className="ce-form-field">
                <label className="ce-label">Delay minimo entre envios (seg)</label>
                <input
                  type="number"
                  className="ce-input"
                  min={0}
                  value={generalForm.delay_min_seg}
                  onChange={(e) => setGeneralForm({ ...generalForm, delay_min_seg: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="ce-form-field">
                <label className="ce-label">Delay maximo entre envios (seg)</label>
                <input
                  type="number"
                  className="ce-input"
                  min={0}
                  value={generalForm.delay_max_seg}
                  onChange={(e) => setGeneralForm({ ...generalForm, delay_max_seg: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="ce-form-field">
                <label className="ce-label">Max emails por dominio por dia</label>
                <input
                  type="number"
                  className="ce-input"
                  min={1}
                  value={generalForm.max_por_dominio}
                  onChange={(e) => setGeneralForm({ ...generalForm, max_por_dominio: parseInt(e.target.value) || 1 })}
                />
                <span className="ce-help-text">Limite de emails enviados al mismo dominio en un dia</span>
              </div>
            </div>

            <div className="ce-form-actions">
              <button
                className="ce-btn ce-btn-primary"
                disabled={guardando}
                onClick={handleSaveGeneral}
              >
                {guardando ? 'Guardando...' : 'Guardar configuracion'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
