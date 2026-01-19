import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ESTADOS = {
  'campañas_activas': { label: 'Campañas Activas', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  'pausado': { label: 'Pausado', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
  'baja': { label: 'Baja', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  'onboarding': { label: 'Onboarding', color: '#667eea', bg: 'rgba(102, 126, 234, 0.15)' }
}

const normalizar = (texto) => {
  if (!texto) return ''
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Definición de todas las columnas disponibles
const COLUMNAS_DISPONIBLES = [
  { key: 'numero_cliente', label: '#', defaultWidth: 60, group: 'Básicos' },
  { key: 'nombre_comercial', label: 'Nombre Comercial', defaultWidth: 180, group: 'Básicos' },
  { key: 'nombre_pila', label: 'Nombre Pila', defaultWidth: 120, group: 'Básicos' },
  { key: 'email_portal', label: 'Email Portal', defaultWidth: 200, group: 'Básicos' },
  { key: 'telefono', label: 'Teléfono', defaultWidth: 120, group: 'Básicos' },
  { key: 'estado', label: 'Estado', defaultWidth: 130, isEstado: true, group: 'Básicos' },
  { key: 'servicio_contratado', label: 'Servicio', defaultWidth: 150, group: 'Básicos' },
  { key: 'fecha_onboarding', label: 'Fecha Onboarding', defaultWidth: 130, isDate: true, group: 'Básicos' },
  { key: 'tiene_whatsapp', label: 'WhatsApp', defaultWidth: 80, isBool: true, group: 'Básicos' },
  { key: 'facturacion.nombre_fiscal', label: 'Nombre Fiscal', defaultWidth: 180, group: 'Facturación' },
  { key: 'facturacion.cif_nif', label: 'CIF/NIF', defaultWidth: 100, group: 'Facturación' },
  { key: 'facturacion.direccion_fiscal', label: 'Dirección', defaultWidth: 200, group: 'Facturación' },
  { key: 'facturacion.ciudad', label: 'Ciudad', defaultWidth: 120, group: 'Facturación' },
  { key: 'facturacion.provincia', label: 'Provincia', defaultWidth: 120, group: 'Facturación' },
  { key: 'facturacion.codigo_postal', label: 'C.P.', defaultWidth: 80, group: 'Facturación' },
  { key: 'urls.pagina_web', label: 'Web', defaultWidth: 180, isUrl: true, group: 'URLs' },
  { key: 'urls.instagram', label: 'Instagram', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'urls.facebook', label: 'Facebook', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'urls.linkedin', label: 'LinkedIn', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'urls.tiktok', label: 'TikTok', defaultWidth: 150, isUrl: true, group: 'URLs' },
  { key: 'lanzamiento.encargado_landing', label: 'Enc. Landing', defaultWidth: 120, group: 'Lanzamiento' },
  { key: 'lanzamiento.encargado_creativos', label: 'Enc. Creativos', defaultWidth: 120, group: 'Lanzamiento' },
  { key: 'lanzamiento.fecha_lanzamiento', label: 'Fecha Lanzamiento', defaultWidth: 140, isDate: true, group: 'Lanzamiento' },
  { key: 'lanzamiento.pack', label: 'Pack', defaultWidth: 100, group: 'Lanzamiento' },
  { key: 'info_adicional.id_discord', label: 'Discord ID', defaultWidth: 120, group: 'Integraciones' },
  { key: 'info_adicional.id_chatwoot', label: 'Chatwoot ID', defaultWidth: 120, group: 'Integraciones' },
]

const DEFAULT_VISIBLE = ['numero_cliente', 'nombre_comercial', 'email_portal', 'telefono', 'estado', 'servicio_contratado', 'facturacion.ciudad', 'urls.pagina_web']

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

  // Estado para tabla completa
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

  // Guardar preferencias
  useEffect(() => {
    localStorage.setItem('tabla_column_order', JSON.stringify(columnOrder))
  }, [columnOrder])
  useEffect(() => {
    localStorage.setItem('tabla_visible_columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])
  useEffect(() => {
    localStorage.setItem('tabla_column_widths', JSON.stringify(columnWidths))
  }, [columnWidths])

  useEffect(() => {
    cargarClientes()
  }, [filtroEstado, vistaActual])

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

  // Ordenación
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
    const config = ESTADOS[estado] || { label: estado, color: '#888', bg: 'rgba(136, 136, 136, 0.15)' }
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
    if (value === null || value === undefined || value === '') return <span style={{ color: 'rgba(255,255,255,0.2)' }}>-</span>
    if (col.isEstado) return getEstadoBadge(value)
    if (col.isBool) return value ? <span style={{ color: '#10b981' }}>✓</span> : <span style={{ color: 'rgba(255,255,255,0.2)' }}>-</span>
    if (col.isDate) {
      try { return new Date(value).toLocaleDateString('es-ES') } catch { return value }
    }
    if (col.isUrl && value) {
      return <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>{value.replace(/^https?:\/\/(www\.)?/, '').substring(0, 20)}</a>
    }
    return String(value)
  }

  // Drag & Drop para reordenar columnas
  const handleDragStart = (e, key) => {
    setDraggedColumn(key)
    e.dataTransfer.effectAllowed = 'move'
  }

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

  // Redimensionar columnas
  const startResize = useCallback((e, key) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing({ key, startX: e.clientX, startWidth: columnWidths[key] })
  }, [columnWidths])

  useEffect(() => {
    if (!resizing) return
    const handleMouseMove = (e) => {
      const diff = e.clientX - resizing.startX
      const newWidth = Math.max(50, resizing.startWidth + diff)
      setColumnWidths(prev => ({ ...prev, [resizing.key]: newWidth }))
    }
    const handleMouseUp = () => setResizing(null)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const toggleColumn = (key) => {
    setVisibleColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const getColumnConfig = (key) => COLUMNAS_DISPONIBLES.find(c => c.key === key)

  // Columnas ordenadas y filtradas por visibilidad
  const orderedVisibleColumns = columnOrder.filter(key => visibleColumns.includes(key)).map(key => getColumnConfig(key)).filter(Boolean)

  // Vista tabla simple
  const VistaTabla = () => (
    <div className="custom-scrollbar" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, background: 'rgba(10, 10, 12, 0.98)', zIndex: 10 }}>
          <tr>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>Nombre</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>Email</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>Teléfono</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>Estado</th>
            <th style={{ width: '80px', padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>Ver</th>
          </tr>
        </thead>
        <tbody>
          {clientesFiltrados.map(cliente => (
            <tr key={cliente.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${cliente.id}`)} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: cliente.avatar_url ? `url(${cliente.avatar_url}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '14px' }}>
                    {!cliente.avatar_url && cliente.nombre_comercial?.charAt(0)}
                  </div>
                  <div>
                    <span style={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>{cliente.nombre_comercial}</span>
                    {cliente.numero_cliente && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#667eea' }}>#{cliente.numero_cliente}</span>}
                  </div>
                </div>
              </td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>{cliente.email_portal || '-'}</td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>{cliente.telefono || '-'}</td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>{getEstadoBadge(cliente.estado)}</td>
              <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ padding: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', color: 'rgba(255, 255, 255, 0.6)', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // Vista tabla completa con todas las funcionalidades
  const VistaCompleta = () => (
    <div className="custom-scrollbar" ref={tableRef} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
        <thead style={{ position: 'sticky', top: 0, background: '#0d0d10', zIndex: 10 }}>
          <tr>
            {orderedVisibleColumns.map(col => (
              <th
                key={col.key}
                draggable
                onDragStart={(e) => handleDragStart(e, col.key)}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragEnd={handleDragEnd}
                onClick={() => handleSort(col.key)}
                style={{
                  position: 'relative', padding: '10px 12px', textAlign: 'left', fontSize: '11px',
                  fontWeight: '600', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)', whiteSpace: 'nowrap',
                  width: columnWidths[col.key], minWidth: columnWidths[col.key], maxWidth: columnWidths[col.key],
                  cursor: 'pointer', userSelect: 'none', background: draggedColumn === col.key ? 'rgba(102, 126, 234, 0.15)' : 'transparent',
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ cursor: 'grab' }}>⋮⋮</span>
                  <span>{col.label}</span>
                  {sortConfig.key === col.key && (
                    <span style={{ color: '#667eea' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
                <div
                  onMouseDown={(e) => startResize(e, col.key)}
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px',
                    cursor: 'col-resize', background: resizing?.key === col.key ? '#667eea' : 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(102, 126, 234, 0.5)'}
                  onMouseLeave={(e) => { if (resizing?.key !== col.key) e.currentTarget.style.background = 'transparent' }}
                />
              </th>
            ))}
            <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', width: '50px', position: 'sticky', right: 0, background: '#0d0d10' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </th>
          </tr>
        </thead>
        <tbody>
          {clientesOrdenados.map(cliente => (
            <tr key={cliente.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${cliente.id}`)} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              {orderedVisibleColumns.map(col => (
                <td key={col.key} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', color: 'rgba(255, 255, 255, 0.75)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: columnWidths[col.key], minWidth: columnWidths[col.key], maxWidth: columnWidths[col.key] }}>
                  {formatValue(getNestedValue(cliente, col.key), col)}
                </td>
              ))}
              <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center', position: 'sticky', right: 0, background: 'rgba(13, 13, 16, 0.95)' }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ padding: '5px', background: 'rgba(102, 126, 234, 0.15)', border: '1px solid rgba(102, 126, 234, 0.3)', borderRadius: '4px', color: '#667eea', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // Selector de columnas
  const ColumnSelector = () => {
    const groups = [...new Set(COLUMNAS_DISPONIBLES.map(c => c.group))]
    return (
      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#1a1a22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', width: '320px', maxHeight: '400px', overflow: 'auto', zIndex: 100, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>Columnas visibles</span>
          <button onClick={() => setVisibleColumns(DEFAULT_VISIBLE)} style={{ fontSize: '12px', color: '#667eea', background: 'none', border: 'none', cursor: 'pointer' }}>Reset</button>
        </div>
        {groups.map(group => (
          <div key={group} style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '6px' }}>{group}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {COLUMNAS_DISPONIBLES.filter(c => c.group === group).map(col => (
                <button
                  key={col.key}
                  onClick={() => toggleColumn(col.key)}
                  style={{
                    padding: '4px 10px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
                    background: visibleColumns.includes(col.key) ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: visibleColumns.includes(col.key) ? '1px solid rgba(102, 126, 234, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                    color: visibleColumns.includes(col.key) ? '#667eea' : 'rgba(255,255,255,0.6)'
                  }}
                >
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
      {clientesFiltrados.map((cliente) => (
        <Link key={cliente.id} to={`/clientes/${cliente.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseOver={(e) => { e.currentTarget.style.borderColor = '#667eea'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', flexShrink: 0, background: cliente.avatar_url ? `url(${cliente.avatar_url}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '20px' }}>{!cliente.avatar_url && cliente.nombre_comercial?.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente.nombre_comercial}</h3>
                  {cliente.numero_cliente && <span style={{ fontSize: '12px', color: '#667eea', fontWeight: '600' }}>#{cliente.numero_cliente}</span>}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '8px' }}>{cliente.email_portal || 'Sin email'}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {getEstadoBadge(cliente.estado)}
                  {cliente.telefono && <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>{cliente.telefono}</span>}
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )

  const VistaCompacta = () => (
    <div className="custom-scrollbar" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '12px', maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {clientesFiltrados.map((cliente) => (
          <Link key={cliente.id} to={`/clientes/${cliente.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', transition: 'all 0.15s ease', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: cliente.avatar_url ? `url(${cliente.avatar_url}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '14px', flexShrink: 0 }}>{!cliente.avatar_url && cliente.nombre_comercial?.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>{cliente.nombre_comercial}</span>
                {cliente.numero_cliente && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#667eea', fontWeight: '600' }}>#{cliente.numero_cliente}</span>}
              </div>
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', minWidth: '120px' }}>{cliente.email_portal || '-'}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', minWidth: '100px' }}>{cliente.telefono || '-'}</span>
              {getEstadoBadge(cliente.estado)}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )

  const VISTAS = [
    { id: 'tabla', label: 'Tabla', icon: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></> },
    { id: 'completa', label: 'Completa', icon: <><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="2" y1="13" x2="22" y2="13"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/></> },
    { id: 'tarjetas', label: 'Tarjetas', icon: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></> },
    { id: 'compacta', label: 'Compacta', icon: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></> }
  ]

  return (
    <div style={{ padding: '24px', background: '#0a0a0c', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'rgba(255, 255, 255, 0.95)', margin: 0 }}>Clientes</h1>
        {tienePermiso('clientes.crear') && (
          <button onClick={() => setModalNuevoCliente(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(102, 126, 234, 0.15)', border: '1px solid rgba(102, 126, 234, 0.3)', borderRadius: '8px', color: '#667eea', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Nuevo Cliente
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.4)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, email, teléfono..." style={{ width: '100%', padding: '10px 14px 10px 44px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', outline: 'none' }} />
        </div>

        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', outline: 'none', cursor: 'pointer', minWidth: '180px' }}>
          <option value="todos">Todos los estados</option>
          <option value="campañas_activas">Campañas Activas</option>
          <option value="pausado">Pausado</option>
          <option value="onboarding">Onboarding</option>
          <option value="baja">Baja</option>
        </select>

        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px' }}>
          {VISTAS.map(vista => (
            <button key={vista.id} onClick={() => setVistaActual(vista.id)} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: vistaActual === vista.id ? 'rgba(102, 126, 234, 0.2)' : 'transparent', border: vistaActual === vista.id ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent', borderRadius: '6px', color: vistaActual === vista.id ? '#667eea' : 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }} title={vista.label}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{vista.icon}</svg>
              <span style={{ display: vistaActual === vista.id ? 'inline' : 'none' }}>{vista.label}</span>
            </button>
          ))}
        </div>

        {vistaActual === 'completa' && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowColumnSelector(!showColumnSelector)} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: showColumnSelector ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.03)', border: showColumnSelector ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: showColumnSelector ? '#667eea' : 'rgba(255, 255, 255, 0.6)', cursor: 'pointer', fontSize: '13px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3h7a2 2 0 012 2v14a2 2 0 01-2 2h-7m0-18H5a2 2 0 00-2 2v14a2 2 0 002 2h7m0-18v18"/></svg>
              Columnas ({visibleColumns.length})
            </button>
            {showColumnSelector && <ColumnSelector />}
          </div>
        )}
      </div>

      {showColumnSelector && <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowColumnSelector(false)} />}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(102, 126, 234, 0.2)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255, 255, 255, 0.4)' }}>{busqueda ? 'No se encontraron clientes con esos criterios' : 'No hay clientes'}</div>
      ) : (
        <>
          {vistaActual === 'tabla' && <VistaTabla />}
          {vistaActual === 'completa' && <VistaCompleta />}
          {vistaActual === 'tarjetas' && <VistaTarjetas />}
          {vistaActual === 'compacta' && <VistaCompacta />}
        </>
      )}

      {clientesFiltrados.length > 0 && (
        <p style={{ marginTop: '16px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.4)' }}>
          Mostrando {clientesFiltrados.length} de {clientes.length} clientes
          {vistaActual === 'completa' && ` • ${visibleColumns.length} columnas • Arrastra para reordenar • Arrastra bordes para redimensionar`}
        </p>
      )}

      {modalNuevoCliente && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }} onClick={() => setModalNuevoCliente(false)}>
          <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.95)', marginBottom: '24px' }}>Nuevo Cliente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '6px', display: 'block' }}>Nombre comercial *</label>
                <input type="text" value={nuevoCliente.nombre_comercial} onChange={(e) => setNuevoCliente(prev => ({ ...prev, nombre_comercial: e.target.value }))} placeholder="Nombre del negocio" autoFocus style={{ width: '100%', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '6px', display: 'block' }}>Teléfono</label>
                <input type="tel" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente(prev => ({ ...prev, telefono: e.target.value }))} placeholder="+34 600 000 000" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '6px', display: 'block' }}>Email del Portal</label>
                <input type="email" value={nuevoCliente.email_portal} onChange={(e) => setNuevoCliente(prev => ({ ...prev, email_portal: e.target.value }))} placeholder="email@ejemplo.com" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '6px', display: 'block' }}>Contraseña del Portal</label>
                <input type="text" value={nuevoCliente.password_portal} onChange={(e) => setNuevoCliente(prev => ({ ...prev, password_portal: e.target.value }))} placeholder="Contraseña inicial" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', outline: 'none' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <input type="checkbox" checked={nuevoCliente.tiene_whatsapp} onChange={(e) => setNuevoCliente(prev => ({ ...prev, tiene_whatsapp: e.target.checked }))} style={{ width: '18px', height: '18px', accentColor: '#25d366' }} />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>Tiene WhatsApp</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setModalNuevoCliente(false)} style={{ padding: '10px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={crearCliente} disabled={guardando || !nuevoCliente.nombre_comercial.trim()} style={{ padding: '10px 16px', background: guardando || !nuevoCliente.nombre_comercial.trim() ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.8)', border: '1px solid rgba(102, 126, 234, 0.5)', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '500', cursor: guardando || !nuevoCliente.nombre_comercial.trim() ? 'not-allowed' : 'pointer' }}>{guardando ? 'Creando...' : 'Crear Cliente'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(102, 126, 234, 0.3); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(102, 126, 234, 0.5); }
        .custom-scrollbar::-webkit-scrollbar-corner { background: transparent; }
      `}</style>
    </div>
  )
}
