import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCached, setCache, invalidateCache } from '../lib/cache'

export function useCERespuestas() {
  const [respuestas, setRespuestas] = useState([])
  const [respuestaActiva, setRespuestaActiva] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroClasificacion, setFiltroClasificacion] = useState('')
  const [search, setSearch] = useState('')
  const loadRef = useRef(0)

  const cargar = useCallback(async (filters = {}) => {
    const requestId = ++loadRef.current
    setLoading(true)
    setError(null)

    const currentClasificacion = filters.clasificacion ?? filtroClasificacion
    const currentSearch = filters.search ?? search

    try {
      let query = supabase
        .from('ce_respuestas')
        .select(`
          *,
          contacto:ce_contactos(nombre, email, empresa),
          envio:ce_envios(*, paso:ce_pasos(asunto_a, asunto_b))
        `)
        .order('created_at', { ascending: false })

      if (currentClasificacion) {
        query = query.eq('clasificacion', currentClasificacion)
      }
      if (currentSearch) {
        query = query.or(`contacto.nombre.ilike.%${currentSearch}%,contacto.email.ilike.%${currentSearch}%,contacto.empresa.ilike.%${currentSearch}%`)
      }

      const { data, error: err } = await query

      if (requestId !== loadRef.current) return
      if (err) throw err

      setRespuestas(data || [])
    } catch (err) {
      if (requestId === loadRef.current) {
        setError(err.message)
      }
    } finally {
      if (requestId === loadRef.current) {
        setLoading(false)
      }
    }
  }, [filtroClasificacion, search])

  useEffect(() => {
    cargar()
  }, [cargar])

  const seleccionar = useCallback(async (id) => {
    setError(null)
    try {
      // Load the response with thread context
      const { data, error: err } = await supabase
        .from('ce_respuestas')
        .select(`
          *,
          contacto:ce_contactos(nombre, email, empresa, telefono),
          envio:ce_envios(*, paso:ce_pasos(asunto_a, asunto_b))
        `)
        .eq('id', id)
        .single()
      if (err) throw err

      // Load thread: group by thread_key if available
      let thread = []
      if (data.thread_key) {
        const { data: threadData, error: threadErr } = await supabase
          .from('ce_respuestas')
          .select('*')
          .eq('thread_key', data.thread_key)
          .order('created_at', { ascending: true })
        if (!threadErr) thread = threadData || []

        // Also load envios in the same thread
        const { data: threadEnvios } = await supabase
          .from('ce_envios')
          .select('*, paso:ce_pasos(asunto_a, cuerpo_a)')
          .eq('thread_key', data.thread_key)
          .order('created_at', { ascending: true })
        if (threadEnvios) {
          data._threadEnvios = threadEnvios
        }
      }

      data._thread = thread
      setRespuestaActiva(data)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const clasificar = useCallback(async (id, clasificacion) => {
    setError(null)
    try {
      const { data: updated, error: err } = await supabase
        .from('ce_respuestas')
        .update({ clasificacion })
        .eq('id', id)
        .select('*, enrollment_id')
        .single()
      if (err) throw err

      // If classified as interested, update enrollment estado too
      if (clasificacion === 'interesado' && updated.enrollment_id) {
        await supabase
          .from('ce_enrollments')
          .update({ estado: 'interesado' })
          .eq('id', updated.enrollment_id)
      }

      setRespuestas(prev => prev.map(r => r.id === id ? { ...r, clasificacion } : r))
      if (respuestaActiva?.id === id) {
        setRespuestaActiva(prev => ({ ...prev, clasificacion }))
      }
      invalidateCache('ce-dashboard')
      return updated
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [respuestaActiva])

  const marcarLeida = useCallback(async (id) => {
    setError(null)
    try {
      const { error: err } = await supabase
        .from('ce_respuestas')
        .update({ leida: true })
        .eq('id', id)
      if (err) throw err

      setRespuestas(prev => prev.map(r => r.id === id ? { ...r, leida: true } : r))
      if (respuestaActiva?.id === id) {
        setRespuestaActiva(prev => ({ ...prev, leida: true }))
      }
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [respuestaActiva])

  const crearLeadCRM = useCallback(async (respuestaId) => {
    setError(null)
    try {
      // 1. Get response + contact data
      const { data: respuesta, error: respErr } = await supabase
        .from('ce_respuestas')
        .select('*, contacto:ce_contactos(nombre, empresa, email, telefono)')
        .eq('id', respuestaId)
        .single()
      if (respErr) throw respErr

      const contacto = respuesta.contacto

      // 2. Insert into ventas_leads
      const { data: lead, error: leadErr } = await supabase
        .from('ventas_leads')
        .insert({
          nombre: contacto.nombre,
          empresa: contacto.empresa,
          email: contacto.email,
          telefono: contacto.telefono,
          fuente: 'cold_email',
        })
        .select()
        .single()
      if (leadErr) throw leadErr

      // 3. Get first active etapa
      const { data: etapa, error: etapaErr } = await supabase
        .from('ventas_etapas')
        .select('id')
        .eq('activa', true)
        .order('orden', { ascending: true })
        .limit(1)
        .single()
      if (etapaErr) throw etapaErr

      // 4. Insert pipeline entry
      const { error: pipErr } = await supabase
        .from('ventas_lead_pipeline')
        .insert({
          lead_id: lead.id,
          etapa_id: etapa.id,
        })
      if (pipErr) throw pipErr

      // 5. Update crm_lead_id on respuesta and contacto
      await Promise.all([
        supabase
          .from('ce_respuestas')
          .update({ crm_lead_id: lead.id })
          .eq('id', respuestaId),
        supabase
          .from('ce_contactos')
          .update({ crm_lead_id: lead.id })
          .eq('id', respuesta.contacto_id),
      ])

      setRespuestas(prev => prev.map(r =>
        r.id === respuestaId ? { ...r, crm_lead_id: lead.id } : r
      ))
      if (respuestaActiva?.id === respuestaId) {
        setRespuestaActiva(prev => ({ ...prev, crm_lead_id: lead.id }))
      }

      return lead
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [respuestaActiva])

  return {
    respuestas,
    respuestaActiva,
    loading,
    error,
    filtroClasificacion,
    setFiltroClasificacion,
    search,
    setSearch,
    cargar,
    seleccionar,
    clasificar,
    marcarLeida,
    crearLeadCRM,
  }
}
