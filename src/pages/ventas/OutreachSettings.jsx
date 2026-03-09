import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useOutreachSettings } from '../../hooks/useOutreachSettings'
import '../../styles/ventas-email.css'

export default function OutreachSettings() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const {
    settings,
    warmupSchedule,
    suppressionCount,
    loading,
    cargar,
    actualizar,
    actualizarWarmup,
  } = useOutreachSettings()

  const [form, setForm] = useState({
    default_timezone: 'Europe/Madrid',
    frequency_cap_hours: 24,
    bounce_threshold: 5,
    complaint_threshold: 0.1,
    auto_pause_enabled: true,
  })

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (settings) {
      setForm({
        default_timezone: settings.default_timezone || 'Europe/Madrid',
        frequency_cap_hours: settings.frequency_cap_hours ?? 24,
        bounce_threshold: settings.bounce_threshold ?? 5,
        complaint_threshold: settings.complaint_threshold ?? 0.1,
        auto_pause_enabled: settings.auto_pause_enabled ?? true,
      })
    }
  }, [settings])

  if (!tienePermiso('ventas.outreach.ajustes.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const canEdit = tienePermiso('ventas.outreach.ajustes.editar')

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleWarmupChange = (index, field, value) => {
    // handled via actualizarWarmup on save
  }

  const handleSave = async () => {
    try {
      const entries = Object.entries(form)
      for (const [key, value] of entries) {
        const result = await actualizar(key, value)
        if (result?.error) throw result.error
      }
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
        <h1>Ajustes de Outreach</h1>
      </div>

      {/* General Section */}
      <div className="ve-section">
        <h2 className="ve-section-title">General</h2>
        <div className="ve-form-grid">
          <div className="ve-form-group">
            <label className="ve-label">Zona horaria por defecto</label>
            <input
              type="text"
              className="ve-input"
              value={form.default_timezone}
              onChange={(e) => handleChange('default_timezone', e.target.value)}
              disabled={!canEdit}
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
        </div>
      </div>

      {/* Safety Section */}
      <div className="ve-section">
        <h2 className="ve-section-title">Seguridad</h2>
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
            <label className="ve-label">
              <input
                type="checkbox"
                checked={form.auto_pause_enabled}
                onChange={(e) => handleChange('auto_pause_enabled', e.target.checked)}
                disabled={!canEdit}
              />{' '}
              Auto-pausa al superar umbrales
            </label>
          </div>
        </div>
      </div>

      {/* Warmup Schedule */}
      <div className="ve-section">
        <h2 className="ve-section-title">Calendario de Warmup</h2>
        {warmupSchedule && warmupSchedule.length > 0 ? (
          <div className="ve-table-wrapper">
            <table className="ve-table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Envíos máximos</th>
                </tr>
              </thead>
              <tbody>
                {warmupSchedule.map((row, idx) => (
                  <tr key={idx} className="ve-table-row">
                    <td>Día {row.day}</td>
                    <td>
                      {canEdit ? (
                        <input
                          type="number"
                          className="ve-input"
                          value={row.max_sends}
                          onChange={(e) => actualizarWarmup(idx, Number(e.target.value))}
                          min={1}
                          style={{ maxWidth: '120px' }}
                        />
                      ) : (
                        row.max_sends
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ve-empty">No hay calendario de warmup configurado.</div>
        )}
      </div>

      {/* Suppressions */}
      <div className="ve-section">
        <h2 className="ve-section-title">Supresiones</h2>
        <div className="ve-form-grid">
          <div className="ve-form-group">
            <label className="ve-label">Emails suprimidos</label>
            <div className="ve-input" style={{ background: 'transparent', fontWeight: 'bold' }}>
              {suppressionCount ?? 0}
            </div>
          </div>
          <div className="ve-form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="ve-btn ve-btn--sm"
              onClick={() => navigate('/ventas/outreach/supresiones')}
            >
              Ver supresiones
            </button>
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
    </div>
  )
}
