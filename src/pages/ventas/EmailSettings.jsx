import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEmailSettings } from '../../hooks/useEmailSettings'
import '../../styles/ventas-email.css'

export default function EmailSettings() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const {
    settings,
    warmupSchedule,
    loading,
    loadSettings,
    saveSettings,
    getWarmupSchedule,
  } = useEmailSettings()

  const [form, setForm] = useState({
    from_name: '',
    from_email: '',
    reply_to: '',
    tracking_domain: '',
    max_sends_per_hour: 100,
    frequency_cap_hours: 24,
    warmup_days: 0,
    bounce_threshold: 5,
    complaint_threshold: 0.1,
    sunset_days: 90,
  })

  useEffect(() => {
    loadSettings()
    getWarmupSchedule()
  }, [loadSettings, getWarmupSchedule])

  useEffect(() => {
    if (settings) {
      setForm({
        from_name: settings.from_name || '',
        from_email: settings.from_email || '',
        reply_to: settings.reply_to || '',
        tracking_domain: settings.tracking_domain || '',
        max_sends_per_hour: settings.max_sends_per_hour ?? 100,
        frequency_cap_hours: settings.frequency_cap_hours ?? 24,
        warmup_days: settings.warmup_days ?? 0,
        bounce_threshold: settings.bounce_threshold ?? 5,
        complaint_threshold: settings.complaint_threshold ?? 0.1,
        sunset_days: settings.sunset_days ?? 90,
      })
    }
  }, [settings])

  if (!tienePermiso('ventas.email.ajustes.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const canEdit = tienePermiso('ventas.email.ajustes.editar')

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      await saveSettings(form)
      showToast('Ajustes guardados correctamente', 'success')
    } catch (err) {
      showToast(err.message || 'Error al guardar los ajustes', 'error')
    }
  }

  if (loading) {
    return (
      <div className="ve-page">
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando ajustes...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Ajustes de Email</h1>
      </div>

      {/* General Section */}
      <div className="ve-section">
        <h2 className="ve-section-title">General</h2>
        <div className="ve-form-grid">
          <div className="ve-form-group">
            <label className="ve-label">Nombre del remitente</label>
            <input
              type="text"
              className="ve-input"
              value={form.from_name}
              onChange={(e) => handleChange('from_name', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Email del remitente</label>
            <input
              type="email"
              className="ve-input"
              value={form.from_email}
              onChange={(e) => handleChange('from_email', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Reply-to</label>
            <input
              type="email"
              className="ve-input"
              value={form.reply_to}
              onChange={(e) => handleChange('reply_to', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Dominio de tracking</label>
            <input
              type="text"
              className="ve-input"
              value={form.tracking_domain}
              onChange={(e) => handleChange('tracking_domain', e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>
      </div>

      {/* Sending Section */}
      <div className="ve-section">
        <h2 className="ve-section-title">Envío</h2>
        <div className="ve-form-grid">
          <div className="ve-form-group">
            <label className="ve-label">Máx. envíos por hora</label>
            <input
              type="number"
              className="ve-input"
              value={form.max_sends_per_hour}
              onChange={(e) => handleChange('max_sends_per_hour', Number(e.target.value))}
              disabled={!canEdit}
              min={1}
            />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Frecuencia mínima (horas)</label>
            <input
              type="number"
              className="ve-input"
              value={form.frequency_cap_hours}
              onChange={(e) => handleChange('frequency_cap_hours', Number(e.target.value))}
              disabled={!canEdit}
              min={1}
            />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Días de warmup</label>
            <input
              type="number"
              className="ve-input"
              value={form.warmup_days}
              onChange={(e) => handleChange('warmup_days', Number(e.target.value))}
              disabled={!canEdit}
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Thresholds Section */}
      <div className="ve-section">
        <h2 className="ve-section-title">Umbrales</h2>
        <div className="ve-form-grid">
          <div className="ve-form-group">
            <label className="ve-label">Umbral de rebote (%)</label>
            <input
              type="number"
              className="ve-input"
              value={form.bounce_threshold}
              onChange={(e) => handleChange('bounce_threshold', Number(e.target.value))}
              disabled={!canEdit}
              min={0}
              step={0.1}
            />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Umbral de quejas (%)</label>
            <input
              type="number"
              className="ve-input"
              value={form.complaint_threshold}
              onChange={(e) => handleChange('complaint_threshold', Number(e.target.value))}
              disabled={!canEdit}
              min={0}
              step={0.01}
            />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Días de sunset</label>
            <input
              type="number"
              className="ve-input"
              value={form.sunset_days}
              onChange={(e) => handleChange('sunset_days', Number(e.target.value))}
              disabled={!canEdit}
              min={1}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      {canEdit && (
        <div className="ve-actions-bar">
          <button className="ve-btn ve-btn--primary" onClick={handleSave}>
            Guardar ajustes
          </button>
        </div>
      )}

      {/* Warmup Schedule */}
      {warmupSchedule && warmupSchedule.length > 0 && (
        <div className="ve-section">
          <h2 className="ve-section-title">Calendario de Warmup</h2>
          <div className="ve-table-wrapper">
            <table className="ve-table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Envíos máximos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {warmupSchedule.map((row, idx) => (
                  <tr key={idx} className="ve-table-row">
                    <td>Día {row.day}</td>
                    <td>{row.max_sends}</td>
                    <td>
                      <span className={`ve-badge ${row.completed ? 've-badge--green' : 've-badge--gray'}`}>
                        {row.completed ? 'Completado' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
