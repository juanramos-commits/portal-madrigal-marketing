import { useState } from 'react'
import { useCalendario } from '../../hooks/useCalendario'
import { useAuth } from '../../contexts/AuthContext'
import CalendarioVista, { MESES } from '../../components/ventas/CalendarioVista'
import CalendarioCitaDetalle from '../../components/ventas/CalendarioCitaDetalle'
import Select from '../../components/ui/Select'
import '../../styles/ventas-calendario.css'

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vc-icon-nav" aria-hidden="true">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vc-icon-nav" aria-hidden="true">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

function formatTituloNav(vista, fecha) {
  if (vista === 'mes') {
    return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`
  }
  if (vista === 'semana') {
    const d = new Date(fecha)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const lunes = new Date(d)
    lunes.setDate(d.getDate() + diff)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    const fmtL = lunes.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const fmtD = domingo.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${fmtL} - ${fmtD}`
  }
  return fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function VentasCalendario() {
  const cal = useCalendario()
  const { tienePermiso } = useAuth()
  const [citaDetalle, setCitaDetalle] = useState(null)

  const handleClickDia = (fecha) => {
    cal.setFechaActual(fecha)
    cal.setVista('dia')
  }

  const handleClickCita = (cita) => {
    if (cita._isGoogleEvent) {
      // Open Google Calendar event in new tab
      if (cita.html_link) window.open(cita.html_link, '_blank')
      return
    }
    setCitaDetalle(cita)
  }

  return (
    <div className="vc-page">
      {/* Header */}
      <div className="vc-header">
        <h1>Calendario</h1>
      </div>

      {/* Calendar controls */}
      <div className="vc-controles">
        <div className="vc-nav">
          <button className="vc-nav-btn" onClick={cal.irAnterior} aria-label="Periodo anterior"><ChevronLeft /></button>
          <button className="vc-nav-hoy" onClick={cal.irHoy}>Hoy</button>
          <button className="vc-nav-btn" onClick={cal.irSiguiente} aria-label="Periodo siguiente"><ChevronRight /></button>
          <span className="vc-nav-titulo">{formatTituloNav(cal.vista, cal.fechaActual)}</span>
        </div>

        <div className="vc-controles-right">
          {/* Vista selector */}
          <div className="vc-vista-selector" role="group" aria-label="Tipo de vista">
            {[{ key: 'semana', label: 'Semana' }, { key: 'mes', label: 'Mes' }, { key: 'dia', label: 'Dia' }].map(v => (
              <button
                key={v.key}
                className={`vc-vista-btn${cal.vista === v.key ? ' active' : ''}`}
                onClick={() => cal.setVista(v.key)}
                aria-pressed={cal.vista === v.key}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Closer filter (admin only) */}
          {tienePermiso('ventas.calendario.reasignar') && cal.closers.length > 0 && (
            <Select
              value={cal.closerFiltro || ''}
              onChange={e => cal.setCloserFiltro(e.target.value || null)}
            >
              <option value="">Todos los closers</option>
              {cal.closers.map(c => (
                <option key={c.id} value={c.id}>{c.nombre || c.email}</option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {cal.error && <div className="vc-error-msg" role="alert">{cal.error}</div>}

      {/* Calendar view */}
      {cal.loading && cal.citas.length === 0 ? (
        <div className="vc-loading">Cargando calendario...</div>
      ) : (
        <CalendarioVista
          vista={cal.vista}
          fechaActual={cal.fechaActual}
          citas={cal.eventosMerged}
          bloqueos={cal.bloqueos}
          onClickDia={handleClickDia}
          onClickCita={handleClickCita}
          esDirector={cal.esDirector}
          esBloqueado={cal.esBloqueado}
        />
      )}

      {/* Cita detail modal */}
      {citaDetalle && (
        <CalendarioCitaDetalle
          cita={citaDetalle}
          reunionEstados={cal.reunionEstados}
          closers={cal.closers}
          esCloser={cal.esCloser}
          esDirector={cal.esDirector}
          esSetter={cal.esSetter}
          onClose={() => setCitaDetalle(null)}
          onActualizarEstado={cal.actualizarEstadoCita}
          onActualizarNotas={cal.actualizarNotasCita}
          onActualizarEnlaceGrabacion={cal.actualizarEnlaceGrabacion}
          onCancelar={cal.cancelarCita}
          onReasignarCloser={cal.reasignarCloser}
        />
      )}
    </div>
  )
}
