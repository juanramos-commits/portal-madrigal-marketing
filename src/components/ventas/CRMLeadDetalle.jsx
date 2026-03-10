import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MoreVertical, ExternalLink,
  User, Mail, Phone, Globe, GitBranch, Users, FileText,
  Video, Tag, Clock, Calendar,
  PlusCircle, ArrowRightCircle, UserCheck, Pencil,
  Trash2, Send,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { logActividad } from '../../lib/logActividad'
import { invalidatePipelineCache } from '../../hooks/useVentasCRM'
import Select from '../ui/Select'
import ConfirmDialog from '../ui/ConfirmDialog'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import '../../styles/ventas-crm.css'

function formatDateTime(d) {
  if (!d) return '-'
  const parsed = new Date(d)
  if (isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatRelative(d) {
  if (!d) return ''
  const now = new Date()
  const date = new Date(d)
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'hace unos segundos'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`
  return formatDateTime(d)
}

function isSafeUrl(url) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const TRACKED_FIELDS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'nombre_negocio', label: 'Nombre del negocio' },
  { key: 'categoria_id', label: 'Categoría' },
  { key: 'fuente', label: 'Fuente' },
  { key: 'contactos_adicionales', label: 'Contactos adicionales' },
  { key: 'notas', label: 'Notas' },
  { key: 'resumen_setter', label: 'Resumen setter' },
  { key: 'resumen_closer', label: 'Resumen closer' },
  { key: 'enlace_grabacion', label: 'Enlace grabación' },
]

const ACTIVITY_ICONS = {
  creacion: PlusCircle,
  cambio_etapa: ArrowRightCircle,
  asignacion: UserCheck,
  edicion: Pencil,
  nota: FileText,
  cita_agendada: Calendar,
  cita_cancelada: Calendar,
  cita_reagendada: Calendar,
  venta: PlusCircle,
  venta_rechazada: Trash2,
}

// Module-level cache for static catalogs — survives across mounts/unmounts
// so opening/closing leads doesn't re-fetch 5 queries each time
let _catalogCache = null
let _catalogPromise = null

// Module-level cache for last loaded lead — prevents skeleton flash on remount
let _lastLeadCache = null // { id, data }

function fetchLeadDetail(leadId) {
  return Promise.all([
    supabase.from('ventas_leads').select(`
      id, nombre, email, telefono, nombre_negocio, categoria_id, fuente,
      contactos_adicionales, notas, resumen_setter, resumen_closer,
      enlace_grabacion, setter_asignado_id, closer_asignado_id, tags, created_at, updated_at,
      categoria:ventas_categorias(id, nombre),
      setter:usuarios!ventas_leads_setter_asignado_id_fkey(id, nombre, email),
      closer:usuarios!ventas_leads_closer_asignado_id_fkey(id, nombre, email)
    `).eq('id', leadId).single(),
    supabase.from('ventas_lead_pipeline').select(`
      id, lead_id, pipeline_id, etapa_id, contador_intentos, fecha_entrada,
      pipeline:ventas_pipelines(id, nombre),
      etapa:ventas_etapas(id, nombre, color, tipo, max_intentos)
    `).eq('lead_id', leadId).limit(20),
    supabase.from('ventas_citas').select(`
      id, lead_id, fecha_hora, estado, notas_closer, google_meet_url, origen_agendacion,
      estado_reunion_id,
      closer:usuarios!ventas_citas_closer_id_fkey(id, nombre),
      estado_reunion:ventas_reunion_estados(id, nombre, color)
    `).eq('lead_id', leadId).order('fecha_hora', { ascending: false }).limit(50),
    supabase.from('ventas_lead_etiquetas').select('lead_id, etiqueta_id, etiqueta:ventas_etiquetas(id, nombre, color)').eq('lead_id', leadId).limit(50),
  ]).then(([leadRes, pipelineRes, citasRes, etiquetasRes]) => {
    if (leadRes.error) throw leadRes.error
    return {
      ...leadRes.data,
      pipeline_states: pipelineRes.data || [],
      citas: citasRes.data || [],
      lead_etiquetas: (etiquetasRes.data || []).map(le => le.etiqueta),
    }
  })
}

// Prefetch disabled — was causing connection exhaustion on rapid navigation
export function prefetchLeadDetail() {
  // no-op: removed to avoid stacking HTTP requests
}

function loadCatalogs() {
  if (_catalogCache) return Promise.resolve(_catalogCache)
  if (_catalogPromise) return _catalogPromise
  _catalogPromise = Promise.all([
    supabase.from('ventas_categorias').select('id, nombre, orden').eq('activo', true).order('orden').limit(100),
    supabase.from('ventas_etiquetas').select('id, nombre, color').eq('activo', true).limit(200),
    supabase.from('ventas_roles_comerciales').select('id, usuario_id, rol, activo, usuario:usuarios(id, nombre, email)').eq('activo', true).limit(100),
    supabase.from('ventas_etapas').select('id, nombre, color, tipo, max_intentos, orden, pipeline:ventas_pipelines(id, nombre)').eq('activo', true).order('orden').limit(200),
    supabase.from('ventas_reunion_estados').select('id, nombre, color, orden').order('orden').limit(50),
  ]).then(([cats, etqs, roles, etapasAll, reunionEstadosData]) => {
    _catalogCache = {
      categorias: cats.data || [],
      etiquetas: etqs.data || [],
      roles: roles.data || [],
      etapas: etapasAll.data || [],
      reunionEstados: reunionEstadosData.data || [],
    }
    _catalogPromise = null
    return _catalogCache
  }).catch(err => {
    _catalogPromise = null
    throw err
  })
  return _catalogPromise
}

// Simple: use module cache if available, otherwise fetch from network
// No IndexedDB — it caused stale data bugs that required clearing browser data
async function loadCatalogsWithOffline() {
  return loadCatalogs()
}

export default function CRMLeadDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, usuario, tienePermiso } = useAuth()

  // Initialize from module cache if same lead — prevents skeleton flash on remount
  const cachedLead = _lastLeadCache?.id === id ? _lastLeadCache.data : null

  const [lead, setLead] = useState(cachedLead)
  const [categorias, setCategorias] = useState(_catalogCache?.categorias || [])
  const [etiquetasDisponibles, setEtiquetasDisponibles] = useState(_catalogCache?.etiquetas || [])
  const [actividad, setActividad] = useState([])
  const [actividadOffset, setActividadOffset] = useState(0)
  const [hasMoreActividad, setHasMoreActividad] = useState(true)
  const [loadingMoreActividad, setLoadingMoreActividad] = useState(false)
  const [rolesComerciales, setRolesComerciales] = useState(_catalogCache?.roles || [])
  const [allEtapas, setAllEtapas] = useState(_catalogCache?.etapas || [])
  const [setters, setSetters] = useState(_catalogCache?.roles?.filter(r => r.rol === 'setter' && r.activo) || [])
  const [closers, setClosers] = useState(_catalogCache?.roles?.filter(r => r.rol === 'closer' && r.activo) || [])
  // Start as loading only if no cached lead data
  const [loading, setLoading] = useState(!cachedLead)
  const [error, setError] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showEtapaDropdown, setShowEtapaDropdown] = useState(null)
  const [showAssignDropdown, setShowAssignDropdown] = useState(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [reunionEstados, setReunionEstados] = useState([])
  const [savingEstadoCita, setSavingEstadoCita] = useState(null)
  const [notaTexto, setNotaTexto] = useState('')
  const [enviandoNota, setEnviandoNota] = useState(false)

  const { showToast } = useToast()
  const savingActionRef = useRef(false)
  const isMountedRef = useRef(true)
  const debounceRefs = useRef({})
  const pendingFieldUpdatesRef = useRef({})
  const snapshotRef = useRef(null)
  const registroTimeoutRef = useRef(null)
  const loadDetailRef = useRef(0)
  // FIX: mounted guard prevents setState on unmounted component (fast navigation)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esAdminODirector = tienePermiso('ventas.crm.ver_todos')
  const puedeAsignar = tienePermiso('ventas.crm.asignar')
  const puedeEliminar = tienePermiso('ventas.crm.eliminar_leads')
  const puedeEditar = tienePermiso('ventas.crm.editar_leads')
  const esMiLeadSetter = lead?.setter_asignado_id === user?.id
  const esMiLeadCloser = lead?.closer_asignado_id === user?.id

  // ── Load static catalogs (module-level cache — no re-fetch on each mount) ──
  const cargarCatalogos = useCallback(async () => {
    try {
      const cache = await loadCatalogsWithOffline()
      if (!isMountedRef.current) return
      setCategorias(cache.categorias)
      setEtiquetasDisponibles(cache.etiquetas)
      setRolesComerciales(cache.roles)
      setAllEtapas(cache.etapas)
      setReunionEstados(cache.reunionEstados)
      setSetters(cache.roles.filter(r => r.rol === 'setter' && r.activo))
      setClosers(cache.roles.filter(r => r.rol === 'closer' && r.activo))
    } catch {
      // Swallow — catalogos are non-critical, will retry on next mount
    }
  }, [])

  // ── Full load (initial) ──────────────────────────────────────────
  const cargarLead = useCallback(async () => {
    const requestId = ++loadDetailRef.current
    console.log('[LeadDetail] cargarLead START', { id, requestId, mounted: isMountedRef.current })

    try {
      // Only show skeleton if no cached data to display
      if (!lead) setLoading(true)
      setError(null)

      // Start catalogs in background — don't block lead rendering
      cargarCatalogos()

      const leadResult = await fetchLeadDetail(id)
      console.log('[LeadDetail] fetchLeadDetail DONE', { hasResult: !!leadResult, requestId, currentRef: loadDetailRef.current })

      if (requestId !== loadDetailRef.current || !isMountedRef.current || !leadResult) return

      setLead(leadResult)
      snapshotRef.current = null
      // Save to module cache for instant display on remount
      _lastLeadCache = { id, data: leadResult }

      // Load activity in background — don't block the lead from rendering
      supabase.from('ventas_actividad')
        .select('id, lead_id, tipo, descripcion, created_at, usuario:usuarios(id, nombre)')
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
        .range(0, 19)
        .then(({ data: actData }) => {
          if (requestId !== loadDetailRef.current || !isMountedRef.current) return
          setActividad(actData || [])
          setActividadOffset(20)
          setHasMoreActividad((actData || []).length >= 20)
        })
        .catch(() => {}) // non-critical
    } catch (err) {
      console.error('[LeadDetail] cargarLead ERROR', err?.message || err)
      if (err?.name === 'AbortError' || err?.message?.includes('AbortError')) return
      if (!isMountedRef.current) return
      if (requestId === loadDetailRef.current) {
        setError(err.message || 'Error al cargar el lead')
      }
    } finally {
      console.log('[LeadDetail] cargarLead FINALLY', { mounted: isMountedRef.current, requestId })
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [id, cargarCatalogos]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh lead only (after actions like cambiarEtapa) ──────────
  const refrescarLead = useCallback(async () => {
    const requestId = ++loadDetailRef.current
    try {
      const leadResult = await fetchLeadDetail(id)
      if (requestId !== loadDetailRef.current || !isMountedRef.current || !leadResult) return
      setLead(leadResult)
      snapshotRef.current = null
    } catch (err) {
      if (err?.name === 'AbortError' || err?.message?.includes('AbortError')) return
      if (!isMountedRef.current) return
      if (requestId === loadDetailRef.current) {
        showToast(err.message || 'Error al refrescar', 'error')
      }
    }
  }, [id, showToast])

  // FIX: depend on id directly — reset state on lead change to avoid stale data
  useEffect(() => {
    if (!id) return
    // Only clear lead if navigating to a different lead (not same lead remount)
    if (_lastLeadCache?.id !== id) {
      setLead(null)
      setActividad([])
    }
    setError(null)
    cargarLead()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Safety net: force loading=false after timeout + auto-retry once ──
  const retryCountRef = useRef(0)
  useEffect(() => {
    if (!loading) { retryCountRef.current = 0; return }
    const timeout = setTimeout(() => {
      console.error('[CRM Detail] Loading timeout — forcing loading=false')
      setLoading(false)
      if (retryCountRef.current < 1) {
        retryCountRef.current++
        cargarLead()
      } else {
        setError('La carga tardó demasiado. Intenta refrescar.')
      }
    }, 15000)
    return () => clearTimeout(timeout)
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Snapshot for activity tracking ────────────────────────────────
  useEffect(() => {
    if (lead && !snapshotRef.current) {
      snapshotRef.current = {}
      TRACKED_FIELDS.forEach(f => {
        snapshotRef.current[f.key] = lead[f.key] ?? null
      })
    }
  }, [lead])

  // ── Load more activity ─────────────────────────────────────────────
  const cargarMasActividad = useCallback(async () => {
    if (loadingMoreActividad || !isMountedRef.current) return
    setLoadingMoreActividad(true)
    try {
      const { data } = await supabase.from('ventas_actividad')
        .select('id, lead_id, tipo, descripcion, created_at, usuario:usuarios(id, nombre)')
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
        .range(actividadOffset, actividadOffset + 19)

      if (!isMountedRef.current) return
      setActividad(prev => [...prev, ...(data || [])])
      setActividadOffset(prev => prev + 20)
      setHasMoreActividad((data || []).length >= 20)
    } catch {
      if (isMountedRef.current) showToast('Error al cargar más actividad', 'error')
    } finally {
      if (isMountedRef.current) setLoadingMoreActividad(false)
    }
  }, [id, actividadOffset, loadingMoreActividad, showToast])

  // ── Update lead field with debounce ────────────────────────────────
  const updateField = (field, value) => {
    // Allow setter/closer to edit their own resumen fields
    const canEditResumen = (field === 'resumen_setter' && esMiLeadSetter) || (field === 'resumen_closer' && esMiLeadCloser)
    if (!puedeEditar && !canEditResumen) return
    const prevValue = lead?.[field]
    setLead(prev => {
      const updated = { ...prev, [field]: value }
      // Keep module cache in sync with optimistic edits
      if (_lastLeadCache?.id === id) _lastLeadCache.data = updated
      return updated
    })
    pendingFieldUpdatesRef.current[field] = value

    if (debounceRefs.current[field]) clearTimeout(debounceRefs.current[field])
    debounceRefs.current[field] = setTimeout(async () => {
      const savedValue = pendingFieldUpdatesRef.current[field]
      delete pendingFieldUpdatesRef.current[field]
      try {
        const { error } = await supabase.from('ventas_leads').update({ [field]: savedValue ?? value }).eq('id', id)
        if (error) throw error
      } catch {
        if (!isMountedRef.current) return
        setLead(prev => ({ ...prev, [field]: prevValue }))
        showToast('Error al guardar. El cambio se ha revertido.', 'error')
      }
    }, 800)
  }

  // ── Activity tracking for editable fields ──────────────────────
  const formatValorParaLog = (campo, valor) => {
    if (valor === null || valor === undefined || valor === '') return '(vacío)'
    if (campo === 'categoria_id' && categorias?.length) {
      const cat = categorias.find(c => c.id === valor)
      return cat?.nombre || valor
    }
    if (typeof valor === 'string' && valor.length > 50) {
      return valor.substring(0, 50) + '...'
    }
    return String(valor)
  }

  // Keep a ref to the latest lead for use in registrarCambiosCampos
  const leadRef = useRef(lead)
  useEffect(() => { leadRef.current = lead }, [lead])

  const registrarCambiosCampos = useCallback(async () => {
    const currentLead = leadRef.current
    if (!snapshotRef.current || !currentLead) return

    const cambios = []
    TRACKED_FIELDS.forEach(field => {
      const antes = (snapshotRef.current[field.key] ?? '').toString().trim()
      const ahora = (currentLead[field.key] ?? '').toString().trim()
      if (antes !== ahora) {
        cambios.push({
          campo: field.key,
          label: field.label,
          anterior: snapshotRef.current[field.key],
          nuevo: currentLead[field.key],
        })
      }
    })

    if (cambios.length === 0) return

    let descripcion
    if (cambios.length === 1) {
      const c = cambios[0]
      descripcion = `${c.label} actualizado: ${formatValorParaLog(c.campo, c.anterior)} → ${formatValorParaLog(c.campo, c.nuevo)}`
    } else {
      descripcion = `Campos actualizados: ${cambios.map(c => c.label).join(', ')}`
    }

    try {
      await supabase.from('ventas_actividad').insert({
        lead_id: currentLead.id,
        usuario_id: user.id,
        tipo: 'edicion',
        descripcion,
        datos: {
          cambios: cambios.map(c => ({ campo: c.campo, anterior: c.anterior, nuevo: c.nuevo })),
          campos_modificados: cambios.map(c => c.campo),
          via: 'detalle_inline',
        },
      })
    } catch (err) {
      console.error('Error registrando actividad de edición:', err)
      return // Don't update snapshot if insert failed
    }

    logActividad('crm', 'editar', descripcion, { entidad: 'lead', entidad_id: currentLead.id })

    // Actualizar snapshot
    if (snapshotRef.current) {
      TRACKED_FIELDS.forEach(f => {
        snapshotRef.current[f.key] = currentLead[f.key] ?? null
      })
    }
  }, [user]) // stable: only depends on user, reads lead from ref

  const registrarRef = useRef(registrarCambiosCampos)
  useEffect(() => { registrarRef.current = registrarCambiosCampos }, [registrarCambiosCampos])

  const registrarCambiosCamposDebounced = useCallback(() => {
    if (registroTimeoutRef.current) clearTimeout(registroTimeoutRef.current)
    registroTimeoutRef.current = setTimeout(() => {
      registrarRef.current?.()
    }, 2000)
  }, [])

  // Cleanup: flush pending saves and activity tracking on unmount or id change
  useEffect(() => {
    // Reset mounted state on id change (e.g. navigating between leads)
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      // 1. Clear debounce timers (prevent double-saves)
      Object.values(debounceRefs.current).forEach(clearTimeout)
      debounceRefs.current = {}

      // 2. Flush any pending field saves in a single call (fire-and-forget)
      const pending = { ...pendingFieldUpdatesRef.current }
      pendingFieldUpdatesRef.current = {}
      if (Object.keys(pending).length > 0) {
        // Invalidate CRM cache so returning to kanban fetches fresh data
        invalidatePipelineCache()
        supabase.from('ventas_leads').update(pending).eq('id', id)
          .then(({ error }) => { if (error) console.error('[CRM Detail] Unmount flush failed:', error) })
          .catch(() => {}) // swallow network errors on unmount
      }

      // 3. Flush activity tracking (fire-and-forget, swallow ALL errors including async)
      if (registroTimeoutRef.current) clearTimeout(registroTimeoutRef.current)
      registroTimeoutRef.current = null
      try {
        const p = registrarRef.current?.()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      } catch {}
      snapshotRef.current = null
    }
  }, [id])

  // ── Change stage ───────────────────────────────────────────────────
  const cambiarEtapa = async (pipelineId, nuevaEtapaId) => {
    if (savingActionRef.current) return
    savingActionRef.current = true
    setShowEtapaDropdown(null)
    try {
      const ps = lead.pipeline_states?.find(p => p.pipeline_id === pipelineId)
      const etapaAnterior = ps?.etapa?.nombre || 'Sin etapa'
      const etapaNueva = allEtapas.find(e => e.id === nuevaEtapaId)?.nombre || 'Sin etapa'
      const pipelineNombre = ps?.pipeline?.nombre || ''

      const { error: etapaErr } = await supabase.from('ventas_lead_pipeline')
        .update({ etapa_id: nuevaEtapaId, fecha_entrada: new Date().toISOString() })
        .eq('lead_id', id)
        .eq('pipeline_id', pipelineId)
      if (etapaErr) throw etapaErr

      await supabase.from('ventas_actividad').insert({
        lead_id: id, usuario_id: user.id, tipo: 'cambio_etapa',
        descripcion: `${pipelineNombre}: ${etapaAnterior} → ${etapaNueva}`,
        datos: { pipeline_id: pipelineId, etapa_anterior_id: ps?.etapa_id, etapa_nueva_id: nuevaEtapaId },
      })

      logActividad('crm', 'cambio_etapa', `${pipelineNombre}: ${etapaAnterior} → ${etapaNueva}`, { entidad: 'lead', entidad_id: id })

      if (!isMountedRef.current) return
      showToast('Etapa actualizada', 'success')
      await refrescarLead()
    } catch {
      if (isMountedRef.current) showToast('Error al cambiar etapa', 'error')
    } finally {
      savingActionRef.current = false
    }
  }

  // ── Assign setter/closer ───────────────────────────────────────────
  const asignarSetter = async (setterId) => {
    if (savingActionRef.current) return
    savingActionRef.current = true
    const prevSetter = lead.setter
    const prevSetterId = lead.setter_asignado_id
    const nuevoSetter = setters.find(s => s.usuario_id === setterId)
    const prevNombre = prevSetter?.nombre || 'Ninguno'
    const nuevoNombre = nuevoSetter?.usuario?.nombre || 'Ninguno'
    // Optimistic update
    setLead(prev => ({
      ...prev,
      setter_asignado_id: setterId || null,
      setter: setterId ? { id: setterId, nombre: nuevoSetter?.usuario?.nombre, email: nuevoSetter?.usuario?.email } : null,
    }))
    try {
      const { error: setterErr } = await supabase.from('ventas_leads').update({ setter_asignado_id: setterId || null }).eq('id', id)
      if (setterErr) throw setterErr
      supabase.from('ventas_actividad').insert({
        lead_id: id, usuario_id: user.id, tipo: 'asignacion',
        descripcion: `Setter: ${prevNombre} → ${nuevoNombre}`,
        datos: { setter_id: setterId, anterior: prevSetterId },
      }).then(() => {})
      logActividad('crm', 'asignar', `Setter: ${prevNombre} → ${nuevoNombre}`, { entidad: 'lead', entidad_id: id })
      if (isMountedRef.current) showToast('Setter actualizado', 'success')
    } catch {
      if (isMountedRef.current) {
        setLead(prev => ({ ...prev, setter_asignado_id: prevSetterId, setter: prevSetter }))
        showToast('Error al asignar setter', 'error')
      }
    } finally {
      savingActionRef.current = false
    }
  }

  const asignarCloser = async (closerId) => {
    if (savingActionRef.current) return
    savingActionRef.current = true
    const prevCloser = lead.closer
    const prevCloserId = lead.closer_asignado_id
    const nuevoCloser = closers.find(c => c.usuario_id === closerId)
    const prevNombre = prevCloser?.nombre || 'Ninguno'
    const nuevoNombre = nuevoCloser?.usuario?.nombre || 'Ninguno'
    // Optimistic update
    setLead(prev => ({
      ...prev,
      closer_asignado_id: closerId || null,
      closer: closerId ? { id: closerId, nombre: nuevoCloser?.usuario?.nombre, email: nuevoCloser?.usuario?.email } : null,
    }))
    try {
      const { error: closerErr } = await supabase.from('ventas_leads').update({ closer_asignado_id: closerId || null }).eq('id', id)
      if (closerErr) throw closerErr
      supabase.from('ventas_actividad').insert({
        lead_id: id, usuario_id: user.id, tipo: 'asignacion',
        descripcion: `Closer: ${prevNombre} → ${nuevoNombre}`,
        datos: { closer_id: closerId, anterior: prevCloserId },
      }).then(() => {})
      logActividad('crm', 'asignar', `Closer: ${prevNombre} → ${nuevoNombre}`, { entidad: 'lead', entidad_id: id })
      if (isMountedRef.current) showToast('Closer actualizado', 'success')
    } catch {
      if (isMountedRef.current) {
        setLead(prev => ({ ...prev, closer_asignado_id: prevCloserId, closer: prevCloser }))
        showToast('Error al asignar closer', 'error')
      }
    } finally {
      savingActionRef.current = false
    }
  }

  // ── Delete lead (super_admin only via RPC) ─────────────────────────
  const eliminar = async () => {
    if (savingActionRef.current) return
    savingActionRef.current = true
    try {
      const { data, error } = await supabase.rpc('ventas_eliminar_lead', { p_lead_id: id })
      if (error) throw error
      if (data && !data.ok) throw new Error(data.error)
      if (isMountedRef.current) showToast('Lead eliminado', 'success')
      navigate('/ventas/crm', { replace: true })
    } catch (err) {
      if (isMountedRef.current) showToast(err.message || 'Error al eliminar el lead', 'error')
    } finally {
      savingActionRef.current = false
    }
  }

  // ── Add note to timeline ──────────────────────────────────────────
  const añadirNota = async () => {
    const texto = notaTexto.trim()
    if (!texto || enviandoNota) return
    setEnviandoNota(true)
    try {
      const { error } = await supabase.from('ventas_actividad').insert({
        lead_id: id,
        usuario_id: user.id,
        tipo: 'nota',
        descripcion: texto,
      })
      if (error) throw error
      if (!isMountedRef.current) return
      setNotaTexto('')
      // Add to top of timeline optimistically
      setActividad(prev => [{
        id: crypto.randomUUID(),
        tipo: 'nota',
        descripcion: texto,
        created_at: new Date().toISOString(),
        usuario: { nombre: usuario?.nombre || user?.email },
      }, ...prev])
    } catch {
      if (isMountedRef.current) showToast('Error al añadir nota', 'error')
    } finally {
      if (isMountedRef.current) setEnviandoNota(false)
    }
  }

  // ── Tags ───────────────────────────────────────────────────────────
  const addTag = async (etiquetaId) => {
    setShowTagPicker(false)
    const etiqueta = etiquetasDisponibles.find(e => e.id === etiquetaId)
    if (!etiqueta) return
    // Optimistic update
    setLead(prev => ({
      ...prev,
      lead_etiquetas: [...(prev.lead_etiquetas || []), etiqueta],
    }))
    try {
      const { error } = await supabase.from('ventas_lead_etiquetas').insert({ lead_id: id, etiqueta_id: etiquetaId })
      if (error) {
        if (error.code === '23505') return // duplicate — already exists, optimistic state is correct
        throw error
      }
      supabase.from('ventas_actividad').insert({
        lead_id: id, usuario_id: user.id, tipo: 'etiqueta',
        descripcion: `Etiqueta añadida: ${etiqueta.nombre}`,
        datos: { etiqueta_id: etiquetaId, accion: 'añadir' },
      }).then(() => {})
      logActividad('crm', 'etiqueta', `Etiqueta añadida: ${etiqueta.nombre}`, { entidad: 'lead', entidad_id: id })

      // Auto-move to "lost" stage when "No Lead" tag is added
      if (etiqueta.nombre === 'No Lead') {
        const pipelineStates = lead.pipeline_states || []
        for (const ps of pipelineStates) {
          if (ps.etapa?.tipo === 'lost') continue // already in lost
          const lostEtapa = allEtapas.find(e => e.pipeline?.id === ps.pipeline_id && e.tipo === 'lost')
          if (lostEtapa) {
            await supabase.from('ventas_lead_pipeline')
              .update({ etapa_id: lostEtapa.id, fecha_entrada: new Date().toISOString() })
              .eq('lead_id', id)
              .eq('pipeline_id', ps.pipeline_id)
            await supabase.from('ventas_actividad').insert({
              lead_id: id, usuario_id: user.id, tipo: 'cambio_etapa',
              descripcion: `${ps.pipeline?.nombre}: ${ps.etapa?.nombre} → ${lostEtapa.nombre} (auto: No Lead)`,
              datos: { pipeline_id: ps.pipeline_id, etapa_anterior_id: ps.etapa_id, etapa_nueva_id: lostEtapa.id, auto: 'no_lead' },
            })
          }
        }
        if (isMountedRef.current) {
          showToast('Lead movido a Lost automáticamente', 'info')
          await refrescarLead()
        }
      }
    } catch (err) {
      // Rollback
      if (isMountedRef.current) {
        setLead(prev => ({
          ...prev,
          lead_etiquetas: (prev.lead_etiquetas || []).filter(e => e.id !== etiquetaId),
        }))
        showToast('Error al añadir etiqueta', 'error')
      }
      console.error('Error addTag:', err)
    }
  }

  const cambiarEstadoReunion = async (citaId, estadoReunionId) => {
    setSavingEstadoCita(citaId)
    const prevCitas = lead.citas
    // Optimistic update
    setLead(prev => ({
      ...prev,
      citas: (prev.citas || []).map(c =>
        c.id === citaId
          ? { ...c, estado_reunion_id: estadoReunionId || null, estado_reunion: reunionEstados.find(e => e.id === estadoReunionId) || null }
          : c
      ),
    }))
    try {
      const { error } = await supabase
        .from('ventas_citas')
        .update({ estado_reunion_id: estadoReunionId || null, updated_at: new Date().toISOString() })
        .eq('id', citaId)
      if (error) throw error
      if (isMountedRef.current) showToast('Estado de reunión actualizado', 'success')
    } catch {
      if (isMountedRef.current) {
        setLead(prev => ({ ...prev, citas: prevCitas }))
        showToast('Error al actualizar estado de reunión', 'error')
      }
    } finally {
      if (isMountedRef.current) setSavingEstadoCita(null)
    }
  }

  const removeTag = async (etiquetaId) => {
    const etiqueta = (lead.lead_etiquetas || []).find(e => e.id === etiquetaId)
    const prevTags = lead.lead_etiquetas
    // Optimistic update
    setLead(prev => ({
      ...prev,
      lead_etiquetas: (prev.lead_etiquetas || []).filter(e => e.id !== etiquetaId),
    }))
    try {
      const { error } = await supabase.from('ventas_lead_etiquetas').delete().eq('lead_id', id).eq('etiqueta_id', etiquetaId)
      if (error) throw error
      supabase.from('ventas_actividad').insert({
        lead_id: id, usuario_id: user.id, tipo: 'etiqueta',
        descripcion: `Etiqueta quitada: ${etiqueta?.nombre || 'Desconocida'}`,
        datos: { etiqueta_id: etiquetaId, accion: 'quitar' },
      }).then(() => {})
      logActividad('crm', 'etiqueta', `Etiqueta quitada: ${etiqueta?.nombre || 'Desconocida'}`, { entidad: 'lead', entidad_id: id })
    } catch (err) {
      // Rollback
      if (isMountedRef.current) {
        setLead(prev => ({ ...prev, lead_etiquetas: prevTags }))
        showToast('Error al quitar etiqueta', 'error')
      }
      console.error('Error removeTag:', err)
    }
  }

  // ── Close menu on outside click ────────────────────────────────────
  const menuRef = useRef(null)
  useEffect(() => {
    if (!showMenu) return
    const handler = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return
      setShowMenu(false)
    }
    // Defer to avoid capturing the opening click
    const rafId = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handler)
    })
    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousedown', handler)
    }
  }, [showMenu])

  // ── Close tag picker on outside click ────────────────────────────
  const tagPickerRef = useRef(null)
  useEffect(() => {
    if (!showTagPicker) return
    const handler = (e) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target)) {
        setShowTagPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTagPicker])

  // ── Loading / Error states ─────────────────────────────────────────
  // Only show skeleton when there's no lead data at all (first load)
  // If we have data, show the content while refreshing silently in background
  if (loading && !lead) {
    return (
      <div className="crm-detail">
        <div className="crm-skeleton" style={{ width: 80, height: 16, marginBottom: 16 }} />
        <div className="crm-skeleton" style={{ width: '50%', height: 36, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          <div className="crm-skeleton" style={{ width: 80, height: 24, borderRadius: 20 }} />
          <div className="crm-skeleton" style={{ width: 100, height: 24, borderRadius: 20 }} />
        </div>
        <div className="crm-detail-body">
          <div className="crm-detail-main">
            <div className="crm-skeleton" style={{ height: 220, borderRadius: 12 }} />
            <div className="crm-skeleton" style={{ height: 100, borderRadius: 12 }} />
            <div className="crm-skeleton" style={{ height: 200, borderRadius: 12 }} />
          </div>
          <div className="crm-detail-sidebar">
            <div className="crm-skeleton" style={{ height: 100, borderRadius: 12 }} />
            <div className="crm-skeleton" style={{ height: 80, borderRadius: 12 }} />
            <div className="crm-skeleton" style={{ height: 240, borderRadius: 12 }} />
          </div>
        </div>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="crm-detail">
        <button className="crm-detail-back" onClick={() => navigate('/ventas/crm')}>
          <ArrowLeft /> Volver al CRM
        </button>
        <div className="crm-error">
          <p>{error || 'Lead no encontrado'}</p>
          <button className="ui-btn ui-btn--secondary ui-btn--md" onClick={() => navigate('/ventas/crm')}>Volver</button>
        </div>
      </div>
    )
  }

  const tagIdsOnLead = new Set((lead.lead_etiquetas || []).map(e => e.id))
  const availableTags = etiquetasDisponibles.filter(e => !tagIdsOnLead.has(e.id))

  return (
    <div className="crm-detail">
      <button className="crm-detail-back" onClick={() => navigate('/ventas/crm')}>
        <ArrowLeft /> Volver al CRM
      </button>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="crm-detail-header">
        <div className="crm-detail-header-left">
          <input
            className="crm-detail-name"
            value={lead.nombre || ''}
            onChange={e => updateField('nombre', e.target.value)}
            onBlur={registrarCambiosCamposDebounced}
            placeholder="Nombre del lead"
            aria-label="Nombre del lead"
            readOnly={!puedeEditar}
          />
          <div className="crm-detail-badges">
            {lead.pipeline_states?.map(ps => ps.etapa && (
              <span key={ps.id} className="crm-badge" style={{ background: `${ps.etapa.color}20`, color: ps.etapa.color }}>
                <span className="crm-badge-dot" style={{ background: ps.etapa.color }} />
                {ps.etapa.nombre}
              </span>
            ))}
            {lead.categoria && (
              <span className="crm-badge" style={{ background: 'var(--color-category-subtle)', color: 'var(--color-category)' }}>
                {lead.categoria.nombre}
              </span>
            )}
          </div>
        </div>

        <div className="crm-detail-actions">
          {lead.telefono && (
            <button
              className="crm-card-wa crm-card-wa--lg"
              onClick={() => window.open(`https://wa.me/${lead.telefono.replace(/[^0-9+]/g, '')}`, '_blank', 'noopener,noreferrer')}
              aria-label="Contactar por WhatsApp"
            >
              <WhatsAppIcon />
            </button>
          )}

          <div className="crm-dropdown" ref={menuRef} onClick={e => e.stopPropagation()}>
            <button className="crm-detail-menu-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Menú de acciones" aria-expanded={showMenu} aria-haspopup="menu">
              <MoreVertical />
            </button>

            {showMenu && (
              <div className="crm-dropdown-menu" role="menu">
                {lead.pipeline_states?.map(ps => (
                  <div key={ps.pipeline_id}>
                    <button
                      className="crm-dropdown-item"
                      onClick={(e) => { e.stopPropagation(); setShowEtapaDropdown(showEtapaDropdown === ps.pipeline_id ? null : ps.pipeline_id) }}
                    >
                      <GitBranch size={14} />
                      Cambiar etapa ({ps.pipeline?.nombre?.split(' ')[0]})
                    </button>
                    {showEtapaDropdown === ps.pipeline_id && (
                      <div className="crm-dropdown-submenu">
                        {allEtapas.filter(e => e.pipeline?.id === ps.pipeline_id).map(e => (
                          <button
                            key={e.id}
                            className="crm-dropdown-item"
                            onClick={() => cambiarEtapa(ps.pipeline_id, e.id)}
                          >
                            <span className="crm-badge-dot" style={{ background: e.color || 'var(--text-muted)' }} />
                            {e.nombre}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {puedeAsignar && (
                  <>
                    <div className="crm-dropdown-sep" />
                    <div className="crm-dropdown-label">Asignaciones</div>
                    <button
                      className="crm-dropdown-item"
                      onClick={(e) => { e.stopPropagation(); setShowAssignDropdown(showAssignDropdown === 'setter' ? null : 'setter') }}
                    >
                      <UserCheck size={14} />
                      Setter: {lead.setter?.nombre || 'Sin asignar'}
                    </button>
                    {showAssignDropdown === 'setter' && (
                      <div className="crm-dropdown-submenu">
                        <button
                          className={`crm-dropdown-item${!lead.setter_asignado_id ? ' active' : ''}`}
                          onClick={() => { setShowMenu(false); asignarSetter('') }}
                        >
                          Sin setter
                        </button>
                        {setters.map(s => (
                          <button
                            key={s.usuario_id}
                            className={`crm-dropdown-item${lead.setter_asignado_id === s.usuario_id ? ' active' : ''}`}
                            onClick={() => { setShowMenu(false); asignarSetter(s.usuario_id) }}
                          >
                            {s.usuario?.nombre || s.usuario?.email}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      className="crm-dropdown-item"
                      onClick={(e) => { e.stopPropagation(); setShowAssignDropdown(showAssignDropdown === 'closer' ? null : 'closer') }}
                    >
                      <Users size={14} />
                      Closer: {lead.closer?.nombre || 'Sin asignar'}
                    </button>
                    {showAssignDropdown === 'closer' && (
                      <div className="crm-dropdown-submenu">
                        <button
                          className={`crm-dropdown-item${!lead.closer_asignado_id ? ' active' : ''}`}
                          onClick={() => { setShowMenu(false); asignarCloser('') }}
                        >
                          Sin closer
                        </button>
                        {closers.map(c => (
                          <button
                            key={c.usuario_id}
                            className={`crm-dropdown-item${lead.closer_asignado_id === c.usuario_id ? ' active' : ''}`}
                            onClick={() => { setShowMenu(false); asignarCloser(c.usuario_id) }}
                          >
                            {c.usuario?.nombre || c.usuario?.email}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {puedeEliminar && (
                  <>
                    <div className="crm-dropdown-sep" />
                    <button className="crm-dropdown-item danger" onClick={() => { setShowMenu(false); setShowConfirmDelete(true) }}>
                      <Trash2 size={14} />
                      Eliminar lead
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dual Layout Body ─────────────────────────────────────── */}
      <div className="crm-detail-body">
        {/* ── Main Column ──────────────────────────────────────────── */}
        <div className="crm-detail-main">
          {/* ── Contact Info ──────────────────────────────────────── */}
          <div className="crm-section">
            <div className="crm-section-title"><User /> Información de contacto</div>
            <div className="crm-field-grid">
              <div className="crm-field">
                <label>Email</label>
                <div className="crm-input-wrap">
                  <Mail className="crm-input-icon" />
                  <input type="email" value={lead.email || ''} onChange={e => updateField('email', e.target.value)} onBlur={registrarCambiosCamposDebounced} placeholder="email@ejemplo.com" readOnly={!puedeEditar} />
                </div>
              </div>
              <div className="crm-field">
                <label>Teléfono</label>
                <div className="crm-input-wrap">
                  <Phone className="crm-input-icon" />
                  <input type="tel" value={lead.telefono || ''} onChange={e => updateField('telefono', e.target.value)} onBlur={registrarCambiosCamposDebounced} placeholder="+34 600 000 000" readOnly={!puedeEditar} />
                </div>
              </div>
              <div className="crm-field">
                <label>Nombre del negocio</label>
                <div className="crm-input-wrap">
                  <Globe className="crm-input-icon" />
                  <input value={lead.nombre_negocio || ''} onChange={e => updateField('nombre_negocio', e.target.value)} onBlur={registrarCambiosCamposDebounced} readOnly={!puedeEditar} />
                </div>
              </div>
              <div className="crm-field">
                <label>Categoría</label>
                <Select value={lead.categoria_id || ''} onChange={e => { updateField('categoria_id', e.target.value || null); registrarCambiosCamposDebounced() }} disabled={!puedeEditar}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </Select>
              </div>
              <div className="crm-field">
                <label>Fuente</label>
                <input value={lead.fuente || ''} onChange={e => updateField('fuente', e.target.value)} onBlur={registrarCambiosCamposDebounced} readOnly={!puedeEditar} />
              </div>
              <div className="crm-field" style={{ gridColumn: '1 / -1' }}>
                <label>Contactos adicionales</label>
                <textarea value={lead.contactos_adicionales || ''} onChange={e => updateField('contactos_adicionales', e.target.value)} onBlur={registrarCambiosCamposDebounced} rows={2} readOnly={!puedeEditar} />
              </div>
            </div>
          </div>

          {/* ── Pipeline States ───────────────────────────────────── */}
          <div className="crm-section">
            <div className="crm-section-title"><GitBranch /> Estado en pipelines</div>
            <div className="crm-pipeline-states">
              {lead.pipeline_states?.map(ps => (
                <div key={ps.id} className="crm-pipeline-state">
                  <div className="crm-pipeline-state-left">
                    <span className="crm-pipeline-state-name">{ps.pipeline?.nombre}</span>
                    <span className="crm-badge" style={{ background: `${ps.etapa?.color || 'var(--text-muted)'}20`, color: ps.etapa?.color || 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                      <span className="crm-badge-dot" style={{ background: ps.etapa?.color }} />
                      {ps.etapa?.nombre || 'Sin etapa'}
                    </span>
                  </div>
                  {ps.contador_intentos > 0 && (ps.etapa?.tipo === 'ghosting' || ps.etapa?.tipo === 'seguimiento') && (
                    <span className="crm-card-attempts">
                      {ps.etapa.tipo === 'ghosting' && ps.etapa.max_intentos
                        ? `${ps.contador_intentos}/${ps.etapa.max_intentos}`
                        : `#${ps.contador_intentos}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Notas ─────────────────────────────────────────────── */}
          <div className="crm-section">
            <div className="crm-section-title"><FileText /> Notas y resúmenes</div>
            <div className="crm-field" style={{ marginBottom: 'var(--space-md)' }}>
              <label>Notas</label>
              <textarea
                value={lead.notas || ''}
                onChange={e => updateField('notas', e.target.value)}
                onBlur={registrarCambiosCamposDebounced}
                rows={3}
                placeholder="Notas sobre el lead..."
                readOnly={!puedeEditar}
              />
            </div>
            <div className="crm-field" style={{ marginBottom: 'var(--space-md)' }}>
              <label>Resumen Setter</label>
              <textarea
                value={lead.resumen_setter || ''}
                onChange={(puedeEditar || esMiLeadSetter) ? e => updateField('resumen_setter', e.target.value) : undefined}
                onBlur={(puedeEditar || esMiLeadSetter) ? registrarCambiosCamposDebounced : undefined}
                rows={3}
                placeholder="Resumen del setter..."
                readOnly={!puedeEditar && !esMiLeadSetter}
                style={!puedeEditar && !esMiLeadSetter ? { opacity: 0.6 } : undefined}
              />
            </div>
            <div className="crm-field">
              <label>Resumen Closer</label>
              <textarea
                value={lead.resumen_closer || ''}
                onChange={(puedeEditar || esMiLeadCloser) ? e => updateField('resumen_closer', e.target.value) : undefined}
                onBlur={(puedeEditar || esMiLeadCloser) ? registrarCambiosCamposDebounced : undefined}
                rows={3}
                placeholder="Resumen del closer..."
                readOnly={!puedeEditar && !esMiLeadCloser}
                style={!puedeEditar && !esMiLeadCloser ? { opacity: 0.6 } : undefined}
              />
            </div>
          </div>

          {/* ── Enlace grabación ──────────────────────────────────── */}
          <div className="crm-section">
            <div className="crm-section-title"><Video /> Enlace de grabación</div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <div className="crm-field" style={{ flex: 1 }}>
                <div className="crm-input-wrap">
                  <ExternalLink className="crm-input-icon" />
                  <input
                    value={lead.enlace_grabacion || ''}
                    onChange={(puedeEditar || esMiLeadCloser) ? e => updateField('enlace_grabacion', e.target.value) : undefined}
                    onBlur={(puedeEditar || esMiLeadCloser) ? registrarCambiosCamposDebounced : undefined}
                    placeholder="https://..."
                    readOnly={!puedeEditar && !esMiLeadCloser}
                    style={!puedeEditar && !esMiLeadCloser ? { opacity: 0.6 } : undefined}
                  />
                </div>
              </div>
              {lead.enlace_grabacion && isSafeUrl(lead.enlace_grabacion) && (
                <button
                  className="ui-btn ui-btn--secondary ui-btn--sm"
                  style={{ flexShrink: 0, marginTop: 'auto' }}
                  onClick={() => window.open(lead.enlace_grabacion, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink size={14} /> Abrir
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Sidebar Column ──────────────────────────────────────── */}
        <div className="crm-detail-sidebar">
          {/* ── Asignaciones ──────────────────────────────────────── */}
          <div className="crm-section">
            <div className="crm-section-title"><Users /> Asignaciones</div>
            <div className="crm-field-grid">
              <div className="crm-field">
                <label>Setter asignado</label>
                {puedeAsignar ? (
                  <Select value={lead.setter_asignado_id || ''} onChange={e => asignarSetter(e.target.value)}>
                    <option value="">Sin setter</option>
                    {setters.map(s => <option key={s.usuario_id} value={s.usuario_id}>{s.usuario?.nombre}</option>)}
                  </Select>
                ) : (
                  <input value={lead.setter?.nombre || 'Sin asignar'} readOnly style={{ opacity: 0.7 }} />
                )}
              </div>
              <div className="crm-field">
                <label>Closer asignado</label>
                {puedeAsignar ? (
                  <Select value={lead.closer_asignado_id || ''} onChange={e => asignarCloser(e.target.value)}>
                    <option value="">Sin closer</option>
                    {closers.map(c => <option key={c.usuario_id} value={c.usuario_id}>{c.usuario?.nombre}</option>)}
                  </Select>
                ) : (
                  <input value={lead.closer?.nombre || 'Sin asignar'} readOnly style={{ opacity: 0.7 }} />
                )}
              </div>
            </div>
          </div>

          {/* ── Etiquetas ─────────────────────────────────────────── */}
          <div className="crm-section">
            <div className="crm-section-title"><Tag /> Etiquetas</div>
            <div className="crm-tags">
              {lead.lead_etiquetas?.map(etq => (
                <span key={etq.id} className="crm-tag" style={{ borderColor: etq.color || 'var(--border)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: etq.color || 'var(--text-muted)' }} />
                  {etq.nombre}
                  {puedeEditar && (
                    <button className="crm-tag-remove" onClick={() => removeTag(etq.id)} aria-label={`Quitar etiqueta ${etq.nombre}`}>
                      &times;
                    </button>
                  )}
                </span>
              ))}
              {puedeEditar && availableTags.length > 0 && (
                <div style={{ position: 'relative' }} ref={tagPickerRef}>
                  <button className="crm-tag-add" onClick={() => setShowTagPicker(!showTagPicker)}>
                    + Añadir
                  </button>
                  {showTagPicker && (
                    <div className="crm-dropdown-menu" style={{ top: '100%', left: 0, minWidth: 160 }}>
                      {availableTags.map(e => (
                        <button key={e.id} className="crm-dropdown-item" onClick={() => addTag(e.id)}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.color || 'var(--text-muted)' }} />
                          {e.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Reuniones / Citas ─────────────────────────────────── */}
          <div className="crm-section">
            <div className="crm-section-title"><Calendar /> Reuniones ({lead.citas?.length || 0})</div>
            {(!lead.citas || lead.citas.length === 0) && (
              <div className="crm-empty">Sin reuniones agendadas</div>
            )}
            {(lead.citas || []).map(cita => {
              const citaPasada = new Date(cita.fecha_hora) < new Date()
              const puedeMarcar = (puedeEditar || esMiLeadCloser) && cita.estado !== 'cancelada'
              return (
                <div key={cita.id} className="crm-cita">
                  <div style={{ flex: 1 }}>
                    <div className="crm-cita-fecha">
                      {formatDateTime(cita.fecha_hora)}
                      {citaPasada && !cita.estado_reunion && cita.estado !== 'cancelada' && (
                        <span className="vc-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', marginLeft: 6, fontSize: 'var(--font-xs)' }}>Pendiente de marcar</span>
                      )}
                    </div>
                    <div className="crm-cita-closer">
                      {cita.closer?.nombre || 'Sin closer'}
                      {cita.origen_agendacion === 'enlace_setter' && <span className="vc-badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', marginLeft: 6, fontSize: 'var(--font-xs)' }}>Via enlace</span>}
                      {cita.origen_agendacion === 'enlace_campana' && <span className="vc-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', marginLeft: 6, fontSize: 'var(--font-xs)' }}>Campaña</span>}
                    </div>
                    {cita.notas_closer && <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>{cita.notas_closer}</div>}
                    {puedeMarcar && citaPasada && (
                      <div style={{ marginTop: 'var(--space-1)' }}>
                        <select
                          className="crm-estado-reunion-select"
                          value={cita.estado_reunion_id || ''}
                          onChange={(e) => cambiarEstadoReunion(cita.id, e.target.value)}
                          disabled={savingEstadoCita === cita.id}
                          style={{ fontSize: 'var(--font-sm)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-main)' }}
                        >
                          <option value="">Marcar resultado...</option>
                          {reunionEstados.filter(e => e.nombre !== 'Cancelada').map(e => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-1-5)', alignItems: 'center' }}>
                    {cita.estado_reunion ? (
                      <span className="crm-cita-estado" style={{ background: `${cita.estado_reunion.color}20`, color: cita.estado_reunion.color }}>
                        {cita.estado_reunion.nombre}
                      </span>
                    ) : cita.estado === 'cancelada' ? (
                      <span className="crm-cita-estado" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                        Cancelada
                      </span>
                    ) : (
                      <span className="crm-cita-estado" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                        {citaPasada ? 'Sin marcar' : 'Agendada'}
                      </span>
                    )}
                    {cita.google_meet_url && isSafeUrl(cita.google_meet_url) && (
                      <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => window.open(cita.google_meet_url, '_blank', 'noopener,noreferrer')}>Meet</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Actividad ─────────────────────────────────────────── */}
          <div className="crm-section">
            <div className="crm-section-title"><Clock /> Historial de actividad</div>
            <div className="crm-nota-input">
              <textarea
                value={notaTexto}
                onChange={e => setNotaTexto(e.target.value)}
                placeholder="Añadir una nota..."
                rows={2}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); añadirNota() } }}
              />
              <button
                className="crm-nota-btn"
                onClick={añadirNota}
                disabled={!notaTexto.trim() || enviandoNota}
                title="Añadir nota"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="crm-timeline">
              {actividad.length === 0 && (
                <div className="crm-empty">Sin actividad registrada</div>
              )}
              {actividad.map(act => {
                const IconComp = ACTIVITY_ICONS[act.tipo] || Clock
                return (
                  <div key={act.id} className="crm-timeline-item">
                    <span className={`crm-timeline-icon tipo-${act.tipo || 'default'}`}>
                      <IconComp />
                    </span>
                    <div className="crm-timeline-content">
                      <div className="crm-timeline-desc">{act.descripcion}</div>
                      <div className="crm-timeline-meta">
                        {act.usuario?.nombre || 'Sistema'} · {formatRelative(act.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
              {hasMoreActividad && (
                <button
                  className="ui-btn ui-btn--secondary ui-btn--sm"
                  style={{ margin: 'var(--space-sm) auto', display: 'block' }}
                  onClick={cargarMasActividad}
                  disabled={loadingMoreActividad}
                >
                  {loadingMoreActividad ? 'Cargando...' : 'Cargar más'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirm Delete Modal ────────────────────────────────────── */}
      <ConfirmDialog
        open={showConfirmDelete}
        title="Eliminar Lead"
        message={<>¿Estás seguro de que quieres eliminar a <strong>{lead?.nombre}</strong>? Esta acción no se puede deshacer.</>}
        variant="danger"
        confirmText="Eliminar"
        onConfirm={eliminar}
        onCancel={() => setShowConfirmDelete(false)}
      />

    </div>
  )
}
