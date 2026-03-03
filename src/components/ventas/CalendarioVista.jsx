import { useMemo } from 'react'
import CalendarioCita from './CalendarioCita'

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
              key={i}
              className={`vc-mes-celda${dia.esOtroMes ? ' vc-otro-mes' : ''}${hoy ? ' vc-hoy' : ''}`}
              onClick={() => onClickDia(dia.date)}
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

// ─── VISTA SEMANAL ──────────────────────────────────────────────────
function VistaSemanal({ fechaActual, citas, bloqueos, onClickCita, esDirector, esBloqueado }) {
  const horas = useMemo(() => generarHoras(7, 22), [])
  const lunes = useMemo(() => obtenerLunesSemana(fechaActual), [fechaActual])

  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      return d
    })
  }, [lunes])

  const citasPorDiaHora = useMemo(() => {
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
        {horas.map(hora => {
          const h = parseInt(hora)
          return (
            <div key={hora} className="vc-semana-fila">
              <div className="vc-semana-hora-label">{hora}</div>
              {diasSemana.map((d, di) => {
                const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
                const citasEnHora = (citasPorDiaHora[dayKey] || []).filter(c => {
                  const ch = new Date(c.fecha_hora).getHours()
                  return ch === h
                })
                const bloqueado = esBloqueado?.(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))
                const mostrarLinea = esHoy(d) && h === Math.floor(ahoraMinutos / 60)
                return (
                  <div key={di} className={`vc-semana-celda${bloqueado ? ' vc-bloqueado' : ''}`}>
                    {mostrarLinea && (
                      <div className="vc-linea-ahora" style={{ top: `${((ahoraMinutos % 60) / 60) * 100}%` }} />
                    )}
                    {citasEnHora.map(c => (
                      <CalendarioCita key={c.id} cita={c} onClick={onClickCita} mostrarCloser={esDirector} />
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
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
                    key={c.id}
                    className="vc-dia-cita"
                    role="button"
                    tabIndex={0}
                    onClick={() => onClickCita(c)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickCita(c) } }}
                    aria-label={`Cita: ${c.lead?.nombre || 'Sin nombre'}`}
                  >
                    <span className="vc-dia-cita-hora">{new Date(c.fecha_hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    <span className="vc-dia-cita-nombre">{c.lead?.nombre || 'Sin nombre'}</span>
                    {esDirector && c.closer && (
                      <span className="vc-dia-cita-closer">{c.closer.nombre || c.closer.email}</span>
                    )}
                    {c.estado_reunion && (
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
