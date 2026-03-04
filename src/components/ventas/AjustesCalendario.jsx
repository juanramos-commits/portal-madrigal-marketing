import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import CalendarioDisponibilidad from './CalendarioDisponibilidad'
import CalendarioConfig from './CalendarioConfig'
import CalendarioBloqueos from './CalendarioBloqueos'
import CalendarioAdminPanel from './CalendarioAdminPanel'
import CalendarioEnlaces from './CalendarioEnlaces'
import Select from '../ui/Select'

function parseTime(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h + (m || 0) / 60
}

function obtenerRangoSemana(fecha) {
  const d = new Date(fecha)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const inicio = new Date(d)
  inicio.setDate(d.getDate() + diff)
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(inicio)
  fin.setDate(inicio.getDate() + 6)
  fin.setHours(23, 59, 59, 999)
  return { inicio, fin }
}

export default function AjustesCalendario() {
  const { user, usuario, tienePermiso, rolesComerciales } = useAuth()

  const esAdmin = usuario?.tipo === 'super_admin'
  const puedeGestionarEquipo = tienePermiso('ventas.calendario.reasignar')
  const puedeGestionarEnlaces = tienePermiso('ventas.calendario.enlaces')
  const puedeSeleccionarCloser = puedeGestionarEquipo || puedeGestionarEnlaces

  // Derive closers and setters from rolesComerciales
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

  // Is the current user a closer themselves?
  const esCloserPropio = rolesComerciales.some(r => r.usuario_id === user?.id && r.rol === 'closer' && r.activo)

  // Closer selector for admin/director — default to first closer
  const [usuarioGestionado, setUsuarioGestionado] = useState('')

  // Determine which user's calendar we're managing
  const targetUserId = useMemo(() => {
    if (puedeSeleccionarCloser) {
      // Admin/director: use selected closer, or first closer
      return usuarioGestionado || closers[0]?.id || null
    }
    // Regular closer: their own calendar
    if (esCloserPropio) return user?.id
    return null
  }, [puedeSeleccionarCloser, usuarioGestionado, closers, esCloserPropio, user?.id])

  // Auto-select first closer when closers load
  useEffect(() => {
    if (puedeSeleccionarCloser && !usuarioGestionado && closers.length > 0) {
      setUsuarioGestionado(closers[0].id)
    }
  }, [puedeSeleccionarCloser, closers, usuarioGestionado])

  // Tabs
  const baseTabs = [
    { key: 'config', label: 'Configuracion' },
    { key: 'disponibilidad', label: 'Disponibilidad' },
    { key: 'bloqueos', label: 'Bloqueos' },
  ]
  const tabs = useMemo(() => {
    const t = [...baseTabs]
    if (puedeGestionarEquipo) t.push({ key: 'equipo', label: 'Gestion de equipo' })
    if (puedeGestionarEnlaces) t.push({ key: 'enlaces', label: 'Enlaces de agenda' })
    return t
  }, [puedeGestionarEquipo, puedeGestionarEnlaces])

  const [activeTab, setActiveTab] = useState('config')

  // ====== State for config/disponibilidad/bloqueos ======
  const [disponibilidad, setDisponibilidad] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [config, setConfig] = useState(null)

  const cargarDisponibilidad = useCallback(async () => {
    if (!targetUserId) return
    const { data } = await supabase
      .from('ventas_calendario_disponibilidad')
      .select('*')
      .eq('usuario_id', targetUserId)
      .order('dia_semana')
      .order('hora_inicio')
    setDisponibilidad(data || [])
  }, [targetUserId])

  const cargarBloqueos = useCallback(async () => {
    if (!targetUserId) return
    const { data } = await supabase
      .from('ventas_calendario_bloqueos')
      .select('*')
      .eq('usuario_id', targetUserId)
      .order('fecha_inicio', { ascending: false })
    setBloqueos(data || [])
  }, [targetUserId])

  const cargarConfig = useCallback(async () => {
    if (!targetUserId) return
    const { data } = await supabase
      .from('ventas_calendario_config')
      .select('*')
      .eq('usuario_id', targetUserId)
      .maybeSingle()
    setConfig(data || {
      usuario_id: targetUserId,
      duracion_slot_minutos: 60,
      descanso_entre_citas_minutos: 15,
    })
  }, [targetUserId])

  // Load data when targetUserId changes
  useEffect(() => {
    if (targetUserId) {
      cargarDisponibilidad()
      cargarBloqueos()
      cargarConfig()
    }
  }, [targetUserId, cargarDisponibilidad, cargarBloqueos, cargarConfig])

  const guardarDisponibilidad = async (franjas) => {
    if (!targetUserId) return
    await supabase.from('ventas_calendario_disponibilidad').delete().eq('usuario_id', targetUserId)
    if (franjas.length > 0) {
      const rows = franjas.map(f => ({
        usuario_id: targetUserId,
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
    if (!targetUserId) return
    const { data, error } = await supabase
      .from('ventas_calendario_config')
      .upsert({ ...cfg, usuario_id: targetUserId, updated_at: new Date().toISOString() }, { onConflict: 'usuario_id' })
      .select()
      .single()
    if (error) throw error
    setConfig(data)
  }

  const crearBloqueo = async (bloqueo) => {
    if (!targetUserId) return
    const { data, error } = await supabase
      .from('ventas_calendario_bloqueos')
      .insert({ usuario_id: targetUserId, ...bloqueo })
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

  // ====== Gestion de equipo ======
  const calcularHorasSemanales = useCallback((disp) => {
    return (disp || [])
      .filter(d => d.activo !== false)
      .reduce((total, d) => {
        const inicio = parseTime(d.hora_inicio)
        const fin = parseTime(d.hora_fin)
        return total + Math.max(0, fin - inicio)
      }, 0)
  }, [])

  const cargarClosersConConfig = useCallback(async () => {
    if (!closers.length) return []
    const ids = closers.map(c => c.id)
    const [configsRes, citasRes, dispRes] = await Promise.all([
      supabase.from('ventas_calendario_config').select('*').in('usuario_id', ids),
      supabase.from('ventas_citas').select('closer_id, fecha_hora').in('closer_id', ids)
        .gte('fecha_hora', obtenerRangoSemana(new Date()).inicio.toISOString())
        .lte('fecha_hora', obtenerRangoSemana(new Date()).fin.toISOString()),
      supabase.from('ventas_calendario_disponibilidad').select('*').in('usuario_id', ids).eq('activo', true),
    ])

    const configs = configsRes.data || []
    const citasSemana = citasRes.data || []
    const dispData = dispRes.data || []

    return closers.map(c => {
      const cfg = configs.find(x => x.usuario_id === c.id) || {}
      const closerCitas = citasSemana.filter(x => x.closer_id === c.id)
      const closerDisp = dispData.filter(x => x.usuario_id === c.id)
      const horasSemanales = calcularHorasSemanales(closerDisp)

      const proximaCita = closerCitas
        .filter(x => new Date(x.fecha_hora) >= new Date())
        .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))[0]

      return {
        ...c,
        duracion_slot_minutos: cfg.duracion_slot_minutos || 60,
        descanso_entre_citas_minutos: cfg.descanso_entre_citas_minutos || 15,
        minimo_horas_semana: cfg.minimo_horas_semana || null,
        horas_configuradas: horasSemanales,
        citas_semana: closerCitas.length,
        proxima_cita: proximaCita?.fecha_hora || null,
        config_id: cfg.id,
      }
    })
  }, [closers, calcularHorasSemanales])

  const actualizarMinimoHoras = useCallback(async (closerId, minimo) => {
    const { error } = await supabase
      .from('ventas_calendario_config')
      .upsert({
        usuario_id: closerId,
        minimo_horas_semana: minimo,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'usuario_id' })
    if (error) throw error
  }, [])

  const handleVerCalendarioCloser = (closerId) => {
    setUsuarioGestionado(closerId)
    setActiveTab('config')
  }

  // ====== Enlaces de agenda ======
  const [enlaces, setEnlaces] = useState([])

  const cargarEnlaces = useCallback(async () => {
    const { data } = await supabase
      .from('ventas_enlaces_agenda')
      .select('*, setter:usuarios!ventas_enlaces_agenda_setter_id_fkey(id, nombre, email), creado_por:usuarios!ventas_enlaces_agenda_creado_por_id_fkey(id, nombre)')
      .order('created_at', { ascending: false })
    setEnlaces(data || [])
  }, [])

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
    setEnlaces(prev => [data, ...prev])
    return data
  }, [user?.id])

  const actualizarEnlace = useCallback(async (enlaceId, campos) => {
    const { data, error } = await supabase
      .from('ventas_enlaces_agenda')
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq('id', enlaceId)
      .select('*, setter:usuarios!ventas_enlaces_agenda_setter_id_fkey(id, nombre, email)')
      .single()
    if (error) throw error
    setEnlaces(prev => prev.map(e => e.id === enlaceId ? data : e))
  }, [])

  const eliminarEnlace = useCallback(async (enlaceId) => {
    const { error } = await supabase
      .from('ventas_enlaces_agenda')
      .delete()
      .eq('id', enlaceId)
    if (error) throw error
    setEnlaces(prev => prev.filter(e => e.id !== enlaceId))
  }, [])

  // Load enlaces when tab becomes active
  useEffect(() => {
    if (activeTab === 'enlaces' && puedeGestionarEnlaces) {
      cargarEnlaces()
    }
  }, [activeTab, puedeGestionarEnlaces, cargarEnlaces])

  // No closer selected and not a closer — show message
  const noCalendario = !targetUserId && !puedeSeleccionarCloser

  // Name of the closer being managed
  const closerGestionadoNombre = useMemo(() => {
    if (!puedeSeleccionarCloser || !targetUserId) return null
    const c = closers.find(x => x.id === targetUserId)
    return c?.nombre || c?.email || null
  }, [puedeSeleccionarCloser, targetUserId, closers])

  return (
    <div className="aj-seccion">
      <h3>Calendario</h3>

      {/* Closer selector for admin/director */}
      {puedeSeleccionarCloser && closers.length > 0 && (
        <div className="aj-field" style={{ marginBottom: '1rem' }}>
          <label>Gestionar calendario de:</label>
          <Select
            value={usuarioGestionado || ''}
            onChange={e => setUsuarioGestionado(e.target.value)}
          >
            {closers.map(c => (
              <option key={c.id} value={c.id}>{c.nombre || c.email}</option>
            ))}
          </Select>
        </div>
      )}

      {puedeSeleccionarCloser && closers.length === 0 && (
        <div className="aj-empty">No hay closers en el equipo comercial</div>
      )}

      {/* Internal tabs */}
      <div className="aj-tabs" role="tablist">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`aj-tab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            role="tab"
            aria-selected={activeTab === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'config' && (
        noCalendario ? (
          <div className="aj-empty">No tienes calendario asignado</div>
        ) : !targetUserId ? (
          <div className="aj-empty">Selecciona un closer para gestionar su calendario</div>
        ) : (
          <div className="aj-cal-section">
            <CalendarioConfig config={config} onGuardar={guardarConfig} targetUserId={targetUserId} onGcalStatusChange={cargarConfig} />
          </div>
        )
      )}

      {activeTab === 'disponibilidad' && (
        noCalendario ? (
          <div className="aj-empty">No tienes calendario asignado</div>
        ) : !targetUserId ? (
          <div className="aj-empty">Selecciona un closer para gestionar su disponibilidad</div>
        ) : (
          <div className="aj-cal-section">
            {closerGestionadoNombre && (
              <p className="aj-desc">Disponibilidad de <strong>{closerGestionadoNombre}</strong></p>
            )}
            <CalendarioDisponibilidad
              disponibilidad={disponibilidad}
              onGuardar={guardarDisponibilidad}
              minimoHoras={config?.minimo_horas_semana}
            />
          </div>
        )
      )}

      {activeTab === 'bloqueos' && (
        noCalendario ? (
          <div className="aj-empty">No tienes calendario asignado</div>
        ) : !targetUserId ? (
          <div className="aj-empty">Selecciona un closer para gestionar sus bloqueos</div>
        ) : (
          <div className="aj-cal-section">
            {closerGestionadoNombre && (
              <p className="aj-desc">Bloqueos de <strong>{closerGestionadoNombre}</strong></p>
            )}
            <CalendarioBloqueos
              bloqueos={bloqueos}
              onCrear={crearBloqueo}
              onEliminar={eliminarBloqueo}
            />
          </div>
        )
      )}

      {activeTab === 'equipo' && puedeGestionarEquipo && (
        <div className="aj-cal-section">
          <CalendarioAdminPanel
            cargarClosersConConfig={cargarClosersConConfig}
            onActualizarMinimoHoras={actualizarMinimoHoras}
            onVerCalendario={handleVerCalendarioCloser}
          />
        </div>
      )}

      {activeTab === 'enlaces' && puedeGestionarEnlaces && (
        <div className="aj-cal-section">
          <CalendarioEnlaces
            enlaces={enlaces}
            setters={setters}
            onCrear={crearEnlace}
            onActualizar={actualizarEnlace}
            onEliminar={eliminarEnlace}
          />
        </div>
      )}
    </div>
  )
}
