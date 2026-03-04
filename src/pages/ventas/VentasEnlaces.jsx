import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import CalendarioEnlaces from '../../components/ventas/CalendarioEnlaces'
import '../../styles/ventas-calendario.css'

export default function VentasEnlaces() {
  const { user, rolesComerciales } = useAuth()

  const closers = useMemo(() => {
    const seen = new Set()
    return rolesComerciales
      .filter(r => r.rol === 'closer' && r.activo && !seen.has(r.usuario_id) && (seen.add(r.usuario_id), true))
      .map(r => ({ id: r.usuario_id, nombre: r.usuario?.nombre, email: r.usuario?.email }))
  }, [rolesComerciales])

  const setters = useMemo(() => {
    const seen = new Set()
    return rolesComerciales
      .filter(r => r.rol === 'setter' && r.activo && !seen.has(r.usuario_id) && (seen.add(r.usuario_id), true))
      .map(r => ({ id: r.usuario_id, nombre: r.usuario?.nombre, email: r.usuario?.email }))
  }, [rolesComerciales])

  const [enlaces, setEnlaces] = useState([])
  const [loading, setLoading] = useState(true)

  const cargarEnlaces = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ventas_enlaces_agenda')
      .select('*, setter:usuarios!ventas_enlaces_agenda_setter_id_fkey(id, nombre, email), creado_por:usuarios!ventas_enlaces_agenda_creado_por_id_fkey(id, nombre)')
      .order('created_at', { ascending: false })

    // Load closers for each enlace
    const enlacesData = data || []
    if (enlacesData.length > 0) {
      const { data: vecData } = await supabase
        .from('ventas_enlaces_closers')
        .select('enlace_id, closer_id')
        .in('enlace_id', enlacesData.map(e => e.id))

      const closersByEnlace = {}
      for (const vec of (vecData || [])) {
        if (!closersByEnlace[vec.enlace_id]) closersByEnlace[vec.enlace_id] = []
        closersByEnlace[vec.enlace_id].push(vec.closer_id)
      }

      for (const e of enlacesData) {
        e.closer_ids = closersByEnlace[e.id] || []
      }
    }

    setEnlaces(enlacesData)
    setLoading(false)
  }, [])

  useEffect(() => {
    cargarEnlaces()
  }, [cargarEnlaces])

  const crearEnlace = useCallback(async (enlace) => {
    const { data, error } = await supabase
      .from('ventas_enlaces_agenda')
      .insert({
        nombre: enlace.nombre,
        slug: enlace.slug,
        setter_id: enlace.setter_id || null,
        fuente: enlace.fuente || null,
        activo: true,
        creado_por_id: user?.id,
      })
      .select('*, setter:usuarios!ventas_enlaces_agenda_setter_id_fkey(id, nombre, email)')
      .single()
    if (error) throw error

    // Insert closers
    if (enlace.closer_ids?.length > 0) {
      const { error: vecError } = await supabase
        .from('ventas_enlaces_closers')
        .insert(enlace.closer_ids.map(cid => ({ enlace_id: data.id, closer_id: cid })))
      if (vecError) throw vecError
    }

    data.closer_ids = enlace.closer_ids || []
    setEnlaces(prev => [data, ...prev])
    return data
  }, [user?.id])

  const actualizarEnlace = useCallback(async (enlaceId, campos) => {
    const { closer_ids, ...dbCampos } = campos
    const { data, error } = await supabase
      .from('ventas_enlaces_agenda')
      .update({ ...dbCampos, updated_at: new Date().toISOString() })
      .eq('id', enlaceId)
      .select('*, setter:usuarios!ventas_enlaces_agenda_setter_id_fkey(id, nombre, email)')
      .single()
    if (error) throw error

    // Update closers if provided
    if (closer_ids !== undefined) {
      await supabase.from('ventas_enlaces_closers').delete().eq('enlace_id', enlaceId)
      if (closer_ids.length > 0) {
        const { error: vecError } = await supabase
          .from('ventas_enlaces_closers')
          .insert(closer_ids.map(cid => ({ enlace_id: enlaceId, closer_id: cid })))
        if (vecError) throw vecError
      }
      data.closer_ids = closer_ids
    }

    setEnlaces(prev => prev.map(e => e.id === enlaceId ? { ...e, ...data } : e))
  }, [])

  const eliminarEnlace = useCallback(async (enlaceId) => {
    const { error } = await supabase
      .from('ventas_enlaces_agenda')
      .delete()
      .eq('id', enlaceId)
    if (error) throw error
    setEnlaces(prev => prev.filter(e => e.id !== enlaceId))
  }, [])

  return (
    <div className="vc-page">
      <div className="vc-header">
        <h1>Enlaces de agenda</h1>
      </div>

      {loading ? (
        <div className="vc-loading">Cargando enlaces...</div>
      ) : (
        <CalendarioEnlaces
          enlaces={enlaces}
          setters={setters}
          closers={closers}
          onCrear={crearEnlace}
          onActualizar={actualizarEnlace}
          onEliminar={eliminarEnlace}
        />
      )}
    </div>
  )
}
