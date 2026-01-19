import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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
    { id: 'registro', label: 'Registro', icon: '📝' },
  ]

  useEffect(() => {
    cargarTodosDatos()
  }, [id])

  const cargarTodosDatos = async () => {
    setLoading(true)
    try {
      // Cliente principal (obligatorio)
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()

      if (clienteError) throw clienteError
      setCliente(clienteData)

      // Cargar datos opcionales sin bloquear si fallan
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

      // Datos opcionales - no bloquean si fallan
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
        // Historial - query simplificada sin JOIN para mayor compatibilidad
        cargarOpcional(() => supabase.from('cliente_historial').select('*').eq('cliente_id', id).order('fecha', { ascending: false }).limit(100), setHistorial, [])
      ])

    } catch (error) {
      console.error('Error cargando cliente:', error)
      navigate('/clientes')
    } finally {
      setLoading(false)
    }
  }

  // Función para registrar cambios en el historial
  const registrarCambio = async (tabla, campo, valorAnterior, valorNuevo) => {
    try {
      // Convertir arrays a string para comparación
      const anterior = Array.isArray(valorAnterior) ? valorAnterior.join(', ') : (valorAnterior || '')
      const nuevo = Array.isArray(valorNuevo) ? valorNuevo.join(', ') : (valorNuevo || '')

      // Solo registrar si hay cambio real
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

      // Recargar historial (query simple sin JOIN)
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

  // Función para guardar cambios en la tabla clientes
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

  // Función para guardar cambios en la tabla clientes_facturacion
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

  // Función para guardar cambios en la tabla clientes_urls
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

  // Función para guardar cambios en la tabla clientes_branding
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

  // Función para guardar cambios en clientes_info_adicional
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

          <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '24px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            {cliente.nombre_comercial?.[0]?.toUpperCase() || '?'}
          </div>

          <div style={{ flex: 1 }}>
            <h1 className="h1" style={{ marginBottom: '8px' }}>{cliente.nombre_comercial}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{cliente.email_portal}</span>
              {cliente.telefono && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{cliente.telefono}</span>
                </>
              )}
              <span className={`badge ${cliente.estado === 'campañas_activas' ? 'active' : cliente.estado === 'pausado' ? 'paused' : 'error'}`}>
                {cliente.estado}
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
          <div className="stat-card" style={{ background: 'rgba(102, 126, 234, 0.1)', borderColor: 'rgba(102, 126, 234, 0.2)' }}>
            <div className="stat-card-label" style={{ color: '#667eea' }}>FACTURAS</div>
            <div className="stat-card-value" style={{ color: '#667eea' }}>{facturas.length}</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <div className="stat-card-label" style={{ color: '#10b981' }}>LEADS</div>
            <div className="stat-card-value" style={{ color: '#10b981' }}>{leads.length}</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.2)' }}>
            <div className="stat-card-label" style={{ color: '#fbbf24' }}>CAMPAÑAS</div>
            <div className="stat-card-value" style={{ color: '#fbbf24' }}>{campanas.length}</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <div className="stat-card-label" style={{ color: '#ef4444' }}>REUNIONES</div>
            <div className="stat-card-value" style={{ color: '#ef4444' }}>{reuniones.length}</div>
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
        {activeTab === 'general' && <GeneralTab cliente={cliente} socios={socios} infoAdicional={infoAdicional} guardarCliente={guardarCliente} guardarInfoAdicional={guardarInfoAdicional} />}
        {activeTab === 'facturacion' && <FacturacionTab facturacion={facturacion} facturas={facturas} guardarFacturacion={guardarFacturacion} />}
        {activeTab === 'urls' && <URLsTab urls={urls} guardarUrls={guardarUrls} />}
        {activeTab === 'branding' && <BrandingTab branding={branding} guardarBranding={guardarBranding} />}
        {activeTab === 'leads' && <LeadsTab leads={leads} paquetes={paquetes} cliente={cliente} />}
        {activeTab === 'campanas' && <CampanasTab campanas={campanas} />}
        {activeTab === 'reuniones' && <ReunionesTab reuniones={reuniones} />}
        {activeTab === 'registro' && <RegistroTab historial={historial} />}
      </div>
    </div>
  )
}

