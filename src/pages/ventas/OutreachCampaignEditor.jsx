import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useOutreachCampaigns } from '../../hooks/useOutreachCampaigns'
import { getCampaign, getLists, getInboxes } from '../../lib/coldOutreach'
import '../../styles/ventas-email.css'

const DAYS_OF_WEEK = [
  { value: 'mon', label: 'Lun' },
  { value: 'tue', label: 'Mar' },
  { value: 'wed', label: 'Mié' },
  { value: 'thu', label: 'Jue' },
  { value: 'fri', label: 'Vie' },
  { value: 'sat', label: 'Sáb' },
  { value: 'sun', label: 'Dom' },
]

const STEP_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'delay', label: 'Espera' },
  { value: 'condition', label: 'Condición' },
]

const CONDITION_TYPES = [
  { value: 'opened', label: 'Abierto' },
  { value: 'clicked', label: 'Click' },
  { value: 'replied', label: 'Respondido' },
  { value: 'not_opened', label: 'No abierto' },
  { value: 'not_replied', label: 'No respondido' },
]

const emptyForm = () => ({
  name: '',
  description: '',
  type: 'cold',
  list_id: '',
  inbox_ids: [],
  timezone: 'Europe/Madrid',
  send_window_start: 9,
  send_window_end: 18,
  send_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  daily_limit: 50,
  enable_spintax: false,
  smart_throttle: false,
  send_time_optimization: false,
  ab_testing: false,
  auto_pause_on_reply: true,
})

const emptyStep = (stepNumber) => ({
  step_number: stepNumber,
  type: 'email',
  subject: '',
  body_html: '',
  delay_days: 1,
  delay_hours: 0,
  condition_type: '',
  condition_step_ref: '',
})

