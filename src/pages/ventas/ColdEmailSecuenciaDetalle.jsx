import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCESecuencias } from '../../hooks/useCESecuencias'
import { useCEContactos } from '../../hooks/useCEContactos'
import { useCECuentas } from '../../hooks/useCECuentas'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'

const TABS = ['Pasos', 'Enrollments', 'Configuracion', 'Preview', 'Stats']
const DIAS_SEMANA = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

const formatNum = (n) => Number(n || 0).toLocaleString('es-ES')
const formatPct = (n) => `${Number(n || 0).toFixed(1)}%`

export default function ColdEmailSecuenciaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast: addToast } = useToast()
  const { tienePermiso } = useAuth()

  const {
    secuencia,
    pasos,
    enrollments,
    statsSecuencia,
    loading,
    error,
    cargarSecuencia,
    actualizarSecuencia,
    agregarPaso,
    actualizarPaso,
    eliminarPaso,
    reordenarPasos,
    enrollarContactos,
    actualizarEnrollment,
  } = useCESecuencias({ secuenciaId: id })

  const { contactos: contactosList } = useCEContactos({ porPagina: 100 })
  const { cuentas } = useCECuentas()

  const [tab, setTab] = useState('Pasos')
  const [editingName, setEditingName] = useState(false)
  const [nombre, setNombre] = useState('')
  const [editingStep, setEditingStep] = useState(null)
  const [stepForm, setStepForm] = useState({ asunto: '', cuerpo: '', delay_horas: 24 })
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState([])
  const [enrollBusqueda, setEnrollBusqueda] = useState('')
  const [previewContactId, setPreviewContactId] = useState('')
  const [configForm, setConfigForm] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (id) cargarSecuencia(id)
  }, [id, cargarSecuencia])

  useEffect(() => {
    if (secuencia) {
      setNombre(secuencia.nombre || '')
      setConfigForm({
        timezone: secuencia.timezone || 'America/Mexico_City',
        dias_envio: secuencia.dias_envio || [1, 2, 3, 4, 5],
        hora_inicio: secuencia.hora_inicio || '09:00',
        hora_fin: secuencia.hora_fin || '18:00',
        ab_testing: secuencia.ab_testing || false,
        ia_personalizar: secuencia.ia_personalizar || false,
        cuentas_ids: secuencia.cuentas_ids || [],
      })
    }
  }, [secuencia])

  const handleSaveName = async () => {
    try {
      await actualizarSecuencia(id, { nombre })
      setEditingName(false)
      addToast('Nombre actualizado', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleToggleEstado = async (nuevoEstado) => {
    try {
      await actualizarSecuencia(id, { estado: nuevoEstado })
      addToast(`Secuencia ${nuevoEstado}`, 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleAddStep = async () => {
    try {
      await agregarPaso(id, {
        asunto: 'Nuevo paso',
        cuerpo: '',
        delay_horas: 24,
        orden: (pasos?.length || 0) + 1,
      })
      addToast('Paso agregado', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleSaveStep = async () => {
    if (!editingStep) return
    setGuardando(true)
    try {
      await actualizarPaso(editingStep, stepForm)
      setEditingStep(null)
      addToast('Paso guardado', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleDeleteStep = async (pasoId) => {
    if (!window.confirm('Eliminar este paso?')) return
    try {
      await eliminarPaso(pasoId)
      addToast('Paso eliminado', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    }
  }

  const handleEnrollar = async () => {
    if (selectedContactIds.length === 0) return
    setGuardando(true)
    try {
      await enrollarContactos(id, selectedContactIds)
      addToast(`${selectedContactIds.length} contactos enrollados`, 'success')
      setShowEnrollModal(false)
      setSelectedContactIds([])
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!configForm) return
    setGuardando(true)
    try {
      await actualizarSecuencia(id, configForm)
      addToast('Configuracion guardada', 'success')
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  const toggleDia = (dia) => {
    if (!configForm) return
    const dias = configForm.dias_envio.includes(dia)
      ? configForm.dias_envio.filter((d) => d !== dia)
      : [...configForm.dias_envio, dia].sort()
    setConfigForm({ ...configForm, dias_envio: dias })
  }

  const toggleCuenta = (cuentaId) => {
    if (!configForm) return
    const ids = configForm.cuentas_ids.includes(cuentaId)
      ? configForm.cuentas_ids.filter((c) => c !== cuentaId)
      : [...configForm.cuentas_ids, cuentaId]
    setConfigForm({ ...configForm, cuentas_ids: ids })
  }

  const replaceVars = useCallback((text, contact) => {
    if (!text || !contact) return text || ''
    return text
      .replace(/\{\{nombre\}\}/g, contact.nombre || '')
      .replace(/\{\{empresa\}\}/g, contact.empresa || '')
      .replace(/\{\{cargo\}\}/g, contact.cargo || '')
      .replace(/\{\{email\}\}/g, contact.email || '')
  }, [])

  const previewContact = contactosList?.find((c) => c.id === previewContactId) || null

  if (loading) {
    return (
      <div className="ce-page">
        <div className="ce-loading" role="status">
          <div className="ce-spinner" aria-hidden="true" />
          <span>Cargando secuencia...</span>
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

  if (!secuencia) {
    return (
      <div className="ce-page">
        <div className="ce-empty">Secuencia no encontrada.</div>
      </div>
    )
  }

  return (
    <div className="ce-page">
      {/* Back button */}
      <button className="ce-btn-back" onClick={() => navigate('/cold-email/secuencias')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
        Volver a secuencias
      </button>

      {/* Header */}
      <div className="ce-detail-header">
        <div className="ce-detail-header-info">
          {editingName ? (
            <div className="ce-inline-edit">
              <input
                type="text"
                className="ce-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
              />
              <button className="ce-btn ce-btn-sm ce-btn-primary" onClick={handleSaveName}>Guardar</button>
              <button className="ce-btn ce-btn-sm ce-btn-secondary" onClick={() => { setEditingName(false); setNombre(secuencia.nombre) }}>Cancelar</button>
            </div>
          ) : (
            <h1
              className="ce-detail-name ce-editable"
              onClick={() => tienePermiso('cold_email.secuencias.editar') && setEditingName(true)}
              title="Click para editar"
            >
              {secuencia.nombre}
            </h1>
          )}
        </div>
        <div className="ce-detail-header-actions">
          <span className={`ce-badge ce-badge-${secuencia.estado || 'borrador'}`}>
            {secuencia.estado || 'borrador'}
          </span>
          {tienePermiso('cold_email.secuencias.editar') && (
            <>
              {secuencia.estado !== 'activa' && (
                <button className="ce-btn ce-btn-sm ce-btn-success" onClick={() => handleToggleEstado('activa')}>
                  Activar
                </button>
              )}
              {secuencia.estado === 'activa' && (
                <button className="ce-btn ce-btn-sm ce-btn-warning" onClick={() => handleToggleEstado('pausada')}>
                  Pausar
                </button>
              )}
              {secuencia.estado !== 'archivada' && (
                <button className="ce-btn ce-btn-sm ce-btn-secondary" onClick={() => handleToggleEstado('archivada')}>
                  Archivar
                </button>
              )}
            </>
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

      <div className="ce-tab-content">
        {/* =================== PASOS TAB =================== */}
        {tab === 'Pasos' && (
          <div className="ce-steps">
            {pasos?.length > 0 ? (
              <div className="ce-steps-timeline">
                {pasos.map((paso, i) => (
                  <div key={paso.id} className="ce-step-card">
                    <div className="ce-step-badge">
                      <span className="ce-step-number">{i + 1}</span>
                      {paso.delay_horas > 0 && (
                        <span className="ce-step-delay">
                          {paso.delay_horas >= 24
                            ? `${Math.floor(paso.delay_horas / 24)}d`
                            : `${paso.delay_horas}h`}
                        </span>
                      )}
                    </div>

                    {editingStep === paso.id ? (
                      <div className="ce-step-edit">
                        <div className="ce-form-field">
                          <label className="ce-label">Delay (horas)</label>
                          <input
                            type="number"
                            className="ce-input ce-input-sm"
                            value={stepForm.delay_horas}
                            min={0}
                            onChange={(e) => setStepForm({ ...stepForm, delay_horas: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="ce-form-field">
                          <label className="ce-label">Asunto</label>
                          <input
                            type="text"
                            className="ce-input"
                            value={stepForm.asunto}
                            onChange={(e) => setStepForm({ ...stepForm, asunto: e.target.value })}
                          />
                        </div>
                        <div className="ce-form-field">
                          <label className="ce-label">Cuerpo</label>
                          <textarea
                            className="ce-textarea"
                            rows={6}
                            value={stepForm.cuerpo}
                            onChange={(e) => setStepForm({ ...stepForm, cuerpo: e.target.value })}
                          />
                        </div>
                        {paso.ab_variante_b && (
                          <div className="ce-step-ab">
                            <span className="ce-badge ce-badge-info">A/B Testing activo</span>
                          </div>
                        )}
                        <div className="ce-step-edit-actions">
                          <button className="ce-btn ce-btn-sm ce-btn-primary" disabled={guardando} onClick={handleSaveStep}>
                            {guardando ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button className="ce-btn ce-btn-sm ce-btn-secondary" onClick={() => setEditingStep(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="ce-step-preview"
                        onClick={() => {
                          if (!tienePermiso('cold_email.secuencias.editar')) return
                          setEditingStep(paso.id)
                          setStepForm({
                            asunto: paso.asunto || '',
                            cuerpo: paso.cuerpo || '',
                            delay_horas: paso.delay_horas || 0,
                          })
                        }}
                      >
                        <div className="ce-step-asunto">{paso.asunto || '(sin asunto)'}</div>
                        <div className="ce-step-cuerpo-preview">
                          {(paso.cuerpo || '').slice(0, 120)}{(paso.cuerpo || '').length > 120 ? '...' : ''}
                        </div>
                        {paso.ab_variante_b && (
                          <span className="ce-badge ce-badge-info ce-badge-sm">A/B</span>
                        )}
                      </div>
                    )}

                    {tienePermiso('cold_email.secuencias.editar') && editingStep !== paso.id && (
                      <button
                        className="ce-btn-icon ce-btn-danger-icon"
                        title="Eliminar paso"
                        onClick={(e) => { e.stopPropagation(); handleDeleteStep(paso.id) }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="ce-empty">No hay pasos en esta secuencia.</div>
            )}

            {tienePermiso('cold_email.secuencias.editar') && (
              <button className="ce-btn ce-btn-secondary ce-btn-add-step" onClick={handleAddStep}>
                + Agregar paso
              </button>
            )}
          </div>
        )}

        {/* =================== ENROLLMENTS TAB =================== */}
        {tab === 'Enrollments' && (
          <div className="ce-enrollments">
            <div className="ce-section-header">
              <h3>Contactos enrollados</h3>
              {tienePermiso('cold_email.secuencias.editar') && (
                <button className="ce-btn ce-btn-primary ce-btn-sm" onClick={() => setShowEnrollModal(true)}>
                  Enrollar Contactos
                </button>
              )}
            </div>

            {enrollments?.length > 0 ? (
              <div className="ce-table-wrapper">
                <table className="ce-table">
                  <thead>
                    <tr>
                      <th>Contacto</th>
                      <th>Email</th>
                      <th>Estado</th>
                      <th>Paso actual</th>
                      <th>Proximo envio</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((en) => (
                      <tr key={en.id}>
                        <td className="ce-td-name">{en.contacto_nombre || '---'}</td>
                        <td>{en.contacto_email}</td>
                        <td>
                          <span className={`ce-badge ce-badge-${en.estado}`}>{en.estado}</span>
                        </td>
                        <td>{en.paso_actual || '---'}</td>
                        <td className="ce-text-muted">
                          {en.proximo_envio ? new Date(en.proximo_envio).toLocaleString('es-ES') : '---'}
                        </td>
                        <td>
                          <div className="ce-action-btns">
                            {en.estado === 'activo' && (
                              <button
                                className="ce-btn ce-btn-sm ce-btn-warning"
                                onClick={() => actualizarEnrollment(en.id, { estado: 'pausado' })}
                              >
                                Pausar
                              </button>
                            )}
                            {en.estado === 'pausado' && (
                              <button
                                className="ce-btn ce-btn-sm ce-btn-success"
                                onClick={() => actualizarEnrollment(en.id, { estado: 'activo' })}
                              >
                                Reanudar
                              </button>
                            )}
                            <button
                              className="ce-btn ce-btn-sm ce-btn-danger"
                              onClick={() => {
                                if (window.confirm('Remover este contacto del enrollment?')) {
                                  actualizarEnrollment(en.id, { estado: 'removido' })
                                }
                              }}
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ce-empty">No hay contactos enrollados.</div>
            )}

            {/* Enroll Modal */}
            {showEnrollModal && (
              <div className="ce-modal-overlay" onClick={() => setShowEnrollModal(false)}>
                <div className="ce-modal ce-modal-lg" onClick={(e) => e.stopPropagation()}>
                  <div className="ce-modal-header">
                    <h3>Enrollar Contactos</h3>
                    <button className="ce-modal-close" onClick={() => setShowEnrollModal(false)}>&times;</button>
                  </div>
                  <div className="ce-modal-body">
                    <input
                      type="text"
                      className="ce-search-input"
                      placeholder="Buscar contactos..."
                      value={enrollBusqueda}
                      onChange={(e) => setEnrollBusqueda(e.target.value)}
                    />
                    <div className="ce-enroll-list">
                      {(contactosList || [])
                        .filter((c) => {
                          if (!enrollBusqueda) return true
                          const q = enrollBusqueda.toLowerCase()
                          return (
                            (c.nombre || '').toLowerCase().includes(q) ||
                            (c.email || '').toLowerCase().includes(q) ||
                            (c.empresa || '').toLowerCase().includes(q)
                          )
                        })
                        .map((c) => {
                          const selected = selectedContactIds.includes(c.id)
                          return (
                            <label key={c.id} className={`ce-enroll-item ${selected ? 'ce-enroll-item-selected' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  setSelectedContactIds((prev) =>
                                    selected ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                                  )
                                }}
                              />
                              <span>{c.nombre || c.email}</span>
                              <span className="ce-text-muted">{c.email}</span>
                            </label>
                          )
                        })}
                    </div>
                    <p className="ce-text-muted">{selectedContactIds.length} seleccionados</p>
                  </div>
                  <div className="ce-modal-footer">
                    <button className="ce-btn ce-btn-secondary" onClick={() => setShowEnrollModal(false)}>
                      Cancelar
                    </button>
                    <button
                      className="ce-btn ce-btn-primary"
                      disabled={selectedContactIds.length === 0 || guardando}
                      onClick={handleEnrollar}
                    >
                      {guardando ? 'Enrollando...' : `Enrollar (${selectedContactIds.length})`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================== CONFIGURACION TAB =================== */}
        {tab === 'Configuracion' && configForm && (
          <div className="ce-config-form">
            <div className="ce-form-grid">
              <div className="ce-form-field">
                <label className="ce-label">Timezone</label>
                <select
                  className="ce-select"
                  value={configForm.timezone}
                  onChange={(e) => setConfigForm({ ...configForm, timezone: e.target.value })}
                >
                  <option value="America/Mexico_City">America/Mexico_City</option>
                  <option value="America/Bogota">America/Bogota</option>
                  <option value="America/Argentina/Buenos_Aires">America/Buenos_Aires</option>
                  <option value="America/Santiago">America/Santiago</option>
                  <option value="Europe/Madrid">Europe/Madrid</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                </select>
              </div>

              <div className="ce-form-field">
                <label className="ce-label">Dias de envio</label>
                <div className="ce-checkbox-group">
                  {DIAS_SEMANA.map((dia, i) => (
                    <label key={i} className="ce-checkbox-label">
                      <input
                        type="checkbox"
                        checked={configForm.dias_envio.includes(i + 1)}
                        onChange={() => toggleDia(i + 1)}
                      />
                      {dia}
                    </label>
                  ))}
                </div>
              </div>

              <div className="ce-form-field">
                <label className="ce-label">Hora inicio</label>
                <input
                  type="time"
                  className="ce-input"
                  value={configForm.hora_inicio}
                  onChange={(e) => setConfigForm({ ...configForm, hora_inicio: e.target.value })}
                />
              </div>

              <div className="ce-form-field">
                <label className="ce-label">Hora fin</label>
                <input
                  type="time"
                  className="ce-input"
                  value={configForm.hora_fin}
                  onChange={(e) => setConfigForm({ ...configForm, hora_fin: e.target.value })}
                />
              </div>
            </div>

            <div className="ce-form-toggles">
              <label className="ce-toggle-label">
                <input
                  type="checkbox"
                  checked={configForm.ab_testing}
                  onChange={(e) => setConfigForm({ ...configForm, ab_testing: e.target.checked })}
                />
                <span>A/B Testing</span>
              </label>
              <label className="ce-toggle-label">
                <input
                  type="checkbox"
                  checked={configForm.ia_personalizar}
                  onChange={(e) => setConfigForm({ ...configForm, ia_personalizar: e.target.checked })}
                />
                <span>IA personalizar primer email</span>
              </label>
            </div>

            {/* Accounts assignment */}
            <div className="ce-form-section">
              <h3 className="ce-form-section-title">Cuentas asignadas</h3>
              {cuentas?.length > 0 ? (
                <div className="ce-checkbox-group">
                  {cuentas.map((cu) => (
                    <label key={cu.id} className="ce-checkbox-label">
                      <input
                        type="checkbox"
                        checked={configForm.cuentas_ids.includes(cu.id)}
                        onChange={() => toggleCuenta(cu.id)}
                      />
                      {cu.email} ({cu.estado})
                    </label>
                  ))}
                </div>
              ) : (
                <p className="ce-text-muted">No hay cuentas configuradas.</p>
              )}
            </div>

            <div className="ce-form-actions">
              <button
                className="ce-btn ce-btn-primary"
                disabled={guardando}
                onClick={handleSaveConfig}
              >
                {guardando ? 'Guardando...' : 'Guardar configuracion'}
              </button>
            </div>
          </div>
        )}

        {/* =================== PREVIEW TAB =================== */}
        {tab === 'Preview' && (
          <div className="ce-preview">
            <div className="ce-form-field">
              <label className="ce-label">Selecciona un contacto para previsualizar</label>
              <select
                className="ce-select"
                value={previewContactId}
                onChange={(e) => setPreviewContactId(e.target.value)}
              >
                <option value="">-- Seleccionar contacto --</option>
                {(contactosList || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre || c.email} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            {pasos?.length > 0 ? (
              <div className="ce-preview-steps">
                {pasos.map((paso, i) => (
                  <div key={paso.id} className="ce-preview-step">
                    <div className="ce-preview-step-header">
                      <span className="ce-step-number">{i + 1}</span>
                      <span className="ce-step-delay">
                        {paso.delay_horas >= 24
                          ? `Esperar ${Math.floor(paso.delay_horas / 24)} dia(s)`
                          : `Esperar ${paso.delay_horas}h`}
                      </span>
                    </div>
                    <div className="ce-preview-email">
                      <div className="ce-preview-asunto">
                        <strong>Asunto:</strong> {previewContact ? replaceVars(paso.asunto, previewContact) : paso.asunto}
                      </div>
                      <div className="ce-preview-cuerpo">
                        {previewContact ? replaceVars(paso.cuerpo, previewContact) : paso.cuerpo}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ce-empty">No hay pasos para previsualizar.</div>
            )}
          </div>
        )}

        {/* =================== STATS TAB =================== */}
        {tab === 'Stats' && (
          <div className="ce-seq-stats">
            {statsSecuencia ? (
              <>
                <h3 className="ce-section-title">Funnel de conversion</h3>
                <div className="ce-funnel">
                  {[
                    { label: 'Enrollados', value: statsSecuencia.enrollados, color: '#6366f1' },
                    { label: 'Enviados', value: statsSecuencia.enviados, color: '#3b82f6' },
                    { label: 'Abiertos', value: statsSecuencia.abiertos, color: '#22d3ee' },
                    { label: 'Respondidos', value: statsSecuencia.respondidos, color: '#10b981' },
                    { label: 'Interesados', value: statsSecuencia.interesados, color: '#f59e0b' },
                  ].map((step, i) => {
                    const maxVal = Math.max(statsSecuencia.enrollados || 1, 1)
                    const pct = ((step.value || 0) / maxVal) * 100
                    return (
                      <div key={i} className="ce-funnel-step">
                        <div className="ce-funnel-bar-wrapper">
                          <div
                            className="ce-funnel-bar"
                            style={{ width: `${pct}%`, backgroundColor: step.color }}
                          />
                        </div>
                        <div className="ce-funnel-label">
                          <span>{step.label}</span>
                          <span className="ce-funnel-value">{formatNum(step.value)} ({formatPct(pct)})</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {secuencia?.ab_testing && statsSecuencia.ab && (
                  <div className="ce-ab-comparison">
                    <h3 className="ce-section-title">Comparativa A/B</h3>
                    <div className="ce-ab-grid">
                      <div className="ce-ab-col">
                        <h4>Variante A</h4>
                        <p>Enviados: {formatNum(statsSecuencia.ab.a?.enviados)}</p>
                        <p>Abiertos: {formatPct(statsSecuencia.ab.a?.tasaApertura)}</p>
                        <p>Respondidos: {formatPct(statsSecuencia.ab.a?.tasaRespuesta)}</p>
                      </div>
                      <div className="ce-ab-col">
                        <h4>Variante B</h4>
                        <p>Enviados: {formatNum(statsSecuencia.ab.b?.enviados)}</p>
                        <p>Abiertos: {formatPct(statsSecuencia.ab.b?.tasaApertura)}</p>
                        <p>Respondidos: {formatPct(statsSecuencia.ab.b?.tasaRespuesta)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="ce-empty">Sin datos estadisticos disponibles.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
