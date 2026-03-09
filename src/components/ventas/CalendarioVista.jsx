import { useMemo } from 'react'
import CalendarioCita, { getColorCita } from './CalendarioCita'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DIAS_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function esMismoDia(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function esHoy(d) {
  return esMismoDia(d, new Date())
}

function obtenerLunesSemana(fecha) {
  const d = new Date(fecha)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const lunes = new Date(d)
  lunes.setDate(d.getDate() + diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

function generarDiasMes(fecha) {
  const year = fecha.getFullYear()
  const month = fecha.getMonth()
  const primerDia = new Date(year, month, 1)
  const ultimoDia = new Date(year, month + 1, 0)

  let startDay = primerDia.getDay()
  if (startDay === 0) startDay = 7
  startDay -= 1

  const dias = []
  // Previous month days
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    dias.push({ date: d, esOtroMes: true })
  }
  // Current month days
  for (let i = 1; i <= ultimoDia.getDate(); i++) {
    dias.push({ date: new Date(year, month, i), esOtroMes: false })
  }
  // Fill remaining
  const remaining = 7 - (dias.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      dias.push({ date: new Date(year, month + 1, i), esOtroMes: true })
    }
  }

  return dias
}

function generarHoras(inicio, fin) {
  const horas = []
  for (let h = inicio; h < fin; h++) {
    horas.push(`${String(h).padStart(2, '0')}:00`)
  }
  return horas
}

// ─── VISTA MENSUAL ──────────────────────────────────────────────────
function VistaMensual({ fechaActual, citas, bloqueos, onClickDia, onClickCita, esDirector }) {
  const dias = useMemo(() => generarDiasMes(fechaActual), [fechaActual.getFullYear(), fechaActual.getMonth()])

  const citasPorDia = useMemo(() => {
    const map = {}
    for (const c of citas) {
      const d = new Date(c.fecha_hora)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(c)
    }
    return map
  }, [citas])

  return (
    <div className="vc-mes">
      <div className="vc-mes-header">
        {DIAS_CORTOS.map(d => <div key={d} className="vc-mes-dia-nombre">{d}</div>)}
      </div>
      <div className="vc-mes-grid">
        {dias.map((dia, i) => {
          const key = `${dia.date.getFullYear()}-${dia.date.getMonth()}-${dia.date.getDate()}`
          const citasDia = citasPorDia[key] || []
          const hoy = esHoy(dia.date)
          return (
            <div
              key={key}
              className={`vc-mes-celda${dia.esOtroMes ? ' vc-otro-mes' : ''}${hoy ? ' vc-hoy' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onClickDia(dia.date)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickDia(dia.date) } }}
            >
              <span className={`vc-mes-numero${hoy ? ' vc-hoy-numero' : ''}`}>{dia.date.getDate()}</span>
              <div className="vc-mes-citas">
                {/* Desktop: bar mode */}
                <div className="vc-desktop-only">
                  {citasDia.slice(0, 3).map(c => (
                    <CalendarioCita key={c.id} cita={c} onClick={onClickCita} mostrarCloser={esDirector} />
                  ))}
                  {citasDia.length > 3 && <span className="vc-mes-mas">+{citasDia.length - 3} más</span>}
                </div>
                {/* Mobile: dots */}
                <div className="vc-mobile-only">
                  <div className="vc-mes-dots">
                    {citasDia.slice(0, 4).map(c => (
                      <CalendarioCita key={c.id} cita={c} onClick={onClickCita} compacto />
                    ))}
                    {citasDia.length > 4 && <span className="vc-mes-dot-count">+{citasDia.length - 4}</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Helper: get event duration in minutes ─────────────────────────
function getDuracionMinutos(c) {
  if (c._isGoogleEvent) {
    const start = new Date(c.start_time || c.fecha_hora).getTime()
    const end = c.end_time ? new Date(c.end_time).getTime() : NaN
    if (isNaN(start) || isNaN(end)) return 60
    return Math.max(15, (end - start) / 60000)
  }
  return c.duracion_minutos || 60
}

// ─── VISTA SEMANAL ──────────────────────────────────────────────────
const HORA_INICIO = 7
const HORA_FIN = 22
const HORA_HEIGHT = 48 // px per hour slot

function VistaSemanal({ fechaActual, citas, bloqueos, onClickCita, esDirector, esBloqueado }) {
  const horas = useMemo(() => generarHoras(HORA_INICIO, HORA_FIN), [])
  const lunes = useMemo(() => obtenerLunesSemana(fechaActual), [fechaActual])

  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      return d
    })
  }, [lunes])

  // Group events by day
  const citasPorDia = useMemo(() => {
    const map = {}
    for (const c of citas) {
      const d = new Date(c.fecha_hora)
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map[dayKey]) map[dayKey] = []
      map[dayKey].push(c)
    }
    return map
  }, [citas])

  const ahora = new Date()
  const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes()
  const totalHoras = HORA_FIN - HORA_INICIO

  return (
    <div className="vc-semana">
      <div className="vc-semana-header">
        <div className="vc-semana-hora-col" />
        {diasSemana.map((d, i) => (
          <div key={i} className={`vc-semana-dia-header${esHoy(d) ? ' vc-hoy' : ''}`}>
            <span className="vc-semana-dia-nombre">{DIAS_CORTOS[i]}</span>
            <span className={`vc-semana-dia-num${esHoy(d) ? ' vc-hoy-numero' : ''}`}>{d.getDate()}</span>
          </div>
        ))}
      </div>
      <div className="vc-semana-body">
        {/* Hour grid lines */}
        <div className="vc-semana-grid" style={{ height: totalHoras * HORA_HEIGHT }}>
          <div className="vc-semana-hora-labels">
            {horas.map(hora => (
              <div key={hora} className="vc-semana-hora-label" style={{ height: HORA_HEIGHT }}>
                {hora}
              </div>
            ))}
          </div>
          {diasSemana.map((d, di) => {
            const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
            const citasDia = citasPorDia[dayKey] || []
            const mostrarLinea = esHoy(d)

            return (
              <div key={di} className="vc-semana-dia-col">
                {/* Hour grid lines */}
                {horas.map((hora, hi) => (
                  <div key={hora} className="vc-semana-celda-bg" style={{ height: HORA_HEIGHT }} />
                ))}
                {/* Current time line */}
                {mostrarLinea && ahoraMinutos >= HORA_INICIO * 60 && ahoraMinutos < HORA_FIN * 60 && (
                  <div
                    className="vc-linea-ahora"
                    style={{ top: ((ahoraMinutos - HORA_INICIO * 60) / (totalHoras * 60)) * 100 + '%' }}
                  />
                )}
                {/* Events positioned absolutely */}
                {citasDia.map(c => {
                  const startDate = new Date(c.fecha_hora)
                  const startMin = startDate.getHours() * 60 + startDate.getMinutes()
                  const durMin = getDuracionMinutos(c)
                  const topPx = ((startMin - HORA_INICIO * 60) / 60) * HORA_HEIGHT
                  const heightPx = Math.max(14, (durMin / 60) * HORA_HEIGHT)

                  return (
                    <button
                      key={c._isGoogleEvent ? `g-${c.id}` : c.id}
                      className={`vc-semana-event${c._isGoogleEvent ? ' vc-google-event' : ''}${c.estado === 'cancelada' ? ' vc-cita-cancelada' : ''}`}
                      style={{
                        top: topPx,
                        height: heightPx,
                        borderLeftColor: c._isGoogleEvent ? '#4285f4' : (c.estado_reunion?.color || 'var(--status-onboarding-text)'),
                      }}
                      onClick={e => { e.stopPropagation(); onClickCita(c) }}
                      aria-label={`${c.lead?.nombre || 'Sin nombre'}`}
                    >
                      <span className="vc-semana-event-time">
                        {startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                      <span className="vc-semana-event-name">{c.lead?.nombre || 'Sin nombre'}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── VISTA DIARIA ───────────────────────────────────────────────────
function VistaDiaria({ fechaActual, citas, bloqueos, onClickCita, esDirector, esBloqueado }) {
  const horas = useMemo(() => generarHoras(7, 22), [])

  const citasPorHora = useMemo(() => {
    const map = {}
    for (const c of citas) {
      const h = new Date(c.fecha_hora).getHours()
      if (!map[h]) map[h] = []
      map[h].push(c)
    }
    return map
  }, [citas])

  const ahora = new Date()
  const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes()
  const esHoyFlag = esHoy(fechaActual)

  return (
    <div className="vc-dia">
      <div className="vc-dia-header">
        <span className="vc-dia-titulo">
          {DIAS_NOMBRES[fechaActual.getDay() === 0 ? 6 : fechaActual.getDay() - 1]}, {fechaActual.getDate()} de {MESES[fechaActual.getMonth()]}
        </span>
      </div>
      <div className="vc-dia-body">
        {horas.map(hora => {
          const h = parseInt(hora)
          const citasHora = citasPorHora[h] || []
          const bloqueado = esBloqueado?.(new Date(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate(), h))
          const mostrarLinea = esHoyFlag && h === Math.floor(ahoraMinutos / 60)
          return (
            <div key={hora} className={`vc-dia-fila${bloqueado ? ' vc-bloqueado' : ''}`}>
              <div className="vc-dia-hora-label">{hora}</div>
              <div className="vc-dia-contenido">
                {mostrarLinea && (
                  <div className="vc-linea-ahora" style={{ top: `${((ahoraMinutos % 60) / 60) * 100}%` }} />
                )}
                {citasHora.map(c => (
                  <div
                    key={c._isGoogleEvent ? `g-${c.id}` : c.id}
                    className={`vc-dia-cita${c._isGoogleEvent ? ' vc-google-event' : ''}${c.estado === 'cancelada' ? ' vc-cita-cancelada' : ''}`}
                    style={{ borderLeftColor: getColorCita(c) }}
                    role="button"
                    tabIndex={0}
                    onClick={() => onClickCita(c)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickCita(c) } }}
                    aria-label={`${c._isGoogleEvent ? 'Google: ' : 'Cita: '}${c.lead?.nombre || 'Sin nombre'}`}
                  >
                    {c._isGoogleEvent && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                    <span className="vc-dia-cita-hora">{new Date(c.fecha_hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    <span className="vc-dia-cita-nombre">{c.lead?.nombre || 'Sin nombre'}</span>
                    {esDirector && !c._isGoogleEvent && c.closer && (
                      <span className="vc-dia-cita-closer">{c.closer.nombre || c.closer.email}</span>
                    )}
                    {!c._isGoogleEvent && c.estado_reunion && (
                      <span className="vc-badge-sm" style={{ background: `${c.estado_reunion.color}20`, color: c.estado_reunion.color }}>
                        {c.estado_reunion.nombre}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── EXPORT ─────────────────────────────────────────────────────────
export default function CalendarioVista({ vista, fechaActual, citas, bloqueos, onClickDia, onClickCita, esDirector, esBloqueado }) {
  if (vista === 'semana') {
    return <VistaSemanal fechaActual={fechaActual} citas={citas} bloqueos={bloqueos} onClickCita={onClickCita} esDirector={esDirector} esBloqueado={esBloqueado} />
  }
  if (vista === 'dia') {
    return <VistaDiaria fechaActual={fechaActual} citas={citas} bloqueos={bloqueos} onClickCita={onClickCita} esDirector={esDirector} esBloqueado={esBloqueado} />
  }
  return <VistaMensual fechaActual={fechaActual} citas={citas} bloqueos={bloqueos} onClickDia={onClickDia} onClickCita={onClickCita} esDirector={esDirector} />
}

export { MESES }
