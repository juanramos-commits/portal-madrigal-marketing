import { useState, useCallback } from 'react'

const STEP_TYPES = [
  { value: 'send_email', label: 'Enviar email', icon: '✉', iconClass: '--send' },
  { value: 'wait', label: 'Esperar', icon: '⏱', iconClass: '--wait' },
  { value: 'condition', label: 'Condición', icon: '⑂', iconClass: '--condition' },
  { value: 'exit', label: 'Salir', icon: '⏹', iconClass: '--exit' },
  { value: 'update_contact', label: 'Actualizar contacto', icon: '✎', iconClass: '--update' },
]

function StepTypeInfo(type) {
  return STEP_TYPES.find(t => t.value === type) || STEP_TYPES[0]
}

function StepConfigForm({ step, onChange }) {
  switch (step.type) {
    case 'send_email':
      return (
        <div className="ve-form-group">
          <label>Plantilla / Asunto</label>
          <input
            className="ve-input"
            placeholder="Asunto del email…"
            value={step.config?.subject || ''}
            onChange={e => onChange({ ...step, config: { ...step.config, subject: e.target.value } })}
          />
        </div>
      )

    case 'wait':
      return (
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div className="ve-form-group" style={{ flex: 1 }}>
            <label>Duración</label>
            <input
              className="ve-input"
              type="number"
              min={1}
              value={step.config?.duration || 1}
              onChange={e => onChange({ ...step, config: { ...step.config, duration: Number(e.target.value) } })}
            />
          </div>
          <div className="ve-form-group" style={{ flex: 1 }}>
            <label>Unidad</label>
            <select
              className="ve-select"
              value={step.config?.unit || 'days'}
              onChange={e => onChange({ ...step, config: { ...step.config, unit: e.target.value } })}
            >
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Días</option>
            </select>
          </div>
        </div>
      )

    case 'condition':
      return (
        <div className="ve-form-group">
          <label>Campo a evaluar</label>
          <input
            className="ve-input"
            placeholder="ej: opened_last_email"
            value={step.config?.field || ''}
            onChange={e => onChange({ ...step, config: { ...step.config, field: e.target.value } })}
          />
        </div>
      )

    case 'update_contact':
      return (
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div className="ve-form-group" style={{ flex: 1 }}>
            <label>Campo</label>
            <input
              className="ve-input"
              placeholder="Campo…"
              value={step.config?.field || ''}
              onChange={e => onChange({ ...step, config: { ...step.config, field: e.target.value } })}
            />
          </div>
          <div className="ve-form-group" style={{ flex: 1 }}>
            <label>Valor</label>
            <input
              className="ve-input"
              placeholder="Valor…"
              value={step.config?.value || ''}
              onChange={e => onChange({ ...step, config: { ...step.config, value: e.target.value } })}
            />
          </div>
        </div>
      )

    case 'exit':
      return (
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', margin: 0 }}>
          El contacto sale de la automatización.
        </p>
      )

    default:
      return null
  }
}

function getStepSummary(step) {
  const cfg = step.config || {}
  switch (step.type) {
    case 'send_email': return cfg.subject || 'Sin asunto'
    case 'wait': return `${cfg.duration || 1} ${cfg.unit === 'hours' ? 'horas' : cfg.unit === 'minutes' ? 'minutos' : 'días'}`
    case 'condition': return cfg.field || 'Sin condición'
    case 'update_contact': return `${cfg.field || '?'} = ${cfg.value || '?'}`
    case 'exit': return 'Fin'
    default: return ''
  }
}

export default function AutomationStepEditor({ steps = [], onChange }) {
  const [editingIdx, setEditingIdx] = useState(null)

  const addStep = useCallback((afterIdx) => {
    const newStep = { type: 'send_email', config: {} }
    const next = [...steps]
    next.splice(afterIdx + 1, 0, newStep)
    onChange(next)
    setEditingIdx(afterIdx + 1)
  }, [steps, onChange])

  const updateStep = useCallback((idx, updated) => {
    const next = steps.map((s, i) => i === idx ? updated : s)
    onChange(next)
  }, [steps, onChange])

  const removeStep = useCallback((idx) => {
    onChange(steps.filter((_, i) => i !== idx))
    if (editingIdx === idx) setEditingIdx(null)
  }, [steps, onChange, editingIdx])

  return (
    <div className="ve-automation-timeline">
      {steps.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <div className="ve-empty"><p>Sin pasos</p></div>
          <button className="ve-automation-add-btn" onClick={() => addStep(-1)} title="Añadir paso">
            +
          </button>
        </div>
      )}

      {steps.map((step, idx) => {
        const info = StepTypeInfo(step.type)
        const isEditing = editingIdx === idx

        return (
          <div key={idx}>
            <div className="ve-automation-step">
              <span className={`ve-automation-step-icon ve-automation-step-icon${info.iconClass}`}>
                {info.icon}
              </span>
              <div className="ve-automation-step-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)' }}>
                  <div>
                    <div className="ve-automation-step-title">{info.label}</div>
                    {!isEditing && (
                      <div className="ve-automation-step-desc">{getStepSummary(step)}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2xs)' }}>
                    <button
                      className="ve-btn ve-btn--icon ve-btn--sm"
                      onClick={() => setEditingIdx(isEditing ? null : idx)}
                      title={isEditing ? 'Cerrar' : 'Editar'}
                    >
                      {isEditing ? '✓' : '✎'}
                    </button>
                    <button
                      className="ve-btn ve-btn--icon ve-btn--sm"
                      onClick={() => removeStep(idx)}
                      title="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div style={{ marginTop: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    <div className="ve-form-group">
                      <label>Tipo de paso</label>
                      <select
                        className="ve-select"
                        value={step.type}
                        onChange={e => updateStep(idx, { ...step, type: e.target.value, config: {} })}
                      >
                        {STEP_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <StepConfigForm step={step} onChange={updated => updateStep(idx, updated)} />
                  </div>
                )}
              </div>
            </div>

            {/* Connector + add button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div className="ve-automation-connector" />
              <button className="ve-automation-add-btn" onClick={() => addStep(idx)} title="Añadir paso">
                +
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