// ==================== COMPONENTE CAMPO EDITABLE ====================

function EditableField({ label, value, campo, onSave, type = 'text', options = null, fullWidth = false }) {
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
              {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
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
              type={type}
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
      <div
        onClick={() => { setTempValue(value || ''); setEditing(true) }}
        style={{
          padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)',
          fontSize: '15px', color: value ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', minHeight: '42px',
          display: 'flex', alignItems: 'center', transition: 'all 0.15s ease'
        }}
        onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
        onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        {value || 'Clic para editar...'}
      </div>
    </div>
  )
}

// ==================== TABS ====================

function GeneralTab({ cliente, socios, infoAdicional, guardarCliente, guardarInfoAdicional }) {
  const estadoOptions = [
    { value: 'campañas_activas', label: 'Campañas Activas' },
    { value: 'pausado', label: 'Pausado' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'baja', label: 'Baja' }
  ]

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <Card title="📋 Información Básica">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <EditableField label="Nombre Comercial" value={cliente.nombre_comercial} campo="nombre_comercial" onSave={guardarCliente} />
          <EditableField label="Email" value={cliente.email_portal} campo="email_portal" onSave={guardarCliente} type="email" />
          <EditableField label="Teléfono" value={cliente.telefono} campo="telefono" onSave={guardarCliente} type="tel" />
          <EditableField label="Nombre de Pila" value={cliente.nombre_pila} campo="nombre_pila" onSave={guardarCliente} />
          <EditableField label="Servicio Contratado" value={cliente.servicio_contratado} campo="servicio_contratado" onSave={guardarCliente} />
          <EditableField label="Estado" value={cliente.estado} campo="estado" onSave={guardarCliente} type="select" options={estadoOptions} />
          <EditableField label="Fecha Onboarding" value={cliente.fecha_onboarding} campo="fecha_onboarding" onSave={guardarCliente} type="date" />
          <EditableField label="Especialidad" value={cliente.especialidad?.join(', ')} campo="especialidad" onSave={(campo, valor) => guardarCliente(campo, valor.split(',').map(s => s.trim()).filter(Boolean))} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <EditableField label="Discord ID" value={infoAdicional?.id_discord} campo="id_discord" onSave={guardarInfoAdicional} />
          <EditableField label="Chatwoot ID" value={infoAdicional?.id_chatwoot} campo="id_chatwoot" onSave={guardarInfoAdicional} />
          <EditableField label="GHL ID" value={infoAdicional?.id_ghl} campo="id_ghl" onSave={guardarInfoAdicional} />
          <EditableField label="URL Google Drive" value={infoAdicional?.url_drive} campo="url_drive" onSave={guardarInfoAdicional} type="url" />
          <EditableField label="URL Drive Creativos" value={infoAdicional?.url_drive_creativos} campo="url_drive_creativos" onSave={guardarInfoAdicional} type="url" />
        </div>
      </Card>
    </div>
  )
}