export default function OutreachCampaignEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const { crear, actualizar, activar } = useOutreachCampaigns()

  const isNew = !id || id === 'nuevo'
  const [form, setForm] = useState(emptyForm())
  const [steps, setSteps] = useState([emptyStep(1)])
  const [loading, setLoading] = useState(!isNew)
  const [lists, setLists] = useState([])
  const [inboxes, setInboxes] = useState([])

  useEffect(() => {
    if (!isNew) {
      cargarCampana()
    }
    const loadOptions = async () => {
      const [listsRes, inboxesRes] = await Promise.all([getLists(), getInboxes()])
      if (listsRes.data) setLists(listsRes.data)
      if (inboxesRes.data) setInboxes(inboxesRes.data)
    }
    loadOptions()
  }, [id])

  const cargarCampana = async () => {
    try {
      setLoading(true)
      const { data } = await getCampaign(id)
      if (data) {
        setForm({
          name: data.name || '',
          description: data.description || '',
          type: data.type || 'cold',
          list_id: data.list_id || '',
          inbox_ids: data.inbox_ids || [],
          timezone: data.timezone || 'Europe/Madrid',
          send_window_start: data.send_window_start ?? 9,
          send_window_end: data.send_window_end ?? 18,
          send_days: data.send_days || ['mon', 'tue', 'wed', 'thu', 'fri'],
          daily_limit: data.daily_limit ?? 50,
          enable_spintax: data.enable_spintax ?? false,
          smart_throttle: data.smart_throttle ?? false,
          send_time_optimization: data.send_time_optimization ?? false,
          ab_testing: data.ab_testing ?? false,
          auto_pause_on_reply: data.auto_pause_on_reply ?? true,
        })
        if (data.steps?.length) setSteps(data.steps)
      }
    } catch (err) {
      showToast('Error al cargar la campaña', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!tienePermiso('ventas.outreach.campanas.crear')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      send_days: prev.send_days.includes(day)
        ? prev.send_days.filter((d) => d !== day)
        : [...prev.send_days, day],
    }))
  }

  const toggleInbox = (inboxId) => {
    setForm((prev) => ({
      ...prev,
      inbox_ids: prev.inbox_ids.includes(inboxId)
        ? prev.inbox_ids.filter((i) => i !== inboxId)
        : [...prev.inbox_ids, inboxId],
    }))
  }

  const handleStepChange = (index, field, value) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  const agregarPaso = () => {
    setSteps((prev) => [...prev, emptyStep(prev.length + 1)])
  }

  const eliminarPaso = (index) => {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })))
  }

  const handleGuardar = async () => {
    try {
      if (isNew) {
        const result = await crear({ ...form, steps })
        if (result?.error) throw result.error
      } else {
        const result = await actualizar(id, { ...form, steps })
        if (result?.error) throw result.error
      }
      showToast('Campaña guardada correctamente', 'success')
      if (isNew) navigate('/ventas/outreach/campanas')
    } catch (err) {
      showToast(err.message || 'Error al guardar la campaña', 'error')
    }
  }

  const handleActivar = async () => {
    try {
      if (isNew) {
        const result = await crear({ ...form, steps })
        if (result?.error) throw result.error
      } else {
        const result = await actualizar(id, { ...form, steps })
        if (result?.error) throw result.error
        await activar(id)
      }
      showToast('Campaña activada correctamente', 'success')
      navigate('/ventas/outreach/campanas')
    } catch (err) {
      showToast(err.message || 'Error al activar la campaña', 'error')
    }
  }

  if (loading) {
    return (
      <div className="ve-page">
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando campaña...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>{isNew ? 'Nueva Campaña de Outreach' : 'Editar Campaña'}</h1>
      </div>

      {/* General */}
      <div className="ve-section">
        <h2 className="ve-section-title">General</h2>
        <div className="ve-form-grid">
          <div className="ve-form-group">
            <label className="ve-label">Nombre</label>
            <input type="text" className="ve-input" value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Descripción</label>
            <input type="text" className="ve-input" value={form.description} onChange={(e) => handleChange('description', e.target.value)} />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Tipo</label>
            <select className="ve-select" value={form.type} onChange={(e) => handleChange('type', e.target.value)}>
              <option value="cold">Cold</option>
              <option value="warm">Warm</option>
              <option value="follow_up">Follow-up</option>
            </select>
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Lista</label>
            <select className="ve-select" value={form.list_id} onChange={(e) => handleChange('list_id', e.target.value)}>
              <option value="">Seleccionar lista...</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sending Window */}
      <div className="ve-section">
        <h2 className="ve-section-title">Ventana de Envío</h2>
        <div className="ve-form-grid">
          <div className="ve-form-group">
            <label className="ve-label">Zona horaria</label>
            <input type="text" className="ve-input" value={form.timezone} onChange={(e) => handleChange('timezone', e.target.value)} />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Hora inicio</label>
            <input type="number" className="ve-input" value={form.send_window_start} onChange={(e) => handleChange('send_window_start', Number(e.target.value))} min={0} max={23} />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Hora fin</label>
            <input type="number" className="ve-input" value={form.send_window_end} onChange={(e) => handleChange('send_window_end', Number(e.target.value))} min={0} max={23} />
          </div>
          <div className="ve-form-group">
            <label className="ve-label">Límite diario</label>
            <input type="number" className="ve-input" value={form.daily_limit} onChange={(e) => handleChange('daily_limit', Number(e.target.value))} min={1} />
          </div>
        </div>
        <div className="ve-form-group">
          <label className="ve-label">Días de envío</label>
          <div className="ve-actions">
            {DAYS_OF_WEEK.map((d) => (
              <button
                key={d.value}
                className={`ve-btn ve-btn--sm ${form.send_days.includes(d.value) ? 've-btn--primary' : ''}`}
                onClick={() => toggleDay(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inboxes */}
      <div className="ve-section">
        <h2 className="ve-section-title">Bandejas de Envío</h2>
        {inboxes.length === 0 ? (
          <div className="ve-empty">No hay bandejas configuradas.</div>
        ) : (
          <div className="ve-actions">
            {inboxes.map((inbox) => (
              <button
                key={inbox.id}
                className={`ve-btn ve-btn--sm ${form.inbox_ids.includes(inbox.id) ? 've-btn--primary' : ''}`}
                onClick={() => toggleInbox(inbox.id)}
              >
                {inbox.email}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toggles */}
      <div className="ve-section">
        <h2 className="ve-section-title">Opciones Avanzadas</h2>
        <div className="ve-form-grid">
          {[
            { field: 'enable_spintax', label: 'Spintax' },
            { field: 'smart_throttle', label: 'Smart Throttle' },
            { field: 'send_time_optimization', label: 'STO (Send Time Optimization)' },
            { field: 'ab_testing', label: 'A/B Testing' },
            { field: 'auto_pause_on_reply', label: 'Auto-pausa al responder' },
          ].map(({ field, label }) => (
            <div className="ve-form-group" key={field}>
              <label className="ve-label">
                <input
                  type="checkbox"
                  checked={form[field]}
                  onChange={(e) => handleChange(field, e.target.checked)}
                />{' '}
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="ve-section">
        <h2 className="ve-section-title">Pasos de la Secuencia</h2>
        {steps.map((step, idx) => (
          <div key={idx} className="ve-section" style={{ border: '1px solid var(--ve-border, #e2e8f0)', padding: '1rem', marginBottom: '0.75rem' }}>
            <div className="ve-form-grid">
              <div className="ve-form-group">
                <label className="ve-label">Paso {step.step_number} — Tipo</label>
                <select className="ve-select" value={step.type} onChange={(e) => handleStepChange(idx, 'type', e.target.value)}>
                  {STEP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {step.type === 'email' && (
              <div className="ve-form-grid">
                <div className="ve-form-group">
                  <label className="ve-label">Asunto</label>
                  <input type="text" className="ve-input" value={step.subject} onChange={(e) => handleStepChange(idx, 'subject', e.target.value)} placeholder="Usa {spintax|variantes} para variaciones" />
                </div>
                <div className="ve-form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="ve-label">Cuerpo HTML</label>
                  <textarea className="ve-input" rows={6} value={step.body_html} onChange={(e) => handleStepChange(idx, 'body_html', e.target.value)} placeholder="HTML del email. Usa {spintax|variantes} para variaciones." />
                </div>
              </div>
            )}

            {step.type === 'delay' && (
              <div className="ve-form-grid">
                <div className="ve-form-group">
                  <label className="ve-label">Días de espera</label>
                  <input type="number" className="ve-input" value={step.delay_days} onChange={(e) => handleStepChange(idx, 'delay_days', Number(e.target.value))} min={0} />
                </div>
                <div className="ve-form-group">
                  <label className="ve-label">Horas de espera</label>
                  <input type="number" className="ve-input" value={step.delay_hours} onChange={(e) => handleStepChange(idx, 'delay_hours', Number(e.target.value))} min={0} max={23} />
                </div>
              </div>
            )}

            {step.type === 'condition' && (
              <div className="ve-form-grid">
                <div className="ve-form-group">
                  <label className="ve-label">Tipo de condición</label>
                  <select className="ve-select" value={step.condition_type} onChange={(e) => handleStepChange(idx, 'condition_type', e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {CONDITION_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ve-form-group">
                  <label className="ve-label">Referencia al paso</label>
                  <select className="ve-select" value={step.condition_step_ref} onChange={(e) => handleStepChange(idx, 'condition_step_ref', e.target.value)}>
                    <option value="">Seleccionar paso...</option>
                    {steps.filter((_, i) => i < idx).map((s, i) => (
                      <option key={i} value={s.step_number}>Paso {s.step_number}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="ve-actions" style={{ marginTop: '0.5rem' }}>
              <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={() => eliminarPaso(idx)}>Eliminar paso</button>
            </div>
          </div>
        ))}
        <button className="ve-btn ve-btn--sm" onClick={agregarPaso}>Añadir paso</button>
      </div>

      {/* Actions */}
      <div className="ve-actions-bar">
        <button className="ve-btn" onClick={() => navigate('/ventas/outreach/campanas')}>Cancelar</button>
        <button className="ve-btn ve-btn--primary" onClick={handleGuardar}>Guardar</button>
        <button className="ve-btn ve-btn--primary" onClick={handleActivar}>Guardar y Activar</button>
      </div>
    </div>
  )
}
