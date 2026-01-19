import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Lista de especialidades
const ESPECIALIDADES = [
  'Fotógrafo/a', 'Videógrafo/a', 'Creador/a de contenido', 'Fotomatón/Videomatón',
  'DJ', 'Músico/Banda', 'Hora loca', 'Animación infantil', 'Wedding planner',
  'Maestro/a de ceremonias', 'Maquillador/a', 'Peluquero/a', 'Vestidos de novia',
  'Trajes de novio', 'Zapatos/Complementos', 'Joyería y alianzas', 'Flores y decoración',
  'Alquiler de mobiliario/escenarios/menaje', 'Finca/restaurante', 'Catering',
  'Experiencias gastronómicas (saladas)', 'Experiencias gastronómicas (dulces)',
  'Invitaciones/Papelería', 'Detalles para invitados', 'Transporte de novios/invitados',
  'Agencia de viajes', 'Otro'
]

// Lista de provincias de España
const PROVINCIAS_ESPANA = [
  'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona',
  'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca',
  'Girona', 'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Islas Baleares',
  'Jaén', 'La Coruña', 'La Rioja', 'Las Palmas', 'León', 'Lleida', 'Lugo', 'Madrid',
  'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Pontevedra', 'Salamanca',
  'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo',
  'Valencia', 'Valladolid', 'Vizcaya', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'
]

// Formatear estado para mostrar
const formatearEstado = (estado) => {
  const estados = {
    'campañas_activas': 'Campañas Activas',
    'pausado': 'Pausado',
    'onboarding': 'Onboarding',
    'baja': 'Baja'
  }
  return estados[estado] || estado
}

