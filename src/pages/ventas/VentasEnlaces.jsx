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
      .select('*')
      .order('created_at', { ascending: false })

    // Load setters for each enlace
    const enlacesList = data || []
    const setterIds = [...new Set(enlacesList.filter(e => e.setter_id).map(e => e.setter_id))]
    let settersMap = {}
    if (setterIds.length > 0) {
      const { data: settersData } = await supabase.from('usuarios').select('id, nombre, email').in('id', setterIds)
      for (const s of (settersData || [])) settersMap[s.id] = s
    }
    for (const e of enlacesList) {
      e.setter = e.setter_id ? settersMap[e.setter_id] || null : null
    }

    // Load closers for each enlace
    if (enlacesList.length > 0) {
      const { data: vecData } = await supabase
        .from('ventas_enlaces_closers')
        .select('enlace_id, closer_id')
        .in('enlace_id', enlacesList.map(e => e.id))

      const closersByEnlace = {}
      for (const vec of (vecData || [])) {
        if (!closersByEnlace[vec.enlace_id]) closersByEnlace[vec.enlace_id] = []
        closersByEnlace[vec.enlace_id].push(vec.closer_id)
      }

      for (const e of enlacesList) {
        e.closer_ids = closersByEnlace[e.id] || []
      }
    }

    setEnlaces(enlacesList)
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
      .select('*')
      .single()
    if (error) throw error

    // Load setter if present
    if (data.setter_id) {
      const { data: setter } = await supabase.from('usuarios').select('id, nombre, email').eq('id', data.setter_id).single()
      data.setter = setter
    } else {
      data.setter = null
    }

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

    const { data: rows, error } = await supabase
      .from('ventas_enlaces_agenda')
      .update({ ...dbCampos, updated_at: new Date().toISOString() })
      .eq('id', enlaceId)
      .select('*')
    if (error) {
      console.error('Error updating enlace:', error)
      throw error
    }
    const data = rows?.[0]
    if (!data) throw new Error('No se pudo actualizar el enlace')

    // Load setter separately if needed
    if (data.setter_id) {
      const { data: setter } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('id', data.setter_id)
        .single()
      data.setter = setter
    } else {
      data.setter = null
    }

    // Update closers if provided
    if (closer_ids !== undefined) {
      const { error: delError } = await supabase.from('ventas_enlaces_closers').delete().eq('enlace_id', enlaceId)
      if (delError) {
        console.error('Error deleting closers:', delError)
        throw delError
      }
      if (closer_ids.length > 0) {
        const { error: vecError } = await supabase
          .from('ventas_enlaces_closers')
          .insert(closer_ids.map(cid => ({ enlace_id: enlaceId, closer_id: cid })))
        if (vecError) {
          console.error('Error inserting closers:', vecError)
          throw vecError
        }
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
