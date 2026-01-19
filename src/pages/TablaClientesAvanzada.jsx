import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Colores del tema de la app
const ESTADOS = {
  'campañas_activas': { label: 'Campañas Activas', color: '#2ee59d', bg: 'rgba(46, 229, 157, 0.15)' },
  'pausado': { label: 'Pausado', color: '#ffa94d', bg: 'rgba(255, 169, 77, 0.15)' },
  'baja': { label: 'Baja', color: '#ff6b6b', bg: 'rgba(255, 107, 107, 0.15)' },
  'onboarding': { label: 'Onboarding', color: '#6495ed', bg: 'rgba(100, 149, 237, 0.15)' }
}

const normalizar = (texto) => {
  if (!texto) return ''
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// TODAS las columnas disponibles organizadas por grupo
const COLUMNAS_DISPONIBLES = [
  // Datos básicos del cliente
  { key: 'numero_cliente', label: '#', defaultWidth: 60, group: 'Básicos' },
  { key: 'nombre_comercial', label: 'Nombre Comercial', defaultWidth: 180, group: 'Básicos' },
  { key: 'nombre_pila', label: 'Nombre Pila', defaultWidth: 120, group: 'Básicos' },
  { key: 'email_portal', label: 'Email Portal', defaultWidth: 200, group: 'Básicos' },
  { key: 'password_portal', label: 'Contraseña', defaultWidth: 120, group: 'Básicos' },
  { key: 'telefono', label: 'Teléfono', defaultWidth: 120, group: 'Básicos' },
  { key: 'estado', label: 'Estado', defaultWidth: 140, isEstado: true, group: 'Básicos' },
  { key: 'servicio_contratado', label: 'Servicio', defaultWidth: 150, group: 'Básicos' },
  { key: 'especialidad', label: 'Especialidad', defaultWidth: 150, group: 'Básicos' },
  { key: 'fecha_onboarding', label: 'Fecha Onboarding', defaultWidth: 130, isDate: true, group: 'Básicos' },
  { key: 'tiene_whatsapp', label: 'WhatsApp', defaultWidth: 80, isBool: true, group: 'Básicos' },
  { key: 'created_at', label: 'Fecha Creación', defaultWidth: 130, isDate: true, group: 'Básicos' },

  // Facturación
  { key: 'facturacion.nombre_fiscal', label: 'Nombre Fiscal', defaultWidth: 180, group: 'Facturación' },
  { key: 'facturacion.cif_nif', label: 'CIF/NIF', defaultWidth: 110, group: 'Facturación' },
  { key: 'facturacion.direccion_fiscal', label: 'Dirección Fiscal', defaultWidth: 200, group: 'Facturación' },
  { key: 'facturacion.ciudad', label: 'Ciudad', defaultWidth: 120, group: 'Facturación' },
  { key: 'facturacion.provincia', label: 'Provincia', defaultWidth: 120, group: 'Facturación' },
  { key: 'facturacion.codigo_postal', label: 'C.P.', defaultWidth: 80, group: 'Facturación' },
  { key: 'facturacion.pais', label: 'País', defaultWidth: 100, group: 'Facturación' },

  // URLs y Redes Sociales
  { key: 'urls.pagina_web', label: 'Web', defaultWidth: 180, isUrl: true, group: 'URLs' },
  { key: 'urls.pagina_web_2', label: 'Web 2', defaultWidth: 180, isUrl: true, group: 'URLs' },
  { key: 'urls.instagram', label: 'Instagram', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'urls.facebook', label: 'Facebook', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'urls.linkedin', label: 'LinkedIn', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'urls.tiktok', label: 'TikTok', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'urls.youtube', label: 'YouTube', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'urls.otra_url_1', label: 'Otra URL 1', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'urls.otra_url_2', label: 'Otra URL 2', defaultWidth: 150, isUrl: true, group: 'URLs' },

  // Lanzamiento
  { key: 'lanzamiento.encargado_landing', label: 'Enc. Landing', defaultWidth: 120, group: 'Lanzamiento' },
  { key: 'lanzamiento.encargado_creativos', label: 'Enc. Creativos', defaultWidth: 120, group: 'Lanzamiento' },
  { key: 'lanzamiento.estado', label: 'Estado Lanz.', defaultWidth: 130, isEstado: true, group: 'Lanzamiento' },
  { key: 'lanzamiento.pack', label: 'Pack', defaultWidth: 100, group: 'Lanzamiento' },
  { key: 'lanzamiento.web_cliente', label: 'Web Cliente', defaultWidth: 150, isUrl: true, group: 'Lanzamiento' },
  { key: 'lanzamiento.enlace_botones', label: 'Enlace Botones', defaultWidth: 150, isUrl: true, group: 'Lanzamiento' },
  { key: 'lanzamiento.correo_electronico', label: 'Correo', defaultWidth: 180, group: 'Lanzamiento' },
  { key: 'lanzamiento.fecha_onboarding', label: 'Fecha Onb. Lanz.', defaultWidth: 130, isDate: true, group: 'Lanzamiento' },
  { key: 'lanzamiento.fecha_subida_material', label: 'Fecha Material', defaultWidth: 130, isDate: true, group: 'Lanzamiento' },
  { key: 'lanzamiento.fecha_lanzamiento', label: 'Fecha Lanzamiento', defaultWidth: 140, isDate: true, group: 'Lanzamiento' },
  { key: 'lanzamiento.link_landing', label: 'Link Landing', defaultWidth: 150, isUrl: true, group: 'Lanzamiento' },
  { key: 'lanzamiento.link_tally', label: 'Link Tally', defaultWidth: 150, isUrl: true, group: 'Lanzamiento' },
  { key: 'lanzamiento.link_creativos', label: 'Link Creativos', defaultWidth: 150, isUrl: true, group: 'Lanzamiento' },

  // Info Adicional / Integraciones
  { key: 'info_adicional.id_discord', label: 'Discord ID', defaultWidth: 120, group: 'Integraciones' },
  { key: 'info_adicional.id_chatwoot', label: 'Chatwoot ID', defaultWidth: 120, group: 'Integraciones' },
  { key: 'info_adicional.url_drive', label: 'URL Drive', defaultWidth: 180, isUrl: true, group: 'Integraciones' },
  { key: 'info_adicional.url_drive_creativos', label: 'Drive Creativos', defaultWidth: 180, isUrl: true, group: 'Integraciones' },

  // Branding
  { key: 'branding.colores', label: 'Colores', defaultWidth: 150, group: 'Branding' },
  { key: 'branding.tipografias', label: 'Tipografías', defaultWidth: 150, group: 'Branding' },
  { key: 'branding.tono_marca', label: 'Tono Marca', defaultWidth: 150, group: 'Branding' },
  { key: 'branding.logo_url', label: 'Logo URL', defaultWidth: 150, isUrl: true, group: 'Branding' },
  { key: 'branding.guia_estilo_url', label: 'Guía Estilo', defaultWidth: 150, isUrl: true, group: 'Branding' },
]

const DEFAULT_VISIBLE = ['numero_cliente', 'nombre_comercial', 'email_portal', 'telefono', 'estado', 'servicio_contratado', 'facturacion.ciudad']

export default function TablaClientesAvanzada() {
  const navigate = useNavigate()
  const { tienePermiso } = useAuth()

  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [vistaActual, setVistaActual] = useState('tabla')
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre_comercial: '', telefono: '', email_portal: '', password_portal: '', tiene_whatsapp: true
  })
  const [guardando, setGuardando] = useState(false)

  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem('tabla_column_order')
    return saved ? JSON.parse(saved) : COLUMNAS_DISPONIBLES.map(c => c.key)
  })
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('tabla_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE
  })
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('tabla_column_widths')
    if (saved) return JSON.parse(saved)
    const widths = {}
    COLUMNAS_DISPONIBLES.forEach(c => { widths[c.key] = c.defaultWidth })
    return widths
  })
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [draggedColumn, setDraggedColumn] = useState(null)
  const [resizing, setResizing] = useState(null)
  const tableRef = useRef(null)

  useEffect(() => { localStorage.setItem('tabla_column_order', JSON.stringify(columnOrder)) }, [columnOrder])
  useEffect(() => { localStorage.setItem('tabla_visible_columns', JSON.stringify(visibleColumns)) }, [visibleColumns])
  useEffect(() => { localStorage.setItem('tabla_column_widths', JSON.stringify(columnWidths)) }, [columnWidths])

  useEffect(() => { cargarClientes() }, [filtroEstado, vistaActual])

  const cargarClientes = async () => {
    setLoading(true)
    try {
      let query
      if (vistaActual === 'completa') {
        query = supabase.from('clientes').select(`*, facturacion:clientes_facturacion(*), urls:clientes_urls(*), lanzamiento:clientes_lanzamiento(*), info_adicional:clientes_info_adicional(*), branding:clientes_branding(*)`).order('nombre_comercial', { ascending: true })
      } else {
        query = supabase.from('clientes').select('*').order('nombre_comercial', { ascending: true })
      }
      if (filtroEstado !== 'todos') query = query.eq('estado', filtroEstado)
      const { data, error } = await query
      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error('Error cargando clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const clientesFiltrados = clientes.filter(cliente => {
    if (!busqueda) return true
    const busquedaNorm = normalizar(busqueda)
    return normalizar(cliente.nombre_comercial).includes(busquedaNorm) ||
           normalizar(cliente.email_portal).includes(busquedaNorm) ||
           normalizar(cliente.telefono).includes(busquedaNorm) ||
           normalizar(cliente.nombre_pila).includes(busquedaNorm)
  })

  const clientesOrdenados = [...clientesFiltrados].sort((a, b) => {
    if (!sortConfig.key) return 0
    const aVal = getNestedValue(a, sortConfig.key)
    const bVal = getNestedValue(b, sortConfig.key)
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    const comparison = String(aVal).localeCompare(String(bVal), 'es', { numeric: true })
    return sortConfig.direction === 'asc' ? comparison : -comparison
  })

  const crearCliente = async () => {
    if (!nuevoCliente.nombre_comercial.trim()) return
    setGuardando(true)
    try {
      const { data, error } = await supabase.from('clientes').insert({
        nombre_comercial: nuevoCliente.nombre_comercial.trim(),
        telefono: nuevoCliente.telefono.trim(),
        email_portal: nuevoCliente.email_portal.trim(),
        password_portal: nuevoCliente.password_portal,
        tiene_whatsapp: nuevoCliente.tiene_whatsapp,
        estado: 'onboarding'
      }).select().single()
      if (error) throw error
      setModalNuevoCliente(false)
      setNuevoCliente({ nombre_comercial: '', telefono: '', email_portal: '', password_portal: '', tiene_whatsapp: true })
      navigate(`/clientes/${data.id}`)
    } catch (error) {
      console.error('Error creando cliente:', error)
      alert('Error al crear el cliente')
    } finally {
      setGuardando(false)
    }
  }

  const getEstadoBadge = (estado) => {
    const config = ESTADOS[estado] || { label: estado, color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)' }
    return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', background: config.bg, color: config.color, whiteSpace: 'nowrap' }}>{config.label}</span>
  }

  const getNestedValue = (obj, path) => {
    const parts = path.split('.')
    let value = obj
    for (const part of parts) {
      if (value === null || value === undefined) return null
      value = value[part]
    }
    return value
  }

  const formatValue = (value, col) => {
    if (value === null || value === undefined || value === '') return <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
    if (col.isEstado) return getEstadoBadge(value)
    if (col.isBool) return value ? <span style={{ color: '#2ee59d' }}>✓</span> : <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
    if (col.isDate) {
      try { return new Date(value).toLocaleDateString('es-ES') } catch { return value }
    }
    if (col.isUrl && value) {
      return <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline', textUnderlineOffset: '2px' }} onClick={(e) => e.stopPropagation()}>{value.replace(/^https?:\/\/(www\.)?/, '').substring(0, 22)}</a>
    }
    return String(value)
  }

  const handleDragStart = (e, key) => { setDraggedColumn(key); e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e, key) => {
    e.preventDefault()
    if (draggedColumn && draggedColumn !== key) {
      const newOrder = [...columnOrder]
      const dragIdx = newOrder.indexOf(draggedColumn)
      const targetIdx = newOrder.indexOf(key)
      newOrder.splice(dragIdx, 1)
      newOrder.splice(targetIdx, 0, draggedColumn)
      setColumnOrder(newOrder)
    }
  }
  const handleDragEnd = () => setDraggedColumn(null)

  const startResize = useCallback((e, key) => {
    e.preventDefault(); e.stopPropagation()
    setResizing({ key, startX: e.clientX, startWidth: columnWidths[key] })
  }, [columnWidths])

  useEffect(() => {
    if (!resizing) return
    const handleMouseMove = (e) => {
      const diff = e.clientX - resizing.startX
      setColumnWidths(prev => ({ ...prev, [resizing.key]: Math.max(50, resizing.startWidth + diff) }))
    }
    const handleMouseUp = () => setResizing(null)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp) }
  }, [resizing])

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  const toggleColumn = (key) => {
    setVisibleColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const getColumnConfig = (key) => COLUMNAS_DISPONIBLES.find(c => c.key === key)
  const orderedVisibleColumns = columnOrder.filter(key => visibleColumns.includes(key)).map(key => getColumnConfig(key)).filter(Boolean)

  const VistaTabla = () => (
    <div className="custom-scrollbar" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>Nombre</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>Email</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>Teléfono</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>Estado</th>
            <th style={{ width: '60px', padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}></th>
          </tr>
        </thead>
        <tbody>
          {clientesFiltrados.map(cliente => (
            <tr key={cliente.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${cliente.id}`)} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontWeight: '600', fontSize: '14px' }}>
                    {cliente.nombre_comercial?.charAt(0)}
                  </div>
                  <div>
                    <span style={{ fontWeight: 500, color: 'var(--text)' }}>{cliente.nombre_comercial}</span>
                    {cliente.numero_cliente && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>#{cliente.numero_cliente}</span>}
                  </div>
                </div>
              </td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px' }}>{cliente.email_portal || '—'}</td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px' }}>{cliente.telefono || '—'}</td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{getEstadoBadge(cliente.estado)}</td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ padding: '6px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const VistaCompleta = () => (
    <div className="custom-scrollbar" ref={tableRef} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
          <tr>
            {orderedVisibleColumns.map(col => (
              <th key={col.key} draggable onDragStart={(e) => handleDragStart(e, col.key)} onDragOver={(e) => handleDragOver(e, col.key)} onDragEnd={handleDragEnd} onClick={() => handleSort(col.key)}
                style={{ position: 'relative', padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: columnWidths[col.key], minWidth: columnWidths[col.key], maxWidth: columnWidths[col.key], cursor: 'pointer', userSelect: 'none', background: draggedColumn === col.key ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ cursor: 'grab', opacity: 0.4 }}>⋮⋮</span>
                  <span>{col.label}</span>
                  {sortConfig.key === col.key && <span style={{ color: 'var(--text)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                </div>
                <div onMouseDown={(e) => startResize(e, col.key)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', background: resizing?.key === col.key ? 'var(--text-muted)' : 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseLeave={(e) => { if (resizing?.key !== col.key) e.currentTarget.style.background = 'transparent' }} />
              </th>
            ))}
            <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', width: '50px', position: 'sticky', right: 0, background: 'var(--bg)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </th>
          </tr>
        </thead>
        <tbody>
          {clientesOrdenados.map(cliente => (
            <tr key={cliente.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${cliente.id}`)} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              {orderedVisibleColumns.map(col => (
                <td key={col.key} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: columnWidths[col.key], minWidth: columnWidths[col.key], maxWidth: columnWidths[col.key] }}>
                  {formatValue(getNestedValue(cliente, col.key), col)}
                </td>
              ))}
              <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'center', position: 'sticky', right: 0, background: 'var(--bg)' }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ padding: '5px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const ColumnSelector = () => {
    const groups = [...new Set(COLUMNAS_DISPONIBLES.map(c => c.group))]
    return (
      <div className="custom-scrollbar" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', width: '380px', maxHeight: '450px', overflow: 'auto', zIndex: 100, boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: '600', color: 'var(--text)' }}>Columnas visibles ({visibleColumns.length})</span>
          <button onClick={() => setVisibleColumns(DEFAULT_VISIBLE)} style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Restaurar</button>
        </div>
        {groups.map(group => (
          <div key={group} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{group}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {COLUMNAS_DISPONIBLES.filter(c => c.group === group).map(col => (
                <button key={col.key} onClick={() => toggleColumn(col.key)} style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer', background: visibleColumns.includes(col.key) ? 'rgba(255,255,255,0.1)' : 'transparent', border: visibleColumns.includes(col.key) ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)', color: visibleColumns.includes(col.key) ? 'var(--text)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                  {col.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const VistaTarjetas = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
      {clientesFiltrados.map((cliente) => (
        <Link key={cliente.id} to={`/clientes/${cliente.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', flexShrink: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontWeight: '600', fontSize: '18px' }}>{cliente.nombre_comercial?.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente.nombre_comercial}</h3>
                  {cliente.numero_cliente && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>#{cliente.numero_cliente}</span>}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>{cliente.email_portal || 'Sin email'}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {getEstadoBadge(cliente.estado)}
                  {cliente.telefono && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cliente.telefono}</span>}
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )

  const VistaCompacta = () => (
    <div className="custom-scrollbar" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px', maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
      {clientesFiltrados.map((cliente) => (
        <Link key={cliente.id} to={`/clientes/${cliente.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', transition: 'background 0.15s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontWeight: '600', fontSize: '13px', flexShrink: 0 }}>{cliente.nombre_comercial?.charAt(0)}</div>
            <span style={{ fontWeight: '500', color: 'var(--text)', fontSize: '14px', flex: 1 }}>{cliente.nombre_comercial}</span>
            {cliente.numero_cliente && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>#{cliente.numero_cliente}</span>}
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', width: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.email_portal || '—'}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', width: '110px' }}>{cliente.telefono || '—'}</span>
            {getEstadoBadge(cliente.estado)}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ opacity: 0.4 }}><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </Link>
      ))}
    </div>
  )

  const VISTAS = [
    { id: 'tabla', label: 'Tabla', icon: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></> },
    { id: 'completa', label: 'Completa', icon: <><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/></> },
    { id: 'tarjetas', label: 'Tarjetas', icon: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></> },
    { id: 'compacta', label: 'Compacta', icon: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></> }
  ]

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>Clientes</h1>
        {tienePermiso('clientes.crear') && (
          <button onClick={() => setModalNuevoCliente(true)} className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Nuevo Cliente
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px', padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar clientes..." className="input" style={{ paddingLeft: '40px' }} />
        </div>

        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="select" style={{ minWidth: '170px' }}>
          <option value="todos">Todos los estados</option>
          <option value="campañas_activas">Campañas Activas</option>
          <option value="pausado">Pausado</option>
          <option value="onboarding">Onboarding</option>
          <option value="baja">Baja</option>
        </select>

        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {VISTAS.map(vista => (
            <button key={vista.id} onClick={() => setVistaActual(vista.id)} style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '6px', background: vistaActual === vista.id ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '6px', color: vistaActual === vista.id ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'all 0.15s' }} title={vista.label}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{vista.icon}</svg>
              {vistaActual === vista.id && <span>{vista.label}</span>}
            </button>
          ))}
        </div>

        {vistaActual === 'completa' && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowColumnSelector(!showColumnSelector)} style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: showColumnSelector ? 'rgba(255,255,255,0.1)' : 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3h7a2 2 0 012 2v14a2 2 0 01-2 2h-7m0-18H5a2 2 0 00-2 2v14a2 2 0 002 2h7m0-18v18"/></svg>
              Columnas
            </button>
            {showColumnSelector && <ColumnSelector />}
          </div>
        )}
      </div>

      {showColumnSelector && <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowColumnSelector(false)} />}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}><div className="spinner"></div></div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="empty-state"><p>{busqueda ? 'No se encontraron clientes' : 'No hay clientes'}</p></div>
      ) : (
        <>
          {vistaActual === 'tabla' && <VistaTabla />}
          {vistaActual === 'completa' && <VistaCompleta />}
          {vistaActual === 'tarjetas' && <VistaTarjetas />}
          {vistaActual === 'compacta' && <VistaCompacta />}
        </>
      )}

      {clientesFiltrados.length > 0 && (
        <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {clientesFiltrados.length} de {clientes.length} clientes
          {vistaActual === 'completa' && ` · ${visibleColumns.length} columnas`}
        </p>
      )}

      {modalNuevoCliente && (
        <div className="modal-overlay" onClick={() => setModalNuevoCliente(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nuevo Cliente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label className="label">Nombre comercial *</label><input type="text" value={nuevoCliente.nombre_comercial} onChange={(e) => setNuevoCliente(prev => ({ ...prev, nombre_comercial: e.target.value }))} placeholder="Nombre del negocio" className="input" autoFocus /></div>
              <div><label className="label">Teléfono</label><input type="tel" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente(prev => ({ ...prev, telefono: e.target.value }))} placeholder="+34 600 000 000" className="input" /></div>
              <div><label className="label">Email del Portal</label><input type="email" value={nuevoCliente.email_portal} onChange={(e) => setNuevoCliente(prev => ({ ...prev, email_portal: e.target.value }))} placeholder="email@ejemplo.com" className="input" /></div>
              <div><label className="label">Contraseña del Portal</label><input type="text" value={nuevoCliente.password_portal} onChange={(e) => setNuevoCliente(prev => ({ ...prev, password_portal: e.target.value }))} placeholder="Contraseña inicial" className="input" /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <input type="checkbox" checked={nuevoCliente.tiene_whatsapp} onChange={(e) => setNuevoCliente(prev => ({ ...prev, tiene_whatsapp: e.target.checked }))} style={{ width: '18px', height: '18px', accentColor: '#25d366' }} />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span style={{ color: 'var(--text)' }}>Tiene WhatsApp</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setModalNuevoCliente(false)} className="btn">Cancelar</button>
              <button onClick={crearCliente} disabled={guardando || !nuevoCliente.nombre_comercial.trim()} className="btn primary">{guardando ? 'Creando...' : 'Crear Cliente'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 5px; border: 2px solid transparent; background-clip: padding-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); border: 2px solid transparent; background-clip: padding-box; }
        .custom-scrollbar::-webkit-scrollbar-corner { background: transparent; }
      `}</style>
    </div>
  )
}
