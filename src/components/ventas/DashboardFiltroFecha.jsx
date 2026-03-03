import { useState, useEffect } from 'react'

const OPCIONES = [
  { value: 'este_mes', label: 'Este mes' },
  { value: 'mes_pasado', label: 'Mes pasado' },
  { value: 'ultimos_7', label: 'Últimos 7 días' },
  { value: 'ultimos_30', label: 'Últimos 30 días' },
  { value: 'ultimos_90', label: 'Últimos 90 días' },
  { value: 'este_ano', label: 'Este año' },
  { value: 'personalizado', label: 'Personalizado' },
]

function formatInputDate(d) {
  if (!d) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseLocalDate(s) {
  if (!s || typeof s !== 'string') return null
  const parts = s.split('-').map(Number)
  if (parts.length < 3 || parts.some(Number.isNaN)) return null
  return new Date(parts[0], parts[1] - 1, parts[2])
}

export default function DashboardFiltroFecha({
  periodo, onPeriodoChange, fechaInicio, fechaFin, onFechaPersonalizada,
}) {
  const [desde, setDesde] = useState(fechaInicio ? formatInputDate(fechaInicio) : '')
  const [hasta, setHasta] = useState(fechaFin ? formatInputDate(fechaFin) : '')

  useEffect(() => {
    if (fechaInicio) setDesde(formatInputDate(fechaInicio))
    if (fechaFin) setHasta(formatInputDate(fechaFin))
  }, [fechaInicio, fechaFin])

  const handleSelect = (e) => {
    const val = e.target.value
    onPeriodoChange(val)
  }

  const handleDesde = (e) => {
    const val = e.target.value
    setDesde(val)
    if (val && hasta && val <= hasta) {
      const d1 = parseLocalDate(val), d2 = parseLocalDate(hasta)
      if (d1 && d2) onFechaPersonalizada(d1, d2)
    }
  }

  const handleHasta = (e) => {
    const val = e.target.value
    setHasta(val)
    if (desde && val && desde <= val) {
      const d1 = parseLocalDate(desde), d2 = parseLocalDate(val)
      if (d1 && d2) onFechaPersonalizada(d1, d2)
    }
  }

  return (
    <div className="db-filtro-fecha">
      <select value={periodo} onChange={handleSelect} className="db-select-periodo" aria-label="Periodo de tiempo">
        {OPCIONES.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {periodo === 'personalizado' && (
        <div className="db-fechas-custom">
          <input type="date" value={desde} onChange={handleDesde} max={hasta || undefined} className="db-input-fecha" aria-label="Fecha de inicio" />
          <span className="db-fecha-sep" aria-hidden="true">-</span>
          <input type="date" value={hasta} onChange={handleHasta} min={desde || undefined} className="db-input-fecha" aria-label="Fecha de fin" />
        </div>
      )}
    </div>
  )
}