function FacturacionTab({ facturacion, facturas, guardarFacturacion }) {
  const totalFacturado = facturas.reduce((sum, f) => sum + parseFloat(f.importe_total || 0), 0)
  const facturasPagadas = facturas.filter(f => f.estado === 'pagada').length
  const facturasPendientes = facturas.filter(f => f.estado === 'pendiente').length

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#10b981' }}>TOTAL FACTURADO</div>
          <div className="stat-card-value" style={{ color: '#10b981' }}>{totalFacturado.toFixed(2)}€</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(102, 126, 234, 0.1)', borderColor: 'rgba(102, 126, 234, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#667eea' }}>FACTURAS PAGADAS</div>
          <div className="stat-card-value" style={{ color: '#667eea' }}>{facturasPagadas}</div>
        </div>
        <div className="stat-card" style={{ background: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.2)' }}>
          <div className="stat-card-label" style={{ color: '#fbbf24' }}>PENDIENTES</div>
          <div className="stat-card-value" style={{ color: '#fbbf24' }}>{facturasPendientes}</div>
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

      <Card title="📄 Facturas Recientes">
        {facturas.length === 0 ? (
          <div className="empty-state"><p className="empty-state-text">No hay facturas registradas</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {facturas.slice(0, 10).map(factura => (
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
                <span className={`badge ${factura.estado === 'pagada' ? 'active' : factura.estado === 'pendiente' ? 'paused' : 'error'}`}>
                  {factura.estado}
                </span>
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
        <EditableField label="Página Web" value={urls?.pagina_web} campo="pagina_web" onSave={guardarUrls} type="url" />
        <EditableField label="Página Web 2" value={urls?.pagina_web_2} campo="pagina_web_2" onSave={guardarUrls} type="url" />
        <EditableField label="Instagram" value={urls?.instagram} campo="instagram" onSave={guardarUrls} type="url" />
        <EditableField label="Facebook" value={urls?.facebook} campo="facebook" onSave={guardarUrls} type="url" />
        <EditableField label="LinkedIn" value={urls?.linkedin} campo="linkedin" onSave={guardarUrls} type="url" />
        <EditableField label="TikTok" value={urls?.tiktok} campo="tiktok" onSave={guardarUrls} type="url" />
        <EditableField label="YouTube" value={urls?.youtube} campo="youtube" onSave={guardarUrls} type="url" />
        <EditableField label="Google My Business" value={urls?.google_my_business} campo="google_my_business" onSave={guardarUrls} type="url" />
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
          <EditableField label="URL del Logo" value={branding?.logo_url} campo="logo_url" onSave={guardarBranding} type="url" />
        </Card>
        <Card title="📘 Guía de Estilo">
          <EditableField label="URL de la Guía" value={branding?.guia_estilo_url} campo="guia_estilo_url" onSave={guardarBranding} type="url" />
        </Card>
      </div>
    </div>
  )
}

function LeadsTab({ leads, paquetes, cliente }) {
  const totalComprados = paquetes.reduce((sum, p) => sum + (p.cantidad || 0), 0)
  const totalUtilizados = leads.length
  const disponibles = totalComprados - totalUtilizados

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

      <Card title="📊 Leads Recientes">
        {leads.length === 0 ? (
          <div className="empty-state"><p className="empty-state-text">No hay leads registrados</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {leads.slice(0, 10).map(lead => (
              <div key={lead.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>{lead.nombre}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{lead.email} • {lead.telefono}</div>
                </div>
                <span className={`badge ${lead.estado === 'contrato_firmado' ? 'active' : 'paused'}`}>{lead.estado}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function CampanasTab({ campanas }) {
  return (
    <Card title="🎯 Campañas">
      {campanas.length === 0 ? (
        <div className="empty-state"><p className="empty-state-text">No hay campañas registradas</p></div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {campanas.map(campana => (
            <div key={campana.id} style={{ padding: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 className="h3" style={{ margin: 0 }}>{campana.nombre}</h3>
                <span className={`badge ${campana.activa ? 'active' : 'error'}`}>{campana.activa ? 'Activa' : 'Pausada'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="mini">INICIO</div><div style={{ color: 'var(--text)' }}>{campana.fecha_inicio ? new Date(campana.fecha_inicio).toLocaleDateString('es-ES') : '-'}</div></div>
                <div><div className="mini">FIN</div><div style={{ color: 'var(--text)' }}>{campana.fecha_fin ? new Date(campana.fecha_fin).toLocaleDateString('es-ES') : '-'}</div></div>
                {campana.presupuesto_diario && <div><div className="mini">PRESUPUESTO DIARIO</div><div style={{ color: 'var(--text)' }}>{parseFloat(campana.presupuesto_diario).toFixed(2)}€</div></div>}
                {campana.ubicaciones && <div><div className="mini">UBICACIONES</div><div style={{ color: 'var(--text)' }}>{campana.ubicaciones.join(', ')}</div></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function ReunionesTab({ reuniones }) {
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
                <span className={`badge ${reunion.estado === 'realizada' ? 'active' : 'paused'}`}>{reunion.estado}</span>
              </div>
              {reunion.notas && <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>{reunion.notas}</div>}
              {reunion.agente && <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>Agente: {reunion.agente.nombre} {reunion.agente.apellidos}</div>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function RegistroTab({ historial }) {
  // Mapeo de nombres de campos a nombres legibles
  const nombresCampos = {
    nombre_comercial: 'Nombre Comercial',
    email_portal: 'Email',
    telefono: 'Teléfono',
    nombre_pila: 'Nombre de Pila',
    servicio_contratado: 'Servicio Contratado',
    estado: 'Estado',
    fecha_onboarding: 'Fecha Onboarding',
    especialidad: 'Especialidad',
    nombre_fiscal: 'Nombre Fiscal',
    cif_nif: 'CIF/NIF',
    direccion_fiscal: 'Dirección Fiscal',
    ciudad: 'Ciudad',
    provincia: 'Provincia',
    codigo_postal: 'Código Postal',
    pais: 'País',
    pagina_web: 'Página Web',
    pagina_web_2: 'Página Web 2',
    instagram: 'Instagram',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    google_my_business: 'Google My Business',
    colores: 'Colores',
    tipografias: 'Tipografías',
    tono_marca: 'Tono de Marca',
    especificaciones_funnel: 'Especificaciones Funnel',
    logo_url: 'URL Logo',
    guia_estilo_url: 'URL Guía de Estilo',
    id_discord: 'Discord ID',
    id_chatwoot: 'Chatwoot ID',
    id_ghl: 'GHL ID',
    url_drive: 'URL Drive',
    url_drive_creativos: 'URL Drive Creativos'
  }

  const nombresTablas = {
    clientes: 'Datos Generales',
    clientes_facturacion: 'Facturación',
    clientes_urls: 'URLs',
    clientes_branding: 'Branding',
    clientes_info_adicional: 'Integraciones'
  }

  return (
    <Card title="📝 Historial de Cambios">
      {historial.length === 0 ? (
        <div className="empty-state"><p className="empty-state-text">No hay cambios registrados</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Cabecera de tabla */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 120px 1fr 1fr 140px', gap: '12px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <div>Fecha y Hora</div>
            <div>Sección</div>
            <div>Valor Anterior</div>
            <div>Nuevo Valor</div>
            <div>Usuario</div>
          </div>

          {/* Filas de historial */}
          {historial.map(item => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '180px 120px 1fr 1fr 140px', gap: '12px', padding: '14px 16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: '10px', alignItems: 'center', fontSize: '14px' }}>
              {/* Fecha y hora */}
              <div style={{ color: 'var(--text-muted)' }}>
                <div style={{ fontWeight: '500', color: 'var(--text)' }}>
                  {new Date(item.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ fontSize: '12px' }}>
                  {new Date(item.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>

              {/* Campo modificado */}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  {nombresTablas[item.tabla] || item.tabla}
                </div>
                <div style={{ fontWeight: '500', color: '#667eea' }}>
                  {nombresCampos[item.campo] || item.campo}
                </div>
              </div>

              {/* Valor anterior */}
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', wordBreak: 'break-word', maxHeight: '60px', overflow: 'auto' }}>
                {item.valor_anterior || '(vacío)'}
              </div>

              {/* Nuevo valor */}
              <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', color: '#10b981', fontSize: '13px', wordBreak: 'break-word', maxHeight: '60px', overflow: 'auto' }}>
                {item.valor_nuevo || '(vacío)'}
              </div>

              {/* Usuario */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: 'white' }}>
                  {(item.usuario_nombre || item.usuario?.nombre)?.[0]?.toUpperCase() || '?'}
                </div>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                  {item.usuario_nombre || item.usuario?.nombre || 'Sistema'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
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
