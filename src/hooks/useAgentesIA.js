import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TIPO_LABELS = {
  setter: 'Setter',
  repescadora: 'Repescadora',
  outbound_frio: 'Outbound Frío',
}

const DEFAULT_CONFIG = {
  horario: { inicio: '08:30', fin: '21:00', dias: [1, 2, 3, 4, 5] },
  delays_repesca: [7200, 86400, 259200],
  max_conversaciones: 100,
  max_mensajes_dia: 500,
  umbral_score_reunion: 60,
  umbral_calidad_minima: 6,
}

export { TIPO_LABELS, DEFAULT_CONFIG }

export function useAgentesIA() {
  const [agentes, setAgentes] = useState([])
  const [agente, setAgente] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ agendados_hoy: 0, leads_activos: 0, alertas: 0, gasto_mes: 0 })

  // Cargar lista de agentes con stats básicas
  const cargarAgentes = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ia_agentes')
        .select('*')
        .order('created_at')
      if (error) throw error
      setAgentes(data || [])

      // Stats globales
      const hoy = new Date().toISOString().split('T')[0]
      const inicioMes = hoy.slice(0, 7) + '-01'

      const [metricasRes, alertasRes, costesRes, leadsRes] = await Promise.all([
        supabase.from('ia_metricas_diarias').select('reuniones_agendadas').eq('fecha', hoy),
        supabase.from('ia_alertas_supervisor').select('id', { count: 'exact', head: true }).eq('leida', false),
        supabase.from('ia_costes').select('coste_total').gte('fecha', inicioMes),
        supabase.from('ia_conversaciones').select('id', { count: 'exact', head: true })
          .in('estado', ['needs_reply', 'waiting_reply', 'qualify', 'meeting_pref']),
      ])

      const agendadosHoy = (metricasRes.data || []).reduce((sum, m) => sum + (m.reuniones_agendadas || 0), 0)
      const gastoMes = (costesRes.data || []).reduce((sum, c) => sum + parseFloat(c.coste_total || 0), 0)

      setStats({
        agendados_hoy: agendadosHoy,
        leads_activos: leadsRes.count || 0,
        alertas: alertasRes.count || 0,
        gasto_mes: gastoMes,
      })
    } catch (err) {
      console.error('Error cargando agentes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Cargar un agente individual
  const cargarAgente = useCallback(async (id) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ia_agentes')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      setAgente(data)
      return data
    } catch (err) {
      console.error('Error cargando agente:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Crear agente
  const crearAgente = useCallback(async (datos) => {
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('ia_agentes')
        .insert({
          nombre: datos.nombre,
          tipo: datos.tipo,
          system_prompt: datos.system_prompt || '',
          config: datos.config || DEFAULT_CONFIG,
          whatsapp_phone_id: datos.whatsapp_phone_id || null,
          modo_sandbox: true,
        })
        .select()
        .single()
      if (error) throw error
      setAgentes(prev => [...prev, data])
      return data
    } catch (err) {
      console.error('Error creando agente:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  // Actualizar agente
  const actualizarAgente = useCallback(async (id, cambios) => {
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('ia_agentes')
        .update(cambios)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      setAgente(data)
      setAgentes(prev => prev.map(a => a.id === id ? data : a))
      return data
    } catch (err) {
      console.error('Error actualizando agente:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  // Eliminar agente
  const eliminarAgente = useCallback(async (id) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('ia_agentes')
        .delete()
        .eq('id', id)
      if (error) throw error
      setAgentes(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('Error eliminando agente:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  // Toggle activo/inactivo
  const toggleActivo = useCallback(async (id, activo) => {
    return actualizarAgente(id, { activo })
  }, [actualizarAgente])

  return {
    agentes,
    agente,
    loading,
    saving,
    stats,
    cargarAgentes,
    cargarAgente,
    crearAgente,
    actualizarAgente,
    eliminarAgente,
    toggleActivo,
  }
}
