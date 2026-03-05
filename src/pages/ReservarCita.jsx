import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../styles/reservar-cita.css'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const ArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
)

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
)

function formatFecha(date) {
  const d = new Date(date)
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  })
}

function formatHora(date) {
  const d = new Date(date)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
}

// Get date parts in Europe/Madrid timezone
function getMadridDateParts(date) {
  const d = new Date(date)
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(d) // Returns YYYY-MM-DD
  return parts
}

export default function ReservarCita() {
  const { slug } = useParams()
  const containerRef = useRef(null)

  // State
  const [enlace, setEnlace] = useState(null)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [step, setStep] = useState('calendar') // calendar | form | success
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [resultData, setResultData] = useState(null)

  const [loadError, setLoadError] = useState(false)

  // Spotlight effect: track mouse position on the card
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Only on desktop (no touch)
    if (window.matchMedia('(pointer: coarse)').matches) return

    const handleMouse = (e) => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
      el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
    }
    el.addEventListener('mousemove', handleMouse)
    return () => el.removeEventListener('mousemove', handleMouse)
  }, [loading, loadError, enlace])

  // Load enlace info + slots
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setLoadError(false)

        const [infoRes, slotsRes] = await Promise.all([
          supabase.rpc('obtener_info_enlace_publico', { p_slug: slug }),
          supabase.rpc('obtener_slots_disponibles', { p_slug: slug }),
        ])

        if (infoRes.error) {
          console.error('Error loading enlace info:', infoRes.error)
          setLoadError(true)
          setLoading(false)
          return
        }

        setEnlace(infoRes.data)
        setSlots(slotsRes.data || [])
      } catch (err) {
        console.error('Error loading booking page:', err)
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // Group slots by date string (Europe/Madrid), deduplicate by time (keep first closer = least busy)
  const slotsByDate = useMemo(() => {
    const map = {}
    for (const s of slots) {
      const dateKey = getMadridDateParts(s.fecha_hora)
      if (!map[dateKey]) map[dateKey] = []
      // Deduplicate: only keep first closer per time
      const timeStr = new Date(s.fecha_hora).toISOString()
      if (!map[dateKey].find(x => x.fecha_hora === timeStr)) {
        map[dateKey].push({ ...s, fecha_hora: timeStr })
      }
    }
    // Sort slots within each day
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
    }
    return map
  }, [slots])

  const datesWithSlots = useMemo(() => new Set(Object.keys(slotsByDate)), [slotsByDate])

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Start on Monday
    let startDow = firstDay.getDay()
    if (startDow === 0) startDow = 7
    const startOffset = startDow - 1

    const days = []
    // Padding before
    for (let i = 0; i < startOffset; i++) {
      days.push({ date: null, otherMonth: true })
    }
    // Days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d)
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const today = new Date()
      const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
      days.push({
        date,
        dateKey,
        day: d,
        hasSlots: datesWithSlots.has(dateKey),
        isToday,
        otherMonth: false,
      })
    }
    return days
  }, [currentMonth, datesWithSlots])

  const selectedDateKey = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : null

  const slotsForDay = selectedDateKey ? (slotsByDate[selectedDateKey] || []) : []

  const handleSelectSlot = useCallback((slot) => {
    setSelectedSlot(prev => prev?.fecha_hora === slot.fecha_hora ? null : slot)
  }, [])

  const handleConfirmSlot = useCallback(() => {
    if (selectedSlot) {
      setStep('form')
      setError(null)
    }
  }, [selectedSlot])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (enviando) return
    if (!form.nombre.trim() || !form.email.trim() || !form.telefono.trim()) {
      setError('Todos los campos son obligatorios')
      return
    }
    setEnviando(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('crear_reserva_publica', {
      p_slug: slug,
      p_fecha_hora: selectedSlot.fecha_hora,
      p_closer_id: selectedSlot.closer_id,
      p_nombre: form.nombre.trim(),
      p_email: form.email.trim(),
      p_telefono: form.telefono.trim(),
    })

    if (rpcError) {
      setError(rpcError.message || 'Error al crear la reserva')
      setEnviando(false)
      return
    }

    setResultData(data)

    // Trigger Google Calendar sync (fire-and-forget)
    if (data?.cita_id && data?.closer_id) {
      try {
        supabase.functions.invoke('google-calendar-sync', {
          body: { action: 'create', cita_id: data.cita_id, closer_id: data.closer_id },
        })
      } catch { /* non-critical */ }
    }

    setStep('success')
    setEnviando(false)
  }

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))

  // ── Render ──

  if (loading) {
    return (
      <div className="rb-page">
        <div className="rb-container">
          <div className="rb-container-inner">
            <div className="rb-loading">
              <div className="rb-spinner" />
              <p>Cargando disponibilidad...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rb-page">
        <div className="rb-container">
          <div className="rb-container-inner">
            <div className="rb-not-found">Error al cargar. Por favor, recarga la página.</div>
          </div>
        </div>
      </div>
    )
  }

  if (!enlace || !enlace.activo) {
    return (
      <div className="rb-page">
        <div className="rb-container">
          <div className="rb-container-inner">
            <div className="rb-not-found">Este enlace de reserva no está disponible.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rb-page">
      <div className="rb-container">
        <div className="rb-container-inner" ref={containerRef}>
          {/* Spotlight overlay */}
          <div className="rb-spotlight" />

          {/* Header */}
          <div className="rb-header">
            <img src="/logo.png" alt="Madrigal Marketing" className="rb-logo rb-anim-enter rb-anim-delay-1" />
            <div className="rb-header-info">
              <h1 className="rb-anim-enter rb-anim-delay-2">{enlace.nombre}</h1>
              <p className="rb-header-subtitle rb-anim-enter rb-anim-delay-2">
                Descubre cómo escalar tu negocio con estrategias de marketing digital a medida
              </p>
              <div className="rb-badges rb-anim-enter rb-anim-delay-3">
                <span className="rb-badge-pill">
                  <ClockIcon />
                  {enlace.duracion} min
                </span>
                <span className="rb-badge-pill">
                  <ShieldIcon />
                  Gratuita
                </span>
                <span className="rb-badge-pill">
                  <VideoIcon />
                  Online
                </span>
              </div>
            </div>
          </div>

          {/* Step: Calendar + Slots */}
          {step === 'calendar' && (
            <div className="rb-body rb-anim-enter rb-anim-delay-4">
              <div className="rb-calendar-panel">
                {/* Month navigation */}
                <div className="rb-cal-nav">
                  <button onClick={prevMonth} aria-label="Mes anterior">&larr;</button>
                  <h2>{MESES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h2>
                  <button onClick={nextMonth} aria-label="Mes siguiente">&rarr;</button>
                </div>

                {/* Weekday headers */}
                <div className="rb-cal-weekdays">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                    <div key={d} className="rb-cal-weekday">{d}</div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="rb-cal-days">
                  {calendarDays.map((day, i) => {
                    if (day.otherMonth) return <div key={i} className="rb-cal-day other-month" />

                    const isSelected = selectedDate && selectedDate.getTime() === day.date.getTime()
                    const classes = [
                      'rb-cal-day',
                      day.hasSlots && 'has-slots',
                      isSelected && 'selected',
                      day.isToday && 'today',
                    ].filter(Boolean).join(' ')

                    return (
                      <button
                        key={i}
                        className={classes}
                        onClick={() => { if (day.hasSlots) { setSelectedDate(day.date); setSelectedSlot(null) } }}
                        disabled={!day.hasSlots}
                        aria-label={`${day.day} de ${MESES[currentMonth.getMonth()]}`}
                      >
                        {day.day}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Slots panel */}
              <div className="rb-slots-panel">
                {!selectedDate ? (
                  <p className="rb-no-date">Selecciona un día para ver los horarios disponibles</p>
                ) : (
                  <>
                    <p className="rb-slots-title">{formatFecha(selectedDate)}</p>
                    <div className="rb-slots-list" key={selectedDateKey}>
                      {slotsForDay.length === 0 ? (
                        <p className="rb-no-date">No hay horarios disponibles</p>
                      ) : (
                        slotsForDay.map(slot => {
                          const isActive = selectedSlot?.fecha_hora === slot.fecha_hora
                          return (
                            <div key={slot.fecha_hora} className={`rb-slot-wrapper${isActive ? ' active' : ''}`}>
                              <button
                                className="rb-slot-btn"
                                onClick={() => handleSelectSlot(slot)}
                              >
                                {formatHora(slot.fecha_hora)}
                              </button>
                              {isActive && (
                                <button className="rb-slot-confirm" onClick={handleConfirmSlot}>
                                  Confirmar
                                </button>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step: Form */}
          {step === 'form' && selectedSlot && (
            <div className="rb-form-panel">
              <button className="rb-back-btn" onClick={() => setStep('calendar')}>
                <ArrowLeft /> Volver al calendario
              </button>

              <div className="rb-selected-summary">
                <CalendarIcon />
                <div>
                  <div className="rb-sum-date">{formatFecha(selectedSlot.fecha_hora)}</div>
                  <div className="rb-sum-time">{formatHora(selectedSlot.fecha_hora)} · {enlace.duracion} min</div>
                </div>
              </div>

              <form className="rb-form" onSubmit={handleSubmit}>
                <div className="rb-field">
                  <label htmlFor="rb-nombre">Nombre</label>
                  <input
                    id="rb-nombre"
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Tu nombre completo"
                    required
                  />
                </div>
                <div className="rb-field">
                  <label htmlFor="rb-email">Email</label>
                  <input
                    id="rb-email"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div className="rb-field">
                  <label htmlFor="rb-telefono">Teléfono</label>
                  <input
                    id="rb-telefono"
                    type="tel"
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    placeholder="+34 600 000 000"
                    required
                  />
                </div>

                {error && <div className="rb-error">{error}</div>}

                <button type="submit" className="rb-submit-btn" disabled={enviando}>
                  {enviando ? 'Confirmando...' : 'Confirmar mi reserva'}
                </button>

                <div className="rb-trust">
                  <ShieldIcon />
                  <span>Tus datos están protegidos y seguros</span>
                </div>
              </form>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="rb-exito">
              <div className="rb-exito-icon">
                <CheckIcon />
              </div>
              <h2>¡Reserva confirmada!</h2>
              <p>Tu cita ha sido agendada correctamente.</p>
              {resultData && (
                <div className="rb-exito-details">
                  <div className="rb-exito-details-row">
                    <CalendarIcon />
                    <strong>{formatFecha(resultData.fecha_hora)}</strong>
                  </div>
                  <div className="rb-exito-details-row">
                    <ClockIcon />
                    <span>{formatHora(resultData.fecha_hora)} · {resultData.duracion} min</span>
                  </div>
                </div>
              )}
              <div className="rb-exito-reminder">
                <MailIcon />
                <span>Recibirás un email de confirmación</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="rb-footer">
        Powered by <a href="https://madrigalmarketing.es" target="_blank" rel="noopener noreferrer">Madrigal Marketing</a>
      </div>
    </div>
  )
}
