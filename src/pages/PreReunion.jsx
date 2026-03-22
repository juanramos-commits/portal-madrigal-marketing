import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CalendarCheck, Clock, User, Video, CheckCircle, ArrowRight } from 'lucide-react'

function Countdown({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState({})

  useEffect(() => {
    const calc = () => {
      const now = new Date()
      const diff = new Date(targetDate) - now
      if (diff <= 0) return setTimeLeft({ passed: true })
      setTimeLeft({
        dias: Math.floor(diff / (1000 * 60 * 60 * 24)),
        horas: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutos: Math.floor((diff / (1000 * 60)) % 60),
        segundos: Math.floor((diff / 1000) % 60),
      })
    }
    calc()
    const interval = setInterval(calc, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  if (timeLeft.passed) return <div style={styles.countdownPassed}>La reunión ya ha comenzado</div>

  return (
    <div style={styles.countdown}>
      {timeLeft.dias > 0 && <CountUnit value={timeLeft.dias} label="días" />}
      <CountUnit value={timeLeft.horas} label="horas" />
      <CountUnit value={timeLeft.minutos} label="min" />
      <CountUnit value={timeLeft.segundos} label="seg" />
    </div>
  )
}

function CountUnit({ value, label }) {
  return (
    <div style={styles.countUnit}>
      <div style={styles.countValue}>{String(value || 0).padStart(2, '0')}</div>
      <div style={styles.countLabel}>{label}</div>
    </div>
  )
}

export default function PreReunion() {
  const { token } = useParams()
  const [cita, setCita] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from('ventas_citas')
        .select(`
          id, fecha_hora, duracion_minutos, google_meet_url, noshow_confirmado,
          lead:ventas_leads(nombre, categoria:ventas_categorias(nombre)),
          closer:usuarios!ventas_citas_closer_id_fkey(nombre)
        `)
        .eq('noshow_token', token)
        .eq('estado', 'agendada')
        .single()

      if (err || !data) {
        setError('Enlace no válido o la reunión ya no está disponible')
      } else {
        setCita(data)
        setConfirmed(data.noshow_confirmado)
      }
      setLoading(false)
    }
    if (token) load()
  }, [token])

  const confirmar = async () => {
    if (!cita) return
    await supabase
      .from('ventas_citas')
      .update({ noshow_confirmado: true, noshow_confirmado_at: new Date().toISOString() })
      .eq('id', cita.id)
    setConfirmed(true)
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Cargando...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <CalendarCheck size={40} style={{ color: '#6B7280', marginBottom: 12 }} />
            <div style={{ color: '#9CA3AF', fontSize: 16 }}>{error}</div>
          </div>
        </div>
      </div>
    )
  }

  const lead = cita.lead || {}
  const closer = cita.closer || {}
  const citaDate = new Date(cita.fecha_hora)
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const fechaStr = `${dias[citaDate.getDay()]} ${citaDate.getDate()} de ${meses[citaDate.getMonth()]}`
  const horaStr = `${String(citaDate.getHours()).padStart(2, '0')}:${String(citaDate.getMinutes()).padStart(2, '0')}`

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>MADRIGAL</div>

        {/* Title */}
        <h1 style={styles.title}>Tu videollamada está confirmada</h1>

        {/* Countdown */}
        <Countdown targetDate={cita.fecha_hora} />

        {/* Details */}
        <div style={styles.details}>
          <div style={styles.detailRow}>
            <CalendarCheck size={18} style={{ color: '#10B981' }} />
            <span>{fechaStr} a las {horaStr}</span>
          </div>
          <div style={styles.detailRow}>
            <Clock size={18} style={{ color: '#3B82F6' }} />
            <span>{cita.duracion_minutos || 45} minutos</span>
          </div>
          <div style={styles.detailRow}>
            <User size={18} style={{ color: '#8B5CF6' }} />
            <span>Con {closer.nombre || 'nuestro equipo'}</span>
          </div>
        </div>

        {/* What we'll cover */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Qué vamos a ver en la llamada</h3>
          <div style={styles.bulletList}>
            <div style={styles.bullet}><ArrowRight size={14} style={{ color: '#10B981', flexShrink: 0 }} /> Análisis de tu situación actual de captación</div>
            <div style={styles.bullet}><ArrowRight size={14} style={{ color: '#10B981', flexShrink: 0 }} /> Cómo funciona nuestro sistema para tu sector</div>
            <div style={styles.bullet}><ArrowRight size={14} style={{ color: '#10B981', flexShrink: 0 }} /> Propuesta personalizada para tu caso</div>
          </div>
        </div>

        {/* CTA buttons */}
        <div style={styles.buttons}>
          {confirmed ? (
            <div style={styles.confirmedBadge}>
              <CheckCircle size={18} /> Asistencia confirmada
            </div>
          ) : (
            <button onClick={confirmar} style={styles.confirmBtn}>
              <CheckCircle size={18} /> Confirmar asistencia
            </button>
          )}

          {cita.google_meet_url && (
            <a href={cita.google_meet_url} target="_blank" rel="noopener noreferrer" style={styles.meetBtn}>
              <Video size={18} /> Unirse a la videollamada
            </a>
          )}
        </div>

        {/* Reschedule */}
        <div style={styles.reschedule}>
          ¿No puedes en esta fecha? Responde al WhatsApp de confirmación y te buscamos otro hueco.
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          Madrigal Marketing · La única agencia en España especializada en captación para el sector bodas
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0A0A0A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: '#111111',
    borderRadius: 16,
    border: '1px solid #222',
    maxWidth: 520,
    width: '100%',
    padding: '36px 32px',
  },
  logo: {
    textAlign: 'center',
    fontSize: 14,
    letterSpacing: '0.2em',
    color: '#6B7280',
    fontWeight: 700,
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 700,
    color: '#F9FAFB',
    margin: '0 0 24px',
  },
  countdown: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
  },
  countdownPassed: {
    textAlign: 'center',
    color: '#F59E0B',
    fontWeight: 600,
    fontSize: 15,
    marginBottom: 28,
  },
  countUnit: {
    textAlign: 'center',
    background: '#1A1A1A',
    borderRadius: 10,
    padding: '12px 16px',
    minWidth: 60,
  },
  countValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#F9FAFB',
    fontVariantNumeric: 'tabular-nums',
  },
  countLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 28,
    padding: '16px 20px',
    background: '#1A1A1A',
    borderRadius: 10,
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 15,
    color: '#D1D5DB',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#F9FAFB',
    margin: '0 0 12px',
  },
  bulletList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  bullet: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    color: '#D1D5DB',
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  confirmBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 24px',
    borderRadius: 10,
    border: 'none',
    background: '#10B981',
    color: '#000',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    width: '100%',
  },
  confirmedBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 24px',
    borderRadius: 10,
    border: '2px solid #10B981',
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#10B981',
    fontSize: 15,
    fontWeight: 700,
    width: '100%',
    boxSizing: 'border-box',
  },
  meetBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 24px',
    borderRadius: 10,
    border: '1px solid #333',
    background: '#1A1A1A',
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  reschedule: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 20,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#4B5563',
    borderTop: '1px solid #222',
    paddingTop: 16,
  },
}
