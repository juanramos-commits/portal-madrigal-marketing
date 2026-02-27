import { useState } from 'react'

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

  const handleSelect = (e) => {
    const val = e.target.value
    onPeriodoChange(val)
  }

  const handleDesde = (e) => {
    const val = e.target.value
    setDesde(val)
    if (val && hasta) {
      onFechaPersonalizada(new Date(val), new Date(hasta))
    }
  }

  const handleHasta = (e) => {
    const val = e.target.value
    setHasta(val)
    if (desde && val) {
      onFechaPersonalizada(new Date(desde), new Date(val))
    }
  }

  return (
    <div className="db-filtro-fecha">
      <select value={periodo} onChange={handleSelect} className="db-select-periodo">
        {OPCIONES.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {periodo === 'personalizado' && (
        <div className="db-fechas-custom">
          <input type="date" value={desde} onChange={handleDesde} className="db-input-fecha" />
          <span className="db-fecha-sep">-</span>
          <input type="date" value={hasta} onChange={handleHasta} className="db-input-fecha" />
        </div>
      )}
    </div>
  )
}
