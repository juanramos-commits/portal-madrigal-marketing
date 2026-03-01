import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MoreVertical, ExternalLink,
  User, Mail, Phone, Globe, GitBranch, Users, FileText,
  Video, Tag, Clock, Calendar,
  PlusCircle, ArrowRightCircle, UserCheck, Pencil,
  CheckCircle, AlertCircle, Trash2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Select from '../ui/Select'
import ConfirmDialog from '../ui/ConfirmDialog'
import '../../styles/ventas-crm.css'

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

function formatDateTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
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
}

export default function CRMLeadDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, usuario } = useAuth()

  const [lead, setLead] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [etiquetasDisponibles, setEtiquetasDisponibles] = useState([])
  const [actividad, setActividad] = useState([])
  const [actividadOffset, setActividadOffset] = useState(0)
  const [hasMoreActividad, setHasMoreActividad] = useState(true)
  const [rolesComerciales, setRolesComerciales] = useState([])
  const [allEtapas, setAllEtapas] = useState([])
  const [setters, setSetters] = useState([])
  const [closers, setClosers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showEtapaDropdown, setShowEtapaDropdown] = useState(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [toast, setToast] = useState(null)

  const debounceRefs = useRef({})
  const snapshotRef = useRef(null)
  const registroTimeoutRef = useRef(null)
  const loadDetailRef = useRef(0)

  const esAdmin = usuario?.tipo === 'super_admin'
  const misRoles = rolesComerciales.filter(r => r.usuario_id === user?.id && r.activo)
  const esDirector = misRoles.some(r => r.rol === 'director_ventas' || r.rol === 'super_admin')
  const esAdminODirector = esAdmin || esDirector
  const esMiLeadSetter = lead?.setter_asignado_id === user?.id
  const esMiLeadCloser = lead?.closer_asignado_id === user?.id

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load lead detail ───────────────────────────────────────────────
  const cargarLead = useCallback(async () => {
    const requestId = ++loadDetailRef.current

    try {
      setLoading(true)
      setError(null)

      const [
        { data: leadData, error: leadErr },
        { data: pipelineStates },
        { data: citas },
        { data: leadEtiquetas },
        { data: cats },
        { data: etqs },
        { data: roles },
        { data: etapasAll },
      ] = await Promise.all([
        supabase.from('ventas_leads').select(`
          *,
          categoria:ventas_categorias(id, nombre),
          setter:usuarios!ventas_leads_setter_asignado_id_fkey(id, nombre, email),
          closer:usuarios!ventas_leads_closer_asignado_id_fkey(id, nombre, email)
        `).eq('id', id).single(),
        supabase.from('ventas_lead_pipeline').select(`
          *, pipeline:ventas_pipelines(id, nombre),
          etapa:ventas_etapas(id, nombre, color, tipo, max_intentos)
        `).eq('lead_id', id),
        supabase.from('ventas_citas').select(`
          *, closer:usuarios!ventas_citas_closer_id_fkey(id, nombre),
          estado_reunion:ventas_reunion_estados(id, nombre, color)
        `).eq('lead_id', id).order('fecha_hora', { ascending: false }),
        supabase.from('ventas_lead_etiquetas').select('*, etiqueta:ventas_etiquetas(*)').eq('lead_id', id),
        supabase.from('ventas_categorias').select('*').eq('activo', true).order('orden'),
        supabase.from('ventas_etiquetas').select('*').eq('activo', true),
        supabase.from('ventas_roles_comerciales').select('*, usuario:usuarios(id, nombre, email)').eq('activo', true),
        supabase.from('ventas_etapas').select('*, pipeline:ventas_pipelines(id, nombre)').eq('activo', true).order('orden'),
      ])

      if (requestId !== loadDetailRef.current) return
      if (leadErr) throw leadErr

      setLead({
        ...leadData,
        pipeline_states: pipelineStates || [],
        citas: citas || [],
        lead_etiquetas: (leadEtiquetas || []).map(le => le.etiqueta),
      })
      setCategorias(cats || [])
      setEtiquetasDisponibles(etqs || [])
      setRolesComerciales(roles || [])
      setAllEtapas(etapasAll || [])
      setSetters((roles || []).filter(r => r.rol === 'setter' && r.activo))
      setClosers((roles || []).filter(r => r.rol === 'closer' && r.activo))

      // Reset snapshot para que se recree con datos frescos
      snapshotRef.current = null

      // Load initial activity
      const { data: actData } = await supabase.from('ventas_actividad')
        .select('*, usuario:usuarios(id, nombre)')
        .eq('lead_id', id)
        .order('created_at', { ascending: false })
        .range(0, 19)

      if (requestId !== loadDetailRef.current) return

      setActividad(actData || [])
      setActividadOffset(20)
      setHasMoreActividad((actData || []).length >= 20)
    } catch (err) {
      if (requestId === loadDetailRef.current) {
        setError(err.message || 'Error al cargar el lead')
      }
    } finally {
      if (requestId === loadDetailRef.current) {
        setLoading(false)
      }
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    cargarLead()
  }, [cargarLead])

  // ── Safety net: force loading=false after timeout ──────────────────
  useEffect(() => {
    if (!loading) return
    const timeout = setTimeout(() => {
      console.error('[CRM Detail] Loading timeout — forcing loading=false')
      setLoading(false)
      setError('La carga tardó demasiado. Intenta refrescar.')
    }, 15000)
    return () => clearTimeout(timeout)
  }, [loading])

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
  const cargarMasActividad = async () => {
    const { data } = await supabase.from('ventas_actividad')
      .select('*, usuario:usuarios(id, nombre)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .range(actividadOffset, actividadOffset + 19)

    setActividad(prev => [...prev, ...(data || [])])
    setActividadOffset(prev => prev + 20)
    setHasMoreActividad((data || []).length >= 20)
  }

  // ── Update lead field with debounce ────────────────────────────────
  const updateField = (field, value) => {
    setLead(prev => ({ ...prev, [field]: value }))

    if (debounceRefs.current[field]) clearTimeout(debounceRefs.current[field])
    debounceRefs.current[field] = setTimeout(async () => {
      try {
        await supabase.from('ventas_leads').update({ [field]: value }).eq('id', id)
      } catch (_) {
        showToast('Error al guardar', 'error')
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

  const registrarCambiosCampos = useCallback(async () => {
    if (!snapshotRef.current || !lead) return

    const cambios = []
    TRACKED_FIELDS.forEach(field => {
      const antes = (snapshotRef.current[field.key] ?? '').toString().trim()
      const ahora = (lead[field.key] ?? '').toString().trim()
      if (antes !== ahora) {
        cambios.push({
          campo: field.key,
          label: field.label,
          anterior: snapshotRef.current[field.key],
          nuevo: lead[field.key],
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

    const { error } = await supabase.from('ventas_actividad').insert({
      lead_id: lead.id,
      usuario_id: user.id,
      tipo: 'edicion',
      descripcion,
      datos: {
        cambios: cambios.map(c => ({ campo: c.campo, anterior: c.anterior, nuevo: c.nuevo })),
        campos_modificados: cambios.map(c => c.campo),
        via: 'detalle_inline',
      },
    })
    if (error) console.error('Error registrando actividad de edición:', error)

    // Actualizar snapshot
    TRACKED_FIELDS.forEach(f => {
      snapshotRef.current[f.key] = lead[f.key] ?? null
    })
  }, [lead, user, categorias])

  const registrarRef = useRef(registrarCambiosCampos)
  useEffect(() => { registrarRef.current = registrarCambiosCampos }, [registrarCambiosCampos])

  const registrarCambiosCamposDebounced = useCallback(() => {
    if (registroTimeoutRef.current) clearTimeout(registroTimeoutRef.current)
    registroTimeoutRef.current = setTimeout(() => {
      registrarRef.current?.()
    }, 2000)
  }, [])

  // Cleanup: registrar cambios pendientes al desmontar
  useEffect(() => {
    return () => {
      if (registroTimeoutRef.current) clearTimeout(registroTimeoutRef.current)
      registrarRef.current?.()
      snapshotRef.current = null
    }
  }, [])

  // ── Change stage ───────────────────────────────────────────────────
  const cambiarEtapa = async (pipelineId, nuevaEtapaId) => {
    setShowEtapaDropdown(null)
    try {
      const ps = lead.pipeline_states?.find(p => p.pipeline_id === pipelineId)
      const etapaAnterior = ps?.etapa?.nombre || 'Sin etapa'
      const etapaNueva = allEtapas.find(e => e.id === nuevaEtapaId)?.nombre || 'Sin etapa'
      const pipelineNombre = ps?.pipeline?.nombre || ''

      await supabase.from('ventas_lead_pipeline')
        .update({ etapa_id: nuevaEtapaId, fecha_entrada: new Date().toISOString() })
        .eq('lead_id', id)
        .eq('pipeline_id', pipelineId)

      await supabase.from('ventas_actividad').insert({
        lead_id: id, usuario_id: user.id, tipo: 'cambio_etapa',
        descripcion: `${pipelineNombre}: ${etapaAnterior} → ${etapaNueva}`,
        datos: { pipeline_id: pipelineId, etapa_anterior_id: ps?.etapa_id, etapa_nueva_id: nuevaEtapaId },
      })

      showToast('Etapa actualizada')
      cargarLead()
    } catch (_) {
      showToast('Error al cambiar etapa', 'error')
    }
  }

  // ── Assign setter/closer ───────────────────────────────────────────
  const asignarSetter = async (setterId) => {
    try {
      const prevNombre = lead.setter?.nombre || 'Ninguno'
      const nuevoSetter = setters.find(s => s.usuario_id === setterId)
      const nuevoNombre = nuevoSetter?.usuario?.nombre || 'Ninguno'
      await supabase.from('ventas_leads').update({ setter_asignado_id: setterId || null }).eq('id', id)
      await supabase.from('ventas_actividad').insert({
        lead_id: id, usuario_id: user.id, tipo: 'asignacion',
        descripcion: `Setter: ${prevNombre} → ${nuevoNombre}`,
        datos: { setter_id: setterId, anterior: lead.setter_asignado_id },
      })
      showToast('Setter actualizado')
      cargarLead()
    } catch (_) {
      showToast('Error', 'error')
    }
  }

  const asignarCloser = async (closerId) => {
    try {
      const prevNombre = lead.closer?.nombre || 'Ninguno'
      const nuevoCloser = closers.find(c => c.usuario_id === closerId)
      const nuevoNombre = nuevoCloser?.usuario?.nombre || 'Ninguno'
      await supabase.from('ventas_leads').update({ closer_asignado_id: closerId || null }).eq('id', id)
      await supabase.from('ventas_actividad').insert({
        lead_id: id, usuario_id: user.id, tipo: 'asignacion',
        descripcion: `Closer: ${prevNombre} → ${nuevoNombre}`,
        datos: { closer_id: closerId, anterior: lead.closer_asignado_id },
      })
      showToast('Closer actualizado')
      cargarLead()
    } catch (_) {
      showToast('Error', 'error')
    }
  }

  // ── Delete lead ────────────────────────────────────────────────────
  const eliminar = async () => {
    try {
      await supabase.from('ventas_leads').delete().eq('id', id)
      navigate('/ventas/crm', { replace: true })
    } catch (_) {
      showToast('Error al eliminar', 'error')
    }
  }

  // ── Tags ───────────────────────────────────────────────────────────
  const addTag = async (etiquetaId) => {
    setShowTagPicker(false)
    try {
      const { error } = await supabase.from('ventas_lead_etiquetas').insert({ lead_id: id, etiqueta_id: etiquetaId })
      if (error) {
        if (error.code !== '23505') {
          showToast('Error al añadir etiqueta', 'error')
          console.error('Error addTag:', error)
        }
        return
      }
      cargarLead()
    } catch (err) {
      showToast('Error al añadir etiqueta', 'error')
      console.error('Error addTag:', err)
    }
  }

  const removeTag = async (etiquetaId) => {
    try {
      const { error } = await supabase.from('ventas_lead_etiquetas').delete().eq('lead_id', id).eq('etiqueta_id', etiquetaId)
      if (error) {
        showToast('Error al quitar etiqueta', 'error')
        console.error('Error removeTag:', error)
        return
      }
      setLead(prev => ({
        ...prev,
        lead_etiquetas: prev.lead_etiquetas.filter(e => e.id !== etiquetaId),
      }))
    } catch (err) {
      showToast('Error al quitar etiqueta', 'error')
      console.error('Error removeTag:', err)
    }
  }

  // ── Close menu on outside click ────────────────────────────────────
  useEffect(() => {
    if (!showMenu) return
    const handler = () => setShowMenu(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
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
  if (loading) {
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
          <button className="btn" onClick={() => navigate('/ventas/crm')}>Volver</button>
        </div>
      </div>
    )
  }

  const tagIdsOnLead = new Set(lead.lead_etiquetas.map(e => e.id))
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
              className="crm-card-wa"
              style={{ width: 36, height: 36 }}
              onClick={() => window.open(`https://wa.me/${lead.telefono.replace(/[^0-9+]/g, '')}`, '_blank')}
              title="WhatsApp"
            >
              <WhatsAppIcon />
            </button>
          )}

          <div className="crm-dropdown" onClick={e => e.stopPropagation()}>
            <button className="crm-detail-menu-btn" onClick={() => setShowMenu(!showMenu)}>
              <MoreVertical />
            </button>

            {showMenu && (
              <div className="crm-dropdown-menu">
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
                            className="crm-dropdown-item crm-dropdown-item-sm"
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

                {esAdminODirector && (
                  <>
                    <div className="crm-dropdown-sep" />
                    <div className="crm-dropdown-label">Asignaciones</div>
                    <div className="crm-dropdown-select-item" onClick={e => e.stopPropagation()}>
                      <UserCheck size={14} />
                      <Select
                        value={lead.setter_asignado_id || ''}
                        onChange={e => asignarSetter(e.target.value)}
                      >
                        <option value="">Sin setter</option>
                        {setters.map(s => (
                          <option key={s.usuario_id} value={s.usuario_id}>
                            {s.usuario?.nombre || s.usuario?.email}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="crm-dropdown-select-item" onClick={e => e.stopPropagation()}>
                      <Users size={14} />
                      <Select
                        value={lead.closer_asignado_id || ''}
                        onChange={e => asignarCloser(e.target.value)}
                      >
                        <option value="">Sin closer</option>
                        {closers.map(c => (
                          <option key={c.usuario_id} value={c.usuario_id}>
                            {c.usuario?.nombre || c.usuario?.email}
                          </option>
                        ))}
                      </Select>
                    </div>
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
                <label>Nombre</label>
                <input value={lead.nombre || ''} onChange={e => updateField('nombre', e.target.value)} onBlur={registrarCambiosCamposDebounced} />
              </div>
              <div className="crm-field">
                <label>Email</label>
                <div className="crm-input-wrap">
                  <Mail className="crm-input-icon" />
                  <input type="email" value={lead.email || ''} onChange={e => updateField('email', e.target.value)} onBlur={registrarCambiosCamposDebounced} placeholder="email@ejemplo.com" />
                </div>
              </div>
              <div className="crm-field">
                <label>Teléfono</label>
                <div className="crm-input-wrap">
                  <Phone className="crm-input-icon" />
                  <input type="tel" value={lead.telefono || ''} onChange={e => updateField('telefono', e.target.value)} onBlur={registrarCambiosCamposDebounced} placeholder="+34 600 000 000" />
                </div>
              </div>
              <div className="crm-field">
                <label>Nombre del negocio</label>
                <div className="crm-input-wrap">
                  <Globe className="crm-input-icon" />
                  <input value={lead.nombre_negocio || ''} onChange={e => updateField('nombre_negocio', e.target.value)} onBlur={registrarCambiosCamposDebounced} />
                </div>
              </div>
              <div className="crm-field">
                <label>Categoría</label>
                <Select value={lead.categoria_id || ''} onChange={e => { updateField('categoria_id', e.target.value || null); registrarCambiosCamposDebounced() }}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </Select>
              </div>
              <div className="crm-field">
                <label>Fuente</label>
                <input value={lead.fuente || ''} onChange={e => updateField('fuente', e.target.value)} onBlur={registrarCambiosCamposDebounced} />
              </div>
              <div className="crm-field" style={{ gridColumn: '1 / -1' }}>
                <label>Contactos adicionales</label>
                <textarea value={lead.contactos_adicionales || ''} onChange={e => updateField('contactos_adicionales', e.target.value)} onBlur={registrarCambiosCamposDebounced} rows={2} />
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
              />
            </div>
            <div className="crm-field" style={{ marginBottom: 'var(--space-md)' }}>
              <label>Resumen Setter</label>
              <textarea
                value={lead.resumen_setter || ''}
                onChange={e => updateField('resumen_setter', e.target.value)}
                onBlur={registrarCambiosCamposDebounced}
                rows={3}
                placeholder="Resumen del setter..."
                readOnly={!esAdminODirector && !esMiLeadSetter}
                style={!esAdminODirector && !esMiLeadSetter ? { opacity: 0.6 } : undefined}
              />
            </div>
            <div className="crm-field">
              <label>Resumen Closer</label>
              <textarea
                value={lead.resumen_closer || ''}
                onChange={e => updateField('resumen_closer', e.target.value)}
                onBlur={registrarCambiosCamposDebounced}
                rows={3}
                placeholder="Resumen del closer..."
                readOnly={!esAdminODirector && !esMiLeadCloser}
                style={!esAdminODirector && !esMiLeadCloser ? { opacity: 0.6 } : undefined}
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
                    onChange={e => updateField('enlace_grabacion', e.target.value)}
                    onBlur={registrarCambiosCamposDebounced}
                    placeholder="https://..."
                    readOnly={!esAdminODirector && !esMiLeadCloser}
                    style={!esAdminODirector && !esMiLeadCloser ? { opacity: 0.6 } : undefined}
                  />
                </div>
              </div>
              {lead.enlace_grabacion && (
                <button
                  className="btn btn-sm"
                  style={{ flexShrink: 0, marginTop: 'auto' }}
                  onClick={() => window.open(lead.enlace_grabacion, '_blank')}
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
                {esAdminODirector ? (
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
                {esAdminODirector ? (
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
                  <button className="crm-tag-remove" onClick={() => removeTag(etq.id)} title="Quitar">
                    &times;
                  </button>
                </span>
              ))}
              {availableTags.length > 0 && (
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

          {/* ── Citas ─────────────────────────────────────────────── */}
          {lead.citas?.length > 0 && (
            <div className="crm-section">
              <div className="crm-section-title"><Calendar /> Citas ({lead.citas.length})</div>
              {lead.citas.map(cita => (
                <div key={cita.id} className="crm-cita">
                  <div>
                    <div className="crm-cita-fecha">{formatDateTime(cita.fecha_hora)}</div>
                    <div className="crm-cita-closer">{cita.closer?.nombre || 'Sin closer'}</div>
                    {cita.notas_closer && <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>{cita.notas_closer}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-1-5)', alignItems: 'center' }}>
                    {cita.estado_reunion ? (
                      <span className="crm-cita-estado" style={{ background: `${cita.estado_reunion.color}20`, color: cita.estado_reunion.color }}>
                        {cita.estado_reunion.nombre}
                      </span>
                    ) : (
                      <span className="crm-cita-estado" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                        {cita.estado}
                      </span>
                    )}
                    {cita.google_meet_url && (
                      <button className="btn btn-sm" onClick={() => window.open(cita.google_meet_url, '_blank')}>Meet</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Actividad ─────────────────────────────────────────── */}
          <div className="crm-section">
            <div className="crm-section-title"><Clock /> Historial de actividad</div>
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
                  className="btn btn-sm"
                  style={{ margin: 'var(--space-sm) auto', display: 'block' }}
                  onClick={cargarMasActividad}
                >
                  Cargar más
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

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div className={`crm-toast ${toast.type}`}>
          <span className="crm-toast-icon">
            {toast.type === 'success' ? <CheckCircle /> : <AlertCircle />}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
