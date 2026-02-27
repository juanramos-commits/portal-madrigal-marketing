import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import CalendarioDisponibilidad from './CalendarioDisponibilidad'
import CalendarioConfig from './CalendarioConfig'
import CalendarioBloqueos from './CalendarioBloqueos'

export default function AjustesCalendario() {
  const { user } = useAuth()
  const [disponibilidad, setDisponibilidad] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [config, setConfig] = useState(null)

  const cargarDisponibilidad = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ventas_calendario_disponibilidad')
      .select('*')
      .eq('usuario_id', user.id)
      .order('dia_semana')
      .order('hora_inicio')
    setDisponibilidad(data || [])
  }, [user?.id])

  const cargarBloqueos = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ventas_calendario_bloqueos')
      .select('*')
      .eq('usuario_id', user.id)
      .order('fecha_inicio', { ascending: false })
    setBloqueos(data || [])
  }, [user?.id])

  const cargarConfig = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ventas_calendario_config')
      .select('*')
      .eq('usuario_id', user.id)
      .maybeSingle()
    setConfig(data || {
      usuario_id: user.id,
      duracion_slot_minutos: 60,
      descanso_entre_citas_minutos: 15,
    })
  }, [user?.id])

  useEffect(() => {
    cargarDisponibilidad()
    cargarBloqueos()
    cargarConfig()
  }, [cargarDisponibilidad, cargarBloqueos, cargarConfig])

  const guardarDisponibilidad = async (franjas) => {
    if (!user?.id) return
    await supabase.from('ventas_calendario_disponibilidad').delete().eq('usuario_id', user.id)
    if (franjas.length > 0) {
      const rows = franjas.map(f => ({
        usuario_id: user.id,
        dia_semana: f.dia_semana,
        hora_inicio: f.hora_inicio,
        hora_fin: f.hora_fin,
        activo: f.activo !== false,
      }))
      const { error } = await supabase.from('ventas_calendario_disponibilidad').insert(rows)
      if (error) throw error
    }
    await cargarDisponibilidad()
  }

  const guardarConfig = async (cfg) => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('ventas_calendario_config')
      .upsert({ ...cfg, usuario_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'usuario_id' })
      .select()
      .single()
    if (error) throw error
    setConfig(data)
  }

  const crearBloqueo = async (bloqueo) => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('ventas_calendario_bloqueos')
      .insert({ usuario_id: user.id, ...bloqueo })
      .select()
      .single()
    if (error) throw error
    setBloqueos(prev => [data, ...prev])
    return data
  }

  const eliminarBloqueo = async (bloqueoId) => {
    const { error } = await supabase.from('ventas_calendario_bloqueos').delete().eq('id', bloqueoId)
    if (error) throw error
    setBloqueos(prev => prev.filter(b => b.id !== bloqueoId))
  }

  return (
    <div className="aj-seccion">
      <h3>Configuración de calendario</h3>

      <div className="aj-cal-section">
        <CalendarioConfig config={config} onGuardar={guardarConfig} />
      </div>

      <div className="aj-separator" />

      <div className="aj-cal-section">
        <CalendarioDisponibilidad
          disponibilidad={disponibilidad}
          onGuardar={guardarDisponibilidad}
          minimoHoras={config?.minimo_horas_semana}
        />
      </div>

      <div className="aj-separator" />

      <div className="aj-cal-section">
        <CalendarioBloqueos
          bloqueos={bloqueos}
          onCrear={crearBloqueo}
          onEliminar={eliminarBloqueo}
        />
      </div>
    </div>
  )
}
