import { useState, useCallback } from 'react'

export default function ABTestPanel({ campaign, variants = [], results, onGenerateSubjects, onChange }) {
  const [enabled, setEnabled] = useState(!!(campaign?.ab_enabled || variants.length > 0))
  const [localVariants, setLocalVariants] = useState(
    variants.length > 0 ? variants : [{ subject: '' }, { subject: '' }]
  )
  const [testSize, setTestSize] = useState(campaign?.ab_test_size || 20)
  const [duration, setDuration] = useState(campaign?.ab_duration || '4h')

  const notify = useCallback((updates) => {
    if (onChange) onChange(updates)
  }, [onChange])

  const updateVariant = useCallback((idx, subject) => {
    setLocalVariants(prev => {
      const next = prev.map((v, i) => i === idx ? { ...v, subject } : v)
      notify({ ab_variants: next })
      return next
    })
  }, [notify])

  const addVariant = useCallback(() => {
    setLocalVariants(prev => {
      const next = [...prev, { subject: '' }]
      notify({ ab_variants: next })
      return next
    })
  }, [notify])

  const removeVariant = useCallback((idx) => {
    if (localVariants.length <= 2) return
    setLocalVariants(prev => {
      const next = prev.filter((_, i) => i !== idx)
      notify({ ab_variants: next })
      return next
    })
  }, [localVariants.length, notify])

  return (
    <div className="ve-ab-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3>Test A/B</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => { setEnabled(e.target.checked); notify({ ab_testing: e.target.checked }) }}
            style={{ width: 16, height: 16, accentColor: '#2ee59d' }}
          />
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>Activar</span>
        </label>
      </div>

      {enabled && (
        <>
          {/* Variants */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {localVariants.map((v, idx) => {
              const letter = String.fromCharCode(65 + idx)
              const result = results?.[idx]
              const isWinner = result?.is_winner

              return (
                <div key={idx} className={`ve-ab-variant ${isWinner ? 've-ab-winner' : ''}`}>
                  <span className="ve-ab-variant-label">{letter}</span>
                  <input
                    className="ve-input"
                    placeholder={`Asunto variante ${letter}…`}
                    value={v.subject}
                    onChange={e => updateVariant(idx, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {result && (
                    <div className="ve-ab-stats">
                      <span>Envíos: <strong>{result.sends?.toLocaleString('es-ES') ?? '—'}</strong></span>
                      <span>Aperturas: <strong>{result.opens?.toLocaleString('es-ES') ?? '—'}</strong></span>
                      <span>Tasa: <strong>{result.open_rate != null ? result.open_rate + '%' : '—'}</strong></span>
                      <span>Clics: <strong>{result.clicks?.toLocaleString('es-ES') ?? '—'}</strong></span>
                      {isWinner && <span className="ve-badge ve-badge--success">Ganador</span>}
                    </div>
                  )}
                  {localVariants.length > 2 && (
                    <button className="ve-btn ve-btn--icon ve-btn--sm" onClick={() => removeVariant(idx)} title="Eliminar variante">
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button className="ve-btn ve-btn--secondary ve-btn--sm" onClick={addVariant}>
              + Variante
            </button>
            {onGenerateSubjects && (
              <button className="ve-btn ve-btn--primary ve-btn--sm" onClick={onGenerateSubjects}>
                Generar con IA
              </button>
            )}
          </div>

          {/* Config */}
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="ve-form-group" style={{ flex: 1, minWidth: 140 }}>
              <label>Tamaño de prueba: {testSize}%</label>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={testSize}
                onChange={e => { setTestSize(Number(e.target.value)); notify({ ab_test_size: Number(e.target.value) }) }}
                style={{ width: '100%', accentColor: '#2ee59d' }}
              />
            </div>

            <div className="ve-form-group" style={{ flex: 1, minWidth: 140 }}>
              <label>Duración</label>
              <select className="ve-select" value={duration} onChange={e => { setDuration(e.target.value); notify({ ab_duration: e.target.value }) }}>
                <option value="1h">1 hora</option>
                <option value="2h">2 horas</option>
                <option value="4h">4 horas</option>
                <option value="8h">8 horas</option>
                <option value="12h">12 horas</option>
                <option value="24h">24 horas</option>
              </select>
            </div>
          </div>

          {/* Results Table */}
          {results && results.length > 0 && (
            <div>
              <h4 style={{
                fontSize: 'var(--font-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-muted)',
                marginBottom: 'var(--space-sm)',
              }}>
                Resultados
              </h4>
              <table className="ve-table">
                <thead>
                  <tr>
                    <th>Variante</th>
                    <th>Envíos</th>
                    <th>Aperturas</th>
                    <th>Tasa apertura</th>
                    <th>Clics</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={idx}>
                      <td>{String.fromCharCode(65 + idx)}</td>
                      <td>{r.sends?.toLocaleString('es-ES') ?? '—'}</td>
                      <td>{r.opens?.toLocaleString('es-ES') ?? '—'}</td>
                      <td>{r.open_rate != null ? r.open_rate + '%' : '—'}</td>
                      <td>{r.clicks?.toLocaleString('es-ES') ?? '—'}</td>
                      <td>{r.is_winner && <span className="ve-badge ve-badge--success">Ganador</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