export default function ClienteDetalleAvanzado() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario, tienePermiso } = useAuth()

  const [cliente, setCliente] = useState(null)
  const [branding, setBranding] = useState(null)
  const [facturacion, setFacturacion] = useState(null)
  const [infoAdicional, setInfoAdicional] = useState(null)
  const [socios, setSocios] = useState([])
  const [urls, setUrls] = useState(null)
  const [campanas, setCampanas] = useState([])
  const [facturas, setFacturas] = useState([])
  const [reuniones, setReuniones] = useState([])
  const [paquetes, setPaquetes] = useState([])
  const [leads, setLeads] = useState([])
  const [historial, setHistorial] = useState([])
  const [notas, setNotas] = useState([])

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('general')

  const tabs = [
    { id: 'general', label: 'General', icon: '👤' },
    { id: 'facturacion', label: 'Facturación', icon: '💰' },
    { id: 'urls', label: 'URLs', icon: '🔗' },
    { id: 'branding', label: 'Branding', icon: '🎨' },
    { id: 'leads', label: 'Leads', icon: '📊' },
    { id: 'campanas', label: 'Campañas', icon: '🎯' },
    { id: 'reuniones', label: 'Reuniones', icon: '📅' },
    { id: 'notas', label: 'Notas', icon: '📌' },
    { id: 'registro', label: 'Registro', icon: '📝' },
  ]

  useEffect(() => {
    cargarTodosDatos()
  }, [id])

  const cargarTodosDatos = async () => {
    setLoading(true)
    try {
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()

      if (clienteError) throw clienteError
      setCliente(clienteData)

      const cargarOpcional = async (queryFn, setter, defaultValue = null) => {
        try {
          const { data, error } = await queryFn()
          if (error) {
            console.log('Error en tabla opcional:', error.message, error.code)
            setter(defaultValue)
            return
          }
          setter(data || defaultValue)
        } catch (e) {
          console.log('Tabla opcional no disponible:', e.message)
          setter(defaultValue)
        }
      }

      await Promise.all([
        cargarOpcional(() => supabase.from('clientes_branding').select('*').eq('cliente_id', id).maybeSingle(), setBranding),
        cargarOpcional(() => supabase.from('clientes_facturacion').select('*').eq('cliente_id', id).maybeSingle(), setFacturacion),
        cargarOpcional(() => supabase.from('clientes_info_adicional').select('*').eq('cliente_id', id).maybeSingle(), setInfoAdicional),
        cargarOpcional(() => supabase.from('clientes_urls').select('*').eq('cliente_id', id).maybeSingle(), setUrls),
        cargarOpcional(() => supabase.from('clientes_socios').select('*').eq('cliente_id', id).order('numero_socio'), setSocios, []),
        cargarOpcional(() => supabase.from('campanas').select('*').eq('cliente_id', id).order('created_at', { ascending: false }), setCampanas, []),
        cargarOpcional(() => supabase.from('facturas').select('*').eq('cliente_id', id).order('fecha', { ascending: false }), setFacturas, []),
        cargarOpcional(() => supabase.from('reuniones').select('*').eq('cliente_id', id).order('fecha', { ascending: false }), setReuniones, []),
        cargarOpcional(() => supabase.from('paquetes_leads').select('*').eq('cliente_id', id).order('fecha_compra', { ascending: false }), setPaquetes, []),
        cargarOpcional(() => supabase.from('leads').select('*').eq('cliente_id', id).order('created_at', { ascending: false }), setLeads, []),
        cargarOpcional(() => supabase.from('cliente_historial').select('*').eq('cliente_id', id).order('fecha', { ascending: false }).limit(100), setHistorial, []),
        cargarOpcional(() => supabase.from('cliente_notas').select('*').eq('cliente_id', id).order('created_at', { ascending: false }), setNotas, [])
      ])

    } catch (error) {
      console.error('Error cargando cliente:', error)
      navigate('/clientes')
    } finally {
      setLoading(false)
    }
  }

  const registrarCambio = async (tabla, campo, valorAnterior, valorNuevo) => {
    try {
      const anterior = Array.isArray(valorAnterior) ? valorAnterior.join(', ') : (valorAnterior || '')
      const nuevo = Array.isArray(valorNuevo) ? valorNuevo.join(', ') : (valorNuevo || '')

      if (anterior === nuevo) return

      const { error } = await supabase.from('cliente_historial').insert({
        cliente_id: id,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre || 'Sistema',
        tabla,
        campo,
        valor_anterior: anterior || '(vacío)',
        valor_nuevo: nuevo || '(vacío)'
      })

      if (error) {
        console.error('Error registrando historial:', error)
        return
      }

      const { data: nuevoHistorial, error: loadError } = await supabase
        .from('cliente_historial')
        .select('*')
        .eq('cliente_id', id)
        .order('fecha', { ascending: false })
        .limit(100)

      if (!loadError) {
        setHistorial(nuevoHistorial || [])
      }
    } catch (error) {
      console.error('Error en historial:', error)
    }
  }

  const guardarCliente = async (campo, valor) => {
    const valorAnterior = cliente[campo]
    try {
      const { error } = await supabase.from('clientes').update({ [campo]: valor }).eq('id', id)
      if (error) throw error
      setCliente(prev => ({ ...prev, [campo]: valor }))
      await registrarCambio('clientes', campo, valorAnterior, valor)
      return true
    } catch (error) {
      console.error('Error guardando cliente:', error)
      return false
    }
  }

  const guardarFacturacion = async (campo, valor) => {
    const valorAnterior = facturacion?.[campo]
    try {
      if (facturacion?.id) {
        const { error } = await supabase.from('clientes_facturacion').update({ [campo]: valor }).eq('id', facturacion.id)
        if (error) throw error
        setFacturacion(prev => ({ ...prev, [campo]: valor }))
      } else {
        const { data, error } = await supabase.from('clientes_facturacion').insert({ cliente_id: id, [campo]: valor }).select().single()
        if (error) throw error
        setFacturacion(data)
      }
      await registrarCambio('clientes_facturacion', campo, valorAnterior, valor)
      return true
    } catch (error) {
      console.error('Error guardando facturacion:', error)
      return false
    }
  }

  const guardarUrls = async (campo, valor) => {
    const valorAnterior = urls?.[campo]
    try {
      if (urls?.id) {
        const { error } = await supabase.from('clientes_urls').update({ [campo]: valor }).eq('id', urls.id)
        if (error) throw error
        setUrls(prev => ({ ...prev, [campo]: valor }))
      } else {
        const { data, error } = await supabase.from('clientes_urls').insert({ cliente_id: id, [campo]: valor }).select().single()
        if (error) throw error
        setUrls(data)
      }
      await registrarCambio('clientes_urls', campo, valorAnterior, valor)
      return true
    } catch (error) {
      console.error('Error guardando urls:', error)
      return false
    }
  }

  const guardarBranding = async (campo, valor) => {
    const valorAnterior = branding?.[campo]
    try {
      if (branding?.id) {
        const { error } = await supabase.from('clientes_branding').update({ [campo]: valor }).eq('id', branding.id)
        if (error) throw error
        setBranding(prev => ({ ...prev, [campo]: valor }))
      } else {
        const { data, error } = await supabase.from('clientes_branding').insert({ cliente_id: id, [campo]: valor }).select().single()
        if (error) throw error
        setBranding(data)
      }
      await registrarCambio('clientes_branding', campo, valorAnterior, valor)
      return true
    } catch (error) {
      console.error('Error guardando branding:', error)
      return false
    }
  }

  const guardarInfoAdicional = async (campo, valor) => {
    const valorAnterior = infoAdicional?.[campo]
    try {
      if (infoAdicional?.id) {
        const { error } = await supabase.from('clientes_info_adicional').update({ [campo]: valor }).eq('id', infoAdicional.id)
        if (error) throw error
        setInfoAdicional(prev => ({ ...prev, [campo]: valor }))
      } else {
        const { data, error } = await supabase.from('clientes_info_adicional').insert({ cliente_id: id, [campo]: valor }).select().single()
        if (error) throw error
        setInfoAdicional(data)
      }
      await registrarCambio('clientes_info_adicional', campo, valorAnterior, valor)
      return true
    } catch (error) {
      console.error('Error guardando info adicional:', error)
      return false
    }
  }

  const eliminarCliente = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este cliente? Esta acción no se puede deshacer.')) {
      return
    }
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw error
      navigate('/clientes')
    } catch (error) {
      console.error('Error eliminando cliente:', error)
      alert('Error al eliminar el cliente')
    }
  }

  // Calcular stats para el header
  const totalLeads = paquetes.reduce((sum, p) => sum + (p.cantidad || 0), 0)
  const leadsConsumidos = leads.length
  const leadsRestantes = totalLeads - leadsConsumidos
  const totalGastado = facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + parseFloat(f.importe_total || 0), 0)
  const cplMedio = leadsConsumidos > 0 ? (totalGastado / leadsConsumidos) : 0

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div className="spinner" style={{ width: '48px', height: '48px' }} />
        <p style={{ color: 'var(--text-muted)', marginTop: '20px' }}>Cargando información del cliente...</p>
      </div>
    )
  }

  if (!cliente) return <div className="card" style={{ textAlign: 'center', padding: '48px' }}>Cliente no encontrado</div>

  return (
    <div>
      {/* Header con información del cliente */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
          <button onClick={() => navigate('/clientes')} className="btn btn-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>

          <AvatarEditable
            cliente={cliente}
            onSave={(url) => guardarCliente('avatar_url', url)}
          />

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 className="h1" style={{ margin: 0 }}>{cliente.nombre_comercial}</h1>
              {notas.length > 0 && (
                <div
                  onClick={() => setActiveTab('notas')}
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%', background: '#ef4444',
                    color: 'white', fontSize: '12px', fontWeight: '700', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                  title={`${notas.length} nota(s)`}
                >
                  {notas.length}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{cliente.email_portal}</span>
              {cliente.telefono && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{cliente.telefono}</span>
                </>
              )}
              <span className={`badge ${cliente.estado === 'campañas_activas' ? 'active' : cliente.estado === 'pausado' ? 'paused' : 'error'}`}>
                {formatearEstado(cliente.estado)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {infoAdicional?.url_drive && (
              <a href={infoAdicional.url_drive} target="_blank" rel="noopener noreferrer" className="btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L5.82 10.18h4.35V24h3.66V10.18h4.35L12 0z"/></svg>
                Drive
              </a>
            )}
            {urls?.instagram && (
              <a href={urls.instagram} target="_blank" rel="noopener noreferrer" className="btn btn-icon" style={{ background: 'rgba(225, 48, 108, 0.15)', borderColor: 'rgba(225, 48, 108, 0.3)', color: '#e1306c' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>
              </a>
            )}
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-4 gap-4">
          <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <div className="stat-card-label" style={{ color: '#10b981' }}>LEADS RESTANTES</div>
            <div className="stat-card-value" style={{ color: '#10b981' }}>{leadsRestantes}</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(102, 126, 234, 0.1)', borderColor: 'rgba(102, 126, 234, 0.2)' }}>
            <div className="stat-card-label" style={{ color: '#667eea' }}>LEADS TOTALES</div>
            <div className="stat-card-value" style={{ color: '#667eea' }}>{totalLeads}</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.2)' }}>
            <div className="stat-card-label" style={{ color: '#fbbf24' }}>LEADS CONSUMIDOS</div>
            <div className="stat-card-value" style={{ color: '#fbbf24' }}>{leadsConsumidos}</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <div className="stat-card-label" style={{ color: '#ef4444' }}>CPL MEDIO</div>
            <div className="stat-card-value" style={{ color: '#ef4444' }}>{cplMedio.toFixed(2)}€</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '24px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '6px', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', width: 'fit-content', minWidth: '100%' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px',
                background: activeTab === tab.id ? 'rgba(102, 126, 234, 0.15)' : 'transparent',
                border: activeTab === tab.id ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
                borderRadius: '10px', color: activeTab === tab.id ? '#667eea' : 'var(--text-muted)',
                fontSize: '15px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '18px' }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'general' && <GeneralTab cliente={cliente} socios={socios} infoAdicional={infoAdicional} guardarCliente={guardarCliente} guardarInfoAdicional={guardarInfoAdicional} eliminarCliente={eliminarCliente} />}
        {activeTab === 'facturacion' && <FacturacionTab facturacion={facturacion} facturas={facturas} guardarFacturacion={guardarFacturacion} />}
        {activeTab === 'urls' && <URLsTab urls={urls} guardarUrls={guardarUrls} />}
        {activeTab === 'branding' && <BrandingTab branding={branding} guardarBranding={guardarBranding} />}
        {activeTab === 'leads' && <LeadsTab leads={leads} paquetes={paquetes} cliente={cliente} />}
        {activeTab === 'campanas' && <CampanasTab campanas={campanas} clienteId={id} setCampanas={setCampanas} />}
        {activeTab === 'reuniones' && <ReunionesTab reuniones={reuniones} clienteId={id} setReuniones={setReuniones} />}
        {activeTab === 'notas' && <NotasTab notas={notas} clienteId={id} setNotas={setNotas} usuario={usuario} />}
        {activeTab === 'registro' && <RegistroTab historial={historial} />}
      </div>
    </div>
  )
}

// ==================== COMPONENTE CAMPO EDITABLE ====================

function EditableField({ label, value, campo, onSave, type = 'text', options = null, fullWidth = false, showUrlButton = false }) {
  const [editing, setEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const success = await onSave(campo, tempValue)
    setSaving(false)
    if (success) setEditing(false)
  }

  const handleCancel = () => {
    setTempValue(value || '')
    setEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type !== 'textarea') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (editing) {
    return (
      <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {type === 'select' && options ? (
            <select value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="select" style={{ flex: 1 }}>
              <option value="">Seleccionar...</option>
              {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          ) : type === 'multiselect' && options ? (
            <MultiSelect value={tempValue} onChange={setTempValue} options={options} />
          ) : type === 'textarea' ? (
            <textarea
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input"
              style={{ flex: 1, minHeight: '100px', padding: '12px', resize: 'vertical' }}
              autoFocus
            />
          ) : (
            <input
              type={type === 'password' ? 'text' : type}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input"
              style={{ flex: 1 }}
              autoFocus
            />
          )}
          <button onClick={handleSave} disabled={saving} className="btn primary btn-icon" style={{ width: '40px' }}>
            {saving ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : '✓'}
          </button>
          <button onClick={handleCancel} className="btn btn-icon" style={{ width: '40px' }}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div
          onClick={() => { setTempValue(value || ''); setEditing(true) }}
          style={{
            flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)',
            fontSize: '15px', color: value ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', minHeight: '42px',
            display: 'flex', alignItems: 'center', transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          {type === 'password' ? (value ? '••••••••' : 'Clic para editar...') : (value || 'Clic para editar...')}
        </div>
        {showUrlButton && value && (
          <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="btn btn-icon" style={{ width: '42px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}

// Componente MultiSelect para especialidades
function MultiSelect({ value, onChange, options }) {
  const [search, setSearch] = useState('')
  const selected = value ? (typeof value === 'string' ? value.split(',').map(s => s.trim()).filter(Boolean) : value) : []

  const toggleOption = (opt) => {
    const newSelected = selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt]
    onChange(newSelected.join(', '))
  }

  const filtered = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '300px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <input
        type="text"
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input"
        style={{ borderRadius: '8px 8px 0 0', border: 'none', borderBottom: '1px solid var(--border)' }}
      />
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {filtered.map(opt => (
          <div
            key={opt}
            onClick={() => toggleOption(opt)}
            style={{
              padding: '10px 12px', cursor: 'pointer', borderRadius: '6px', marginBottom: '4px',
              background: selected.includes(opt) ? 'rgba(102, 126, 234, 0.15)' : 'transparent',
              color: selected.includes(opt) ? '#667eea' : 'var(--text)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
          >
            {opt}
            {selected.includes(opt) && <span>✓</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== TABS ====================

function GeneralTab({ cliente, socios, infoAdicional, guardarCliente, guardarInfoAdicional, eliminarCliente }) {
  const estadoOptions = [
    { value: 'campañas_activas', label: 'Campañas Activas' },
    { value: 'pausado', label: 'Pausado' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'baja', label: 'Baja' }
  ]

  const especialidadOptions = ESPECIALIDADES

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <Card title="📋 Información Básica">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <EditableField label="Nombre Comercial" value={cliente.nombre_comercial} campo="nombre_comercial" onSave={guardarCliente} />
          <EditableField label="Email del Portal" value={cliente.email_portal} campo="email_portal" onSave={guardarCliente} type="email" />
          <EditableField label="Contraseña Portal" value={cliente.password_portal} campo="password_portal" onSave={guardarCliente} type="password" />
          <EditableField label="Teléfono" value={cliente.telefono} campo="telefono" onSave={guardarCliente} type="tel" />
          <EditableField label="Nombre de Pila" value={cliente.nombre_pila} campo="nombre_pila" onSave={guardarCliente} />
          <EditableField label="Servicio Contratado" value={cliente.servicio_contratado} campo="servicio_contratado" onSave={guardarCliente} />
          <EditableField label="Estado" value={cliente.estado} campo="estado" onSave={guardarCliente} type="select" options={estadoOptions} />
          <EditableField label="Fecha Onboarding" value={cliente.fecha_onboarding} campo="fecha_onboarding" onSave={guardarCliente} type="date" />
          <EditableField
            label="Especialidad"
            value={cliente.especialidad?.join(', ')}
            campo="especialidad"
            onSave={(campo, valor) => guardarCliente(campo, valor.split(',').map(s => s.trim()).filter(Boolean))}
            type="multiselect"
            options={especialidadOptions}
          />
        </div>
      </Card>

      {socios.length > 0 && (
        <Card title="👥 Socios">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {socios.map((socio) => (
              <div key={socio.id} style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px' }}>SOCIO {socio.numero_socio}</div>
                <div style={{ marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>{socio.nombre_apellidos}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{socio.email}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{socio.telefono}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="🔧 Integraciones">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          <EditableField label="Discord ID" value={infoAdicional?.id_discord} campo="id_discord" onSave={guardarInfoAdicional} />
          <EditableField label="Chatwoot ID" value={infoAdicional?.id_chatwoot} campo="id_chatwoot" onSave={guardarInfoAdicional} />
          <EditableField label="URL Google Drive" value={infoAdicional?.url_drive} campo="url_drive" onSave={guardarInfoAdicional} type="url" showUrlButton />
          <EditableField label="URL Drive Creativos" value={infoAdicional?.url_drive_creativos} campo="url_drive_creativos" onSave={guardarInfoAdicional} type="url" showUrlButton />
        </div>
      </Card>

      <Card title="⚠️ Zona de Peligro">
        <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#ef4444', marginBottom: '8px' }}>Eliminar Cliente</div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Esta acción eliminará permanentemente el cliente y todos sus datos asociados. Esta acción no se puede deshacer.</div>
          </div>
          <button onClick={eliminarCliente} className="btn danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Eliminar Cliente
          </button>
        </div>
      </Card>
    </div>
  )
}

function FacturacionTab({ facturacion, facturas, guardarFacturacion }) {
  const totalAbonado = facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + parseFloat(f.importe_total || 0), 0)
  const totalPendiente = facturas.filter(f => f.estado === 'pendiente').reduce((sum, f) => sum + parseFloat(f.importe_total || 0), 0)
  const recibosAbonados = facturas.filter(f => f.estado === 'pagada').length
  const recibosPendientes = facturas.filter(f => f.estado === 'pendiente').length

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#10b981' }}>TOTAL ABONADO</div>
          <div className="stat-card-value" style={{ color: '#10b981' }}>{totalAbonado.toFixed(2)}€</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#fbbf24' }}>TOTAL PENDIENTE</div>
          <div className="stat-card-value" style={{ color: '#fbbf24' }}>{totalPendiente.toFixed(2)}€</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(102, 126, 234, 0.1)', borderColor: 'rgba(102, 126, 234, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#667eea' }}>RECIBOS ABONADOS</div>
          <div className="stat-card-value" style={{ color: '#667eea' }}>{recibosAbonados}</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#ef4444' }}>RECIBOS PENDIENTES</div>
          <div className="stat-card-value" style={{ color: '#ef4444' }}>{recibosPendientes}</div>
        </div>
      </div>

      <Card title="🏢 Datos Fiscales">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          <EditableField label="Nombre Fiscal" value={facturacion?.nombre_fiscal} campo="nombre_fiscal" onSave={guardarFacturacion} fullWidth />
          <EditableField label="CIF/NIF" value={facturacion?.cif_nif} campo="cif_nif" onSave={guardarFacturacion} />
          <EditableField label="Dirección Fiscal" value={facturacion?.direccion_fiscal} campo="direccion_fiscal" onSave={guardarFacturacion} fullWidth />
          <EditableField label="Ciudad" value={facturacion?.ciudad} campo="ciudad" onSave={guardarFacturacion} />
          <EditableField label="Provincia" value={facturacion?.provincia} campo="provincia" onSave={guardarFacturacion} />
          <EditableField label="Código Postal" value={facturacion?.codigo_postal} campo="codigo_postal" onSave={guardarFacturacion} />
          <EditableField label="País" value={facturacion?.pais} campo="pais" onSave={guardarFacturacion} />
        </div>
      </Card>

      <Card title="📄 Facturas">
        {facturas.length === 0 ? (
          <div className="empty-state"><p className="empty-state-text">No hay facturas registradas</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {facturas.map(factura => (
              <div key={factura.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>{factura.numero_factura}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{factura.concepto}</div>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginRight: '16px' }}>
                  {new Date(factura.fecha).toLocaleDateString('es-ES')}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', marginRight: '16px' }}>
                  {parseFloat(factura.importe_total || 0).toFixed(2)}€
                </div>
                <span className={`badge ${factura.estado === 'pagada' ? 'active' : factura.estado === 'pendiente' ? 'paused' : 'error'}`} style={{ marginRight: '12px' }}>
                  {factura.estado}
                </span>
                {factura.url_pdf && (
                  <a href={factura.url_pdf} target="_blank" rel="noopener noreferrer" className="btn btn-icon" style={{ width: '40px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function URLsTab({ urls, guardarUrls }) {
  return (
    <Card title="🔗 URLs y Redes Sociales">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
        <EditableField label="Página Web" value={urls?.pagina_web} campo="pagina_web" onSave={guardarUrls} type="url" showUrlButton />
        <EditableField label="Página Web 2" value={urls?.pagina_web_2} campo="pagina_web_2" onSave={guardarUrls} type="url" showUrlButton />
        <EditableField label="Instagram" value={urls?.instagram} campo="instagram" onSave={guardarUrls} type="url" showUrlButton />
        <EditableField label="Facebook" value={urls?.facebook} campo="facebook" onSave={guardarUrls} type="url" showUrlButton />
        <EditableField label="LinkedIn" value={urls?.linkedin} campo="linkedin" onSave={guardarUrls} type="url" showUrlButton />
        <EditableField label="TikTok" value={urls?.tiktok} campo="tiktok" onSave={guardarUrls} type="url" showUrlButton />
        <EditableField label="YouTube" value={urls?.youtube} campo="youtube" onSave={guardarUrls} type="url" showUrlButton />
        <EditableField label="Google My Business" value={urls?.google_my_business} campo="google_my_business" onSave={guardarUrls} type="url" showUrlButton />
        <EditableField label="Otra URL 1" value={urls?.otra_url_1} campo="otra_url_1" onSave={guardarUrls} type="url" showUrlButton />
        <EditableField label="Otra URL 2" value={urls?.otra_url_2} campo="otra_url_2" onSave={guardarUrls} type="url" showUrlButton />
      </div>
    </Card>
  )
}

function BrandingTab({ branding, guardarBranding }) {
  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <Card title="🎨 Paleta de Colores">
        <EditableField label="Colores (separados por coma)" value={branding?.colores} campo="colores" onSave={guardarBranding} fullWidth />
      </Card>

      <Card title="🔤 Tipografías">
        <EditableField label="Tipografías" value={branding?.tipografias} campo="tipografias" onSave={guardarBranding} type="textarea" fullWidth />
      </Card>

      <Card title="💬 Tono de Marca">
        <EditableField label="Tono de Marca" value={branding?.tono_marca} campo="tono_marca" onSave={guardarBranding} type="textarea" fullWidth />
      </Card>

      <Card title="🎯 Especificaciones del Funnel">
        <EditableField label="Especificaciones" value={branding?.especificaciones_funnel} campo="especificaciones_funnel" onSave={guardarBranding} type="textarea" fullWidth />
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title="📷 Logo">
          <EditableField label="URL del Logo" value={branding?.logo_url} campo="logo_url" onSave={guardarBranding} type="url" showUrlButton />
        </Card>
        <Card title="📘 Guía de Estilo">
          <EditableField label="URL de la Guía" value={branding?.guia_estilo_url} campo="guia_estilo_url" onSave={guardarBranding} type="url" showUrlButton />
        </Card>
      </div>
    </div>
  )
}

function LeadsTab({ leads, paquetes, cliente }) {
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const totalComprados = paquetes.reduce((sum, p) => sum + (p.cantidad || 0), 0)
  const totalUtilizados = leads.length
  const disponibles = totalComprados - totalUtilizados

  // Filtrar leads
  const leadsFiltrados = leads.filter(lead => {
    if (filtroEstado && lead.estado !== filtroEstado) return false
    if (filtroFechaDesde && new Date(lead.created_at) < new Date(filtroFechaDesde)) return false
    if (filtroFechaHasta && new Date(lead.created_at) > new Date(filtroFechaHasta + 'T23:59:59')) return false
    if (busqueda) {
      const search = busqueda.toLowerCase()
      return (lead.nombre?.toLowerCase().includes(search) ||
              lead.email?.toLowerCase().includes(search) ||
              lead.telefono?.includes(search))
    }
    return true
  })

  // Estados únicos para el filtro
  const estadosUnicos = [...new Set(leads.map(l => l.estado).filter(Boolean))]

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card" style={{ background: 'rgba(102, 126, 234, 0.1)', borderColor: 'rgba(102, 126, 234, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#667eea' }}>COMPRADOS</div>
          <div className="stat-card-value" style={{ color: '#667eea' }}>{totalComprados}</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#ef4444' }}>UTILIZADOS</div>
          <div className="stat-card-value" style={{ color: '#ef4444' }}>{totalUtilizados}</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#10b981' }}>DISPONIBLES</div>
          <div className="stat-card-value" style={{ color: '#10b981' }}>{disponibles}</div>
        </div>
      </div>

      <Card title="📦 Paquetes Comprados">
        {paquetes.length === 0 ? (
          <div className="empty-state"><p className="empty-state-text">No hay paquetes comprados</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {paquetes.map(paquete => (
              <div key={paquete.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Paquete de {paquete.cantidad} leads</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{new Date(paquete.fecha_compra).toLocaleDateString('es-ES')}</div>
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>{parseFloat(paquete.importe || 0).toFixed(2)}€</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="📋 Lista de Leads">
        {/* Filtros */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input"
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="select"
          >
            <option value="">Todos los estados</option>
            {estadosUnicos.map(estado => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>
          <input
            type="date"
            value={filtroFechaDesde}
            onChange={(e) => setFiltroFechaDesde(e.target.value)}
            className="input"
            placeholder="Desde"
          />
          <input
            type="date"
            value={filtroFechaHasta}
            onChange={(e) => setFiltroFechaHasta(e.target.value)}
            className="input"
            placeholder="Hasta"
          />
        </div>

        {leadsFiltrados.length === 0 ? (
          <div className="empty-state"><p className="empty-state-text">No hay leads que coincidan con los filtros</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {leadsFiltrados.map(lead => (
              <div key={lead.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>{lead.nombre}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{lead.email} • {lead.telefono}</div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '16px' }}>
                  {new Date(lead.created_at).toLocaleDateString('es-ES')}
                </div>
                <span className={`badge ${lead.estado === 'contrato_firmado' ? 'active' : lead.estado === 'no_interesado' ? 'error' : 'paused'}`}>{lead.estado}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function CampanasTab({ campanas, clienteId, setCampanas }) {
  const [editando, setEditando] = useState(null)
  const [nuevaCampana, setNuevaCampana] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    activa: true,
    ubicaciones: [],
    url_formulario: '',
    url_landing: '',
    url_creativos: '',
    especificaciones: ''
  })

  const handleGuardar = async () => {
    try {
      if (editando) {
        const { error } = await supabase.from('campanas').update(formData).eq('id', editando)
        if (error) throw error
        setCampanas(prev => prev.map(c => c.id === editando ? { ...c, ...formData } : c))
      } else {
        const { data, error } = await supabase.from('campanas').insert({ ...formData, cliente_id: clienteId }).select().single()
        if (error) throw error
        setCampanas(prev => [data, ...prev])
      }
      setEditando(null)
      setNuevaCampana(false)
      setFormData({ nombre: '', activa: true, ubicaciones: [], url_formulario: '', url_landing: '', url_creativos: '', especificaciones: '' })
    } catch (error) {
      console.error('Error guardando campaña:', error)
    }
  }

  const handleEditar = (campana) => {
    setEditando(campana.id)
    setFormData({
      nombre: campana.nombre || '',
      activa: campana.activa ?? true,
      ubicaciones: campana.ubicaciones || [],
      url_formulario: campana.url_formulario || '',
      url_landing: campana.url_landing || '',
      url_creativos: campana.url_creativos || '',
      especificaciones: campana.especificaciones || ''
    })
  }

  const toggleUbicacion = (prov) => {
    setFormData(prev => ({
      ...prev,
      ubicaciones: prev.ubicaciones.includes(prov)
        ? prev.ubicaciones.filter(u => u !== prov)
        : [...prev.ubicaciones, prov]
    }))
  }

  const FormularioCampana = () => (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h3 className="h3" style={{ marginBottom: '20px' }}>{editando ? 'Editar Campaña' : 'Nueva Campaña'}</h3>
      <div style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '20px', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Nombre de la Campaña</label>
            <input type="text" value={formData.nombre} onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))} className="input" placeholder="Nombre de la campaña" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', background: formData.activa ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${formData.activa ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '8px' }}>
            <input type="checkbox" checked={formData.activa} onChange={(e) => setFormData(prev => ({ ...prev, activa: e.target.checked }))} />
            <span style={{ color: formData.activa ? '#10b981' : '#ef4444', fontWeight: '600' }}>{formData.activa ? 'Activa' : 'Pausada'}</span>
          </label>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Ubicación de las campañas</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', maxHeight: '200px', overflow: 'auto' }}>
            {PROVINCIAS_ESPANA.map(prov => (
              <div
                key={prov}
                onClick={() => toggleUbicacion(prov)}
                style={{
                  padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                  background: formData.ubicaciones.includes(prov) ? '#1a1a1a' : 'transparent',
                  color: formData.ubicaciones.includes(prov) ? 'white' : 'var(--text-muted)',
                  border: formData.ubicaciones.includes(prov) ? '1px solid #1a1a1a' : '1px solid var(--border)'
                }}
              >
                {prov} {formData.ubicaciones.includes(prov) && '×'}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>URL Formulario</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="url" value={formData.url_formulario} onChange={(e) => setFormData(prev => ({ ...prev, url_formulario: e.target.value }))} className="input" placeholder="https://..." style={{ flex: 1 }} />
              {formData.url_formulario && (
                <a href={formData.url_formulario} target="_blank" rel="noopener noreferrer" className="btn btn-icon" style={{ width: '42px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                </a>
              )}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>URL Landing</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="url" value={formData.url_landing} onChange={(e) => setFormData(prev => ({ ...prev, url_landing: e.target.value }))} className="input" placeholder="https://..." style={{ flex: 1 }} />
              {formData.url_landing && (
                <a href={formData.url_landing} target="_blank" rel="noopener noreferrer" className="btn btn-icon" style={{ width: '42px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                </a>
              )}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>URL Creativos</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="url" value={formData.url_creativos} onChange={(e) => setFormData(prev => ({ ...prev, url_creativos: e.target.value }))} className="input" placeholder="https://..." style={{ flex: 1 }} />
              {formData.url_creativos && (
                <a href={formData.url_creativos} target="_blank" rel="noopener noreferrer" className="btn btn-icon" style={{ width: '42px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                </a>
              )}
            </div>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Especificaciones y apuntes</label>
          <textarea value={formData.especificaciones} onChange={(e) => setFormData(prev => ({ ...prev, especificaciones: e.target.value }))} className="input" style={{ minHeight: '100px', resize: 'vertical' }} placeholder="Notas, especificaciones..." />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={() => { setEditando(null); setNuevaCampana(false) }} className="btn">Cancelar</button>
          <button onClick={handleGuardar} className="btn primary">Guardar Campaña</button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      {(nuevaCampana || editando) && <FormularioCampana />}

      {!nuevaCampana && !editando && (
        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => setNuevaCampana(true)} className="btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Nueva Campaña
          </button>
        </div>
      )}

      <Card title="🎯 Campañas">
        {campanas.length === 0 ? (
          <div className="empty-state"><p className="empty-state-text">No hay campañas registradas</p></div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {campanas.map(campana => (
              <div key={campana.id} style={{ padding: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 className="h3" style={{ margin: 0 }}>{campana.nombre}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge ${campana.activa ? 'active' : 'error'}`}>{campana.activa ? 'Activa' : 'Pausada'}</span>
                    <button onClick={() => handleEditar(campana)} className="btn btn-icon" style={{ width: '36px', height: '36px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                </div>
                {campana.ubicaciones?.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>UBICACIONES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {campana.ubicaciones.map(ub => (
                        <span key={ub} style={{ padding: '4px 10px', background: '#1a1a1a', color: 'white', borderRadius: '16px', fontSize: '12px', fontWeight: '500' }}>{ub}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {campana.url_formulario && (
                    <a href={campana.url_formulario} target="_blank" rel="noopener noreferrer" className="btn" style={{ justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                      Formulario
                    </a>
                  )}
                  {campana.url_landing && (
                    <a href={campana.url_landing} target="_blank" rel="noopener noreferrer" className="btn" style={{ justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                      Landing
                    </a>
                  )}
                  {campana.url_creativos && (
                    <a href={campana.url_creativos} target="_blank" rel="noopener noreferrer" className="btn" style={{ justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                      Creativos
                    </a>
                  )}
                </div>
                {campana.especificaciones && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    {campana.especificaciones}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function ReunionesTab({ reuniones, clienteId, setReuniones }) {
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({ notas: '', url_transcripcion: '' })

  const handleGuardar = async (reunionId) => {
    try {
      const { error } = await supabase.from('reuniones').update(formData).eq('id', reunionId)
      if (error) throw error
      setReuniones(prev => prev.map(r => r.id === reunionId ? { ...r, ...formData } : r))
      setEditando(null)
    } catch (error) {
      console.error('Error guardando reunión:', error)
    }
  }

  return (
    <Card title="📅 Reuniones">
      {reuniones.length === 0 ? (
        <div className="empty-state"><p className="empty-state-text">No hay reuniones registradas</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reuniones.map(reunion => (
            <div key={reunion.id} style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{new Date(reunion.fecha).toLocaleDateString('es-ES')}</div>
                  <span className="badge info">{reunion.tipo}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge ${reunion.estado === 'realizada' ? 'active' : 'paused'}`}>{reunion.estado}</span>
                  <button onClick={() => { setEditando(reunion.id); setFormData({ notas: reunion.notas || '', url_transcripcion: reunion.url_transcripcion || '' }) }} className="btn btn-icon" style={{ width: '36px', height: '36px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              </div>

              {editando === reunion.id ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>URL Transcripción / Llamada</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="url" value={formData.url_transcripcion} onChange={(e) => setFormData(prev => ({ ...prev, url_transcripcion: e.target.value }))} className="input" placeholder="https://..." style={{ flex: 1 }} />
                      {formData.url_transcripcion && (
                        <a href={formData.url_transcripcion} target="_blank" rel="noopener noreferrer" className="btn btn-icon" style={{ width: '42px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Notas</label>
                    <textarea value={formData.notas} onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))} className="input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder="Notas de la reunión..." />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditando(null)} className="btn">Cancelar</button>
                    <button onClick={() => handleGuardar(reunion.id)} className="btn primary">Guardar</button>
                  </div>
                </div>
              ) : (
                <>
                  {reunion.url_transcripcion && (
                    <div style={{ marginBottom: '12px' }}>
                      <a href={reunion.url_transcripcion} target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: '13px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                        Ver Transcripción / Llamada
                      </a>
                    </div>
                  )}
                  {reunion.notas && <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>{reunion.notas}</div>}
                  {reunion.agente && <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Agente: {reunion.agente.nombre} {reunion.agente.apellidos}</div>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function RegistroTab({ historial }) {
  const nombresCampos = {
    nombre_comercial: 'Nombre Comercial', email_portal: 'Email', telefono: 'Teléfono', nombre_pila: 'Nombre de Pila',
    servicio_contratado: 'Servicio Contratado', estado: 'Estado', fecha_onboarding: 'Fecha Onboarding', especialidad: 'Especialidad',
    nombre_fiscal: 'Nombre Fiscal', cif_nif: 'CIF/NIF', direccion_fiscal: 'Dirección Fiscal', ciudad: 'Ciudad',
    provincia: 'Provincia', codigo_postal: 'Código Postal', pais: 'País', pagina_web: 'Página Web', pagina_web_2: 'Página Web 2',
    instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube',
    google_my_business: 'Google My Business', colores: 'Colores', tipografias: 'Tipografías', tono_marca: 'Tono de Marca',
    especificaciones_funnel: 'Especificaciones Funnel', logo_url: 'URL Logo', guia_estilo_url: 'URL Guía de Estilo',
    id_discord: 'Discord ID', id_chatwoot: 'Chatwoot ID', url_drive: 'URL Drive', url_drive_creativos: 'URL Drive Creativos',
    password_portal: 'Contraseña Portal', otra_url_1: 'Otra URL 1', otra_url_2: 'Otra URL 2'
  }

  const nombresTablas = { clientes: 'Datos Generales', clientes_facturacion: 'Facturación', clientes_urls: 'URLs', clientes_branding: 'Branding', clientes_info_adicional: 'Integraciones' }

  return (
    <Card title="📝 Historial de Cambios">
      {historial.length === 0 ? (
        <div className="empty-state"><p className="empty-state-text">No hay cambios registrados</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 120px 1fr 1fr 140px', gap: '12px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <div>Fecha y Hora</div>
            <div>Sección</div>
            <div>Valor Anterior</div>
            <div>Nuevo Valor</div>
            <div>Usuario</div>
          </div>

          {historial.map(item => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '180px 120px 1fr 1fr 140px', gap: '12px', padding: '14px 16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '10px', alignItems: 'center', fontSize: '14px' }}>
              <div style={{ color: 'var(--text-muted)' }}>
                <div style={{ fontWeight: '500', color: 'var(--text)' }}>{new Date(item.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                <div style={{ fontSize: '12px' }}>{new Date(item.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{nombresTablas[item.tabla] || item.tabla}</div>
                <div style={{ fontWeight: '500', color: '#667eea' }}>{nombresCampos[item.campo] || item.campo}</div>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', wordBreak: 'break-word', maxHeight: '60px', overflow: 'auto' }}>{item.valor_anterior || '(vacío)'}</div>
              <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', color: '#10b981', fontSize: '13px', wordBreak: 'break-word', maxHeight: '60px', overflow: 'auto' }}>{item.valor_nuevo || '(vacío)'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: 'white' }}>{(item.usuario_nombre || item.usuario?.nombre)?.[0]?.toUpperCase() || '?'}</div>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>{item.usuario_nombre || item.usuario?.nombre || 'Sistema'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ==================== AVATAR EDITABLE ====================

function AvatarEditable({ cliente, onSave }) {
  const [showMenu, setShowMenu] = useState(false)
  const [editingUrl, setEditingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const handleUrlSave = async () => {
    await onSave(urlInput)
    setEditingUrl(false)
    setShowMenu(false)
    setUrlInput('')
  }

  const handleRemove = async () => {
    await onSave(null)
    setShowMenu(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setShowMenu(!showMenu)}
        style={{
          width: '64px', height: '64px', borderRadius: '50%', cursor: 'pointer',
          background: cliente.avatar_url ? `url(${cliente.avatar_url}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', color: 'white', fontWeight: '600', border: '3px solid var(--border)',
          transition: 'all 0.2s ease'
        }}
      >
        {!cliente.avatar_url && (cliente.nombre_comercial?.[0]?.toUpperCase() || '?')}
      </div>

      {showMenu && (
        <div style={{
          position: 'absolute', top: '70px', left: '0', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: '12px', padding: '8px',
          minWidth: '200px', zIndex: 100, boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }}>
          {editingUrl ? (
            <div style={{ padding: '8px' }}>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="URL de la imagen..."
                className="input"
                style={{ marginBottom: '8px' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setEditingUrl(false)} className="btn" style={{ flex: 1 }}>Cancelar</button>
                <button onClick={handleUrlSave} className="btn primary" style={{ flex: 1 }}>Guardar</button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setEditingUrl(true)}
                style={{
                  width: '100%', padding: '10px 12px', background: 'transparent', border: 'none',
                  color: 'var(--text)', fontSize: '14px', textAlign: 'left', cursor: 'pointer',
                  borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                Cambiar imagen
              </button>
              {cliente.avatar_url && (
                <button
                  onClick={handleRemove}
                  style={{
                    width: '100%', padding: '10px 12px', background: 'transparent', border: 'none',
                    color: '#ef4444', fontSize: '14px', textAlign: 'left', cursor: 'pointer',
                    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Eliminar imagen
                </button>
              )}
              <button
                onClick={() => setShowMenu(false)}
                style={{
                  width: '100%', padding: '10px 12px', background: 'transparent', border: 'none',
                  color: 'var(--text-muted)', fontSize: '14px', textAlign: 'left', cursor: 'pointer',
                  borderRadius: '8px', marginTop: '4px'
                }}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== NOTAS TAB ====================

function NotasTab({ notas, clienteId, setNotas, usuario }) {
  const [nuevaNota, setNuevaNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const agregarNota = async () => {
    if (!nuevaNota.trim()) return
    setGuardando(true)
    try {
      const { data, error } = await supabase.from('cliente_notas').insert({
        cliente_id: clienteId,
        usuario_id: usuario?.id,
        usuario_nombre: usuario?.nombre || 'Sistema',
        contenido: nuevaNota.trim()
      }).select().single()

      if (error) throw error
      setNotas(prev => [data, ...prev])
      setNuevaNota('')
    } catch (error) {
      console.error('Error guardando nota:', error)
    } finally {
      setGuardando(false)
    }
  }

  const eliminarNota = async (notaId) => {
    if (!window.confirm('¿Eliminar esta nota?')) return
    try {
      const { error } = await supabase.from('cliente_notas').delete().eq('id', notaId)
      if (error) throw error
      setNotas(prev => prev.filter(n => n.id !== notaId))
    } catch (error) {
      console.error('Error eliminando nota:', error)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <Card title="📌 Añadir Nota">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <textarea
            value={nuevaNota}
            onChange={(e) => setNuevaNota(e.target.value)}
            placeholder="Escribe una nota sobre este cliente..."
            className="input"
            style={{ minHeight: '100px', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={agregarNota} disabled={guardando || !nuevaNota.trim()} className="btn primary">
              {guardando ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : 'Guardar Nota'}
            </button>
          </div>
        </div>
      </Card>

      <Card title="📝 Notas del Cliente">
        {notas.length === 0 ? (
          <div className="empty-state"><p className="empty-state-text">No hay notas para este cliente</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notas.map(nota => (
              <div key={nota.id} style={{
                padding: '16px', background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)', borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '600', color: 'white'
                    }}>
                      {nota.usuario_nombre?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text)' }}>{nota.usuario_nombre || 'Sistema'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(nota.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  {(nota.usuario_id === usuario?.id || usuario?.rol === 'super_admin') && (
                    <button onClick={() => eliminarNota(nota.id)} className="btn btn-icon danger" style={{ width: '32px', height: '32px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '15px', color: 'var(--text)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {nota.contenido}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ==================== COMPONENTES AUXILIARES ====================

function Card({ title, children }) {
  return (
    <div className="card">
      <h2 className="h3" style={{ marginBottom: '20px' }}>{title}</h2>
      {children}
    </div>
  )
}
