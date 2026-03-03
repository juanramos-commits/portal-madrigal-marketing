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
  const [yyyy, mm, dd] = s.split('-').map(Number)
  return new Date(yyyy, mm - 1, dd)
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
      onFechaPersonalizada(parseLocalDate(val), parseLocalDate(hasta))
    }
  }

  const handleHasta = (e) => {
    const val = e.target.value
    setHasta(val)
    if (desde && val && desde <= val) {
      onFechaPersonalizada(parseLocalDate(desde), parseLocalDate(val))
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
          <input type="date" value={desde} onChange={handleDesde} max={hasta || undefined} className="db-input-fecha" />
          <span className="db-fecha-sep">-</span>
          <input type="date" value={hasta} onChange={handleHasta} min={desde || undefined} className="db-input-fecha" />
        </div>
      )}
    </div>
  )
}
