import { useState } from 'react'
import { Calendar, Clock, User } from 'lucide-react'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { logActividad } from '../../lib/logActividad'

export default function CRMAgendarCita({ lead, closers = [], onSuccess, onCancel }) {
  const { user } = useAuth()
  const [closerId, setCloserId] = useState(lead?.closer_asignado_id || '')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [duracion, setDuracion] = useState(60)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const hoy = new Date().toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return

    if (!closerId) { setError('Selecciona un closer'); return }
    if (!fecha) { setError('Selecciona una fecha'); return }
    if (!hora) { setError('Selecciona una hora'); return }

    const fechaHora = new Date(`${fecha}T${hora}`)
    if (isNaN(fechaHora.getTime())) { setError('Fecha u hora no válida'); return }
    if (fechaHora < new Date()) { setError('No puedes agendar en el pasado'); return }

    setSaving(true)
    setError(null)

    try {
      // Create cita
      const { data: cita, error: citaErr } = await supabase
        .from('ventas_citas')
        .insert({
          lead_id: lead.id,
          closer_id: closerId,
          fecha_hora: fechaHora.toISOString(),
          duracion_minutos: duracion,
          estado: 'agendada',
          origen_agendacion: 'manual_crm',
        })
        .select()
        .single()

      if (citaErr) throw citaErr

      // Update closer_asignado_id on the lead
      try {
        await supabase
          .from('ventas_leads')
          .update({ closer_asignado_id: closerId })
          .eq('id', lead.id)
      } catch { /* non-critical — cita already created */ }

      // Log activity (non-critical)
      try {
        await supabase.from('ventas_actividad').insert({
          lead_id: lead.id,
          usuario_id: user?.id || closerId,
          tipo: 'cita_agendada',
          descripcion: `Cita agendada para ${fecha} ${hora}`,
          datos: { cita_id: cita.id },
        })
      } catch { /* non-critical */ }

      logActividad('crm', 'crear', 'Cita agendada desde CRM', { entidad: 'cita', entidad_id: cita.id })

      // Trigger Google Calendar sync (fire-and-forget)
      try {
        supabase.functions.invoke('google-calendar-sync', {
          body: { action: 'create', cita_id: cita.id, closer_id: closerId },
        })
      } catch { /* non-critical */ }

      onSuccess(cita)
    } catch (err) {
      setError(err.message || 'Error al agendar la cita')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title="Agendar reunión"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn--secondary ui-btn--md" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" form="crm-agendar-cita-form" className="ui-btn ui-btn--primary ui-btn--md" disabled={saving}>
            {saving ? 'Agendando...' : 'Agendar reunión'}
          </button>
        </>
      }
    >
      <form id="crm-agendar-cita-form" className="crm-form" onSubmit={handleSubmit}>
        {error && <div className="crm-form-error">{error}</div>}

        <div className="crm-agendar-lead-info">
          <strong>{lead?.nombre || 'Lead'}</strong>
          {lead?.telefono && <span>{lead.telefono}</span>}
          {lead?.email && <span>{lead.email}</span>}
        </div>

        <div className="crm-field">
          <label><User size={14} /> Closer *</label>
          <Select value={closerId} onChange={e => setCloserId(e.target.value)}>
            <option value="">Seleccionar closer...</option>
            {closers.map(c => (
              <option key={c.usuario_id} value={c.usuario_id}>
                {c.usuario?.nombre || c.usuario?.email || c.usuario_id}
              </option>
            ))}
          </Select>
        </div>

        <div className="crm-field">
          <label><Calendar size={14} /> Fecha *</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} min={hoy} />
        </div>

        <div className="crm-field">
          <label><Clock size={14} /> Hora *</label>
          <input type="time" value={hora} onChange={e => setHora(e.target.value)} step="900" />
        </div>

        <div className="crm-field">
          <label><Clock size={14} /> Duración</label>
          <Select value={duracion} onChange={e => setDuracion(Number(e.target.value))}>
            <option value={30}>30 minutos</option>
            <option value={45}>45 minutos</option>
            <option value={60}>1 hora</option>
            <option value={90}>1h 30min</option>
            <option value={120}>2 horas</option>
          </Select>
        </div>
      </form>
    </Modal>
  )
}
