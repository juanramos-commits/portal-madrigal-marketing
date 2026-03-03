import { useState } from 'react'
import { useCalendario } from '../../hooks/useCalendario'
import CalendarioVista, { MESES } from '../../components/ventas/CalendarioVista'
import CalendarioCitaDetalle from '../../components/ventas/CalendarioCitaDetalle'
import CalendarioDisponibilidad from '../../components/ventas/CalendarioDisponibilidad'
import CalendarioBloqueos from '../../components/ventas/CalendarioBloqueos'
import CalendarioConfig from '../../components/ventas/CalendarioConfig'
import CalendarioEnlaces from '../../components/ventas/CalendarioEnlaces'
import CalendarioAdminPanel from '../../components/ventas/CalendarioAdminPanel'
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

function getTabsForRole(esCloser, esSetter, esDirector) {
  const tabs = [{ key: 'calendario', label: 'Calendario' }]

  if (esCloser) {
    tabs.push({ key: 'disponibilidad', label: 'Mi disponibilidad' })
    tabs.push({ key: 'bloqueos', label: 'Mis bloqueos' })
    tabs.push({ key: 'config', label: 'Configuración' })
  }

  if (esDirector) {
    tabs.push({ key: 'equipo', label: 'Gestión de equipo' })
    tabs.push({ key: 'enlaces', label: 'Enlaces de agenda' })
  }

  return tabs
}

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
  const [tab, setTab] = useState('calendario')
  const [citaDetalle, setCitaDetalle] = useState(null)

  const tabs = getTabsForRole(cal.esCloser, cal.esSetter, cal.esDirector)

  const handleClickDia = (fecha) => {
    cal.setFechaActual(fecha)
    cal.setVista('dia')
  }

  const handleClickCita = (cita) => {
    setCitaDetalle(cita)
  }

  const handleVerCalendarioCloser = (closerId) => {
    cal.setCloserFiltro(closerId)
    setTab('calendario')
  }

  return (
    <div className="vc-page">
      {/* Header */}
      <div className="vc-header">
        <h1>Calendario</h1>
      </div>

      {/* Tabs */}
      <div className="vc-tabs" role="tablist" aria-label="Secciones del calendario">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`vc-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Calendar controls - only on calendar tab */}
      {tab === 'calendario' && (
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
              {[{ key: 'semana', label: 'Semana' }, { key: 'mes', label: 'Mes' }, { key: 'dia', label: 'Día' }].map(v => (
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
            {cal.esDirector && cal.closers.length > 0 && (
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
      )}

      {cal.error && <div className="vc-error-msg" role="alert">{cal.error}</div>}

      {/* Main content */}
      {tab === 'calendario' && (
        cal.loading && cal.citas.length === 0 ? (
          <div className="vc-loading">Cargando calendario...</div>
        ) : (
          <CalendarioVista
            vista={cal.vista}
            fechaActual={cal.fechaActual}
            citas={cal.citas}
            bloqueos={cal.bloqueos}
            onClickDia={handleClickDia}
            onClickCita={handleClickCita}
            esDirector={cal.esDirector}
            esBloqueado={cal.esBloqueado}
          />
        )
      )}

      {tab === 'disponibilidad' && cal.esCloser && (
        <CalendarioDisponibilidad
          disponibilidad={cal.disponibilidad}
          onGuardar={cal.guardarDisponibilidad}
          minimoHoras={cal.config?.minimo_horas_semana}
        />
      )}

      {tab === 'bloqueos' && cal.esCloser && (
        <CalendarioBloqueos
          bloqueos={cal.bloqueos}
          onCrear={cal.crearBloqueo}
          onEliminar={cal.eliminarBloqueo}
        />
      )}

      {tab === 'config' && cal.esCloser && (
        <CalendarioConfig
          config={cal.config}
          onGuardar={cal.guardarConfig}
        />
      )}

      {tab === 'equipo' && cal.esDirector && (
        <CalendarioAdminPanel
          cargarClosersConConfig={cal.cargarClosersConConfig}
          onActualizarMinimoHoras={cal.actualizarMinimoHoras}
          onVerCalendario={handleVerCalendarioCloser}
        />
      )}

      {tab === 'enlaces' && cal.esDirector && (
        <CalendarioEnlaces
          enlaces={cal.enlaces}
          setters={cal.setters}
          onCrear={cal.crearEnlace}
          onActualizar={cal.actualizarEnlace}
          onEliminar={cal.eliminarEnlace}
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
