import { useState, useEffect } from 'react'
import Select from '../ui/Select'

const OPCIONES = [
  { value: 'este_mes', label: 'Este mes' },
  { value: 'mes_pasado', label: 'Mes pasado' },
  { value: 'ultimos_7', label: 'Ultimos 7 dias' },
  { value: 'ultimos_30', label: 'Ultimos 30 dias' },
  { value: 'ultimos_90', label: 'Ultimos 90 dias' },
  { value: 'este_ano', label: 'Este ano' },
  { value: 'personalizado', label: 'Personalizado' },
]

function formatInputDate(d) {
  if (!d) return ''
  return d.toISOString().split('T')[0]
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
      onFechaPersonalizada(new Date(val), new Date(hasta))
    }
  }

  const handleHasta = (e) => {
    const val = e.target.value
    setHasta(val)
    if (desde && val && desde <= val) {
      onFechaPersonalizada(new Date(desde), new Date(val))
    }
  }

  return (
    <div className="db-filtro-fecha">
      <Select value={periodo} onChange={handleSelect} className="db-select-periodo">
        {OPCIONES.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
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
