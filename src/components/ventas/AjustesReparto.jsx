import { useState, useEffect } from 'react'

export default function AjustesReparto({
  repartoConfig,
  setters,
  onCargarReparto,
  onGuardarReparto,
}) {
  const [config, setConfig] = useState([])
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { onCargarReparto() }, [])

  useEffect(() => {
    if (setters.length > 0) {
      const map = {}
      for (const r of repartoConfig) {
        map[r.usuario_id] = r.porcentaje || 0
      }
      setConfig(setters.map(s => ({
        usuario_id: s.usuario_id || s.id,
        nombre: s.usuario?.nombre || s.nombre || s.email || 'Sin nombre',
        porcentaje: map[s.usuario_id || s.id] || 0,
      })))
    }
  }, [setters, repartoConfig])

  const total = config.reduce((sum, c) => sum + Number(c.porcentaje || 0), 0)
  const esValido = total === 100

  const handleChange = (idx, value) => {
    setConfig(prev => prev.map((c, i) => i === idx ? { ...c, porcentaje: Number(value) || 0 } : c))
    setGuardado(false)
  }

  const handleGuardar = async () => {
    if (!esValido) return
    setSaving(true)
    setError(null)
    try {
      await onGuardarReparto(config.map(c => ({
        usuario_id: c.usuario_id,
        porcentaje: c.porcentaje,
      })))
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="aj-seccion">
      <h3>Reparto de leads</h3>
      <p className="aj-desc">Configura el porcentaje de leads que recibe cada setter.</p>

      {config.length === 0 ? (
        <div className="aj-empty">No hay setters activos</div>
      ) : (
        <div className="aj-form">
          {config.map((c, i) => (
            <div key={c.usuario_id} className="aj-reparto-row">
              <span className="aj-reparto-name">{c.nombre}</span>
              <div className="aj-reparto-input">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={c.porcentaje}
                  onChange={e => handleChange(i, e.target.value)}
                />
                <span>%</span>
              </div>
              <div className="aj-reparto-bar" role="progressbar" aria-valuenow={Math.min(c.porcentaje, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.nombre}: ${c.porcentaje}%`}>
                <div className="aj-reparto-bar-fill" style={{ width: `${Math.min(c.porcentaje, 100)}%` }} />
              </div>
            </div>
          ))}

          <div className="aj-reparto-total">
            <span className="aj-reparto-total-label">Total</span>
            <span className={`aj-reparto-total-value ${esValido ? 'valid' : 'invalid'}`}>
              {total}% {esValido ? '' : '(debe ser 100%)'}
            </span>
          </div>

          {error && <div className="aj-error">{error}</div>}

          <div className="aj-actions">
            <button className="aj-btn-primary" onClick={handleGuardar} disabled={saving || !esValido}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            {guardado && <span className="aj-success">Reparto guardado</span>}
          </div>
        </div>
      )}
    </div>
  )
}
