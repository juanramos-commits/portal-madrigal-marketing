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
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  const [editMode, setEditMode] = useState(false)

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
      // Cliente principal
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()
      
      if (clienteError) throw clienteError
      setCliente(clienteData)

      // Branding
      const { data: brandingData } = await supabase
        .from('clientes_branding')
        .select('*')
        .eq('cliente_id', id)
        .single()
      setBranding(brandingData)

      // Facturación
      const { data: facturacionData } = await supabase
        .from('clientes_facturacion')
        .select('*')
        .eq('cliente_id', id)
        .single()
      setFacturacion(facturacionData)

      // Info adicional
      const { data: infoData } = await supabase
        .from('clientes_info_adicional')
        .select('*')
        .eq('cliente_id', id)
        .single()
      setInfoAdicional(infoData)

      // Socios
      const { data: sociosData } = await supabase
        .from('clientes_socios')
        .select('*')
        .eq('cliente_id', id)
        .order('numero_socio')
      setSocios(sociosData || [])

      // URLs
      const { data: urlsData } = await supabase
        .from('clientes_urls')
        .select('*')
        .eq('cliente_id', id)
        .single()
      setUrls(urlsData)

      // Campañas
      const { data: campanasData } = await supabase
        .from('campanas')
        .select('*')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })
      setCampanas(campanasData || [])

      // Facturas
      const { data: facturasData } = await supabase
        .from('facturas')
        .select('*')
        .eq('cliente_id', id)
        .order('fecha', { ascending: false })
      setFacturas(facturasData || [])

      // Reuniones
      const { data: reunionesData } = await supabase
        .from('reuniones')
        .select('*, agente:agente_id(nombre, apellidos)')
        .eq('cliente_id', id)
        .order('fecha', { ascending: false })
      setReuniones(reunionesData || [])

      // Paquetes de leads
      const { data: paquetesData } = await supabase
        .from('paquetes_leads')
        .select('*')
        .eq('cliente_id', id)
        .order('fecha_compra', { ascending: false })
      setPaquetes(paquetesData || [])

      // Leads
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })
      setLeads(leadsData || [])

      // Historial
      const { data: historialData } = await supabase
        .from('cliente_historial')
        .select('*, usuario:usuario_id(nombre, apellidos)')
        .eq('cliente_id', id)
        .order('fecha', { ascending: false })
        .limit(50)
      setHistorial(historialData || [])

    } catch (error) {
      console.error('Error cargando datos:', error)
      navigate('/clientes')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0c' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid rgba(255, 255, 255, 0.1)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: '20px' }}>Cargando información del cliente...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
      </div>
    )
  }

  if (!cliente) return <div>Cliente no encontrado</div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c', padding: '32px' }}>
      {/* Header con información del cliente */}
      <div style={{ marginBottom: '32px', padding: '32px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
          <button onClick={() => navigate('/clientes')} style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', color: 'rgba(255, 255, 255, 0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '700', color: 'white', boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)' }}>
            {cliente.nombre_comercial?.[0]?.toUpperCase() || '?'}
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: 'rgba(255, 255, 255, 0.95)', margin: '0 0 8px 0' }}>
              {cliente.nombre_comercial}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)' }}>{cliente.email_portal}</span>
              {cliente.telefono && (
                <>
                  <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                  <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)' }}>{cliente.telefono}</span>
                </>
              )}
              <span style={{ padding: '4px 12px', background: cliente.estado === 'campañas_activas' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${cliente.estado === 'campañas_activas' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: cliente.estado === 'campañas_activas' ? '#10b981' : '#ef4444' }}>
                {cliente.estado}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {infoAdicional?.url_drive && (
              <a href={infoAdicional.url_drive} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 20px', background: 'rgba(66, 133, 244, 0.15)', border: '1px solid rgba(66, 133, 244, 0.3)', borderRadius: '10px', color: '#4285f4', fontSize: '14px', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L5.82 10.18h4.35V24h3.66V10.18h4.35L12 0z"/>
                </svg>
                Drive
              </a>
            )}
            {cliente.instagram && (
              <a href={cliente.instagram} target="_blank" rel="noopener noreferrer" style={{ padding: '12px', background: 'rgba(225, 48, 108, 0.15)', border: '1px solid rgba(225, 48, 108, 0.3)', borderRadius: '10px', color: '#e1306c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Stats rápidas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.2)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(102, 126, 234, 0.7)', marginBottom: '4px' }}>FACTURAS</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#667eea' }}>{facturas.length}</div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(16, 185, 129, 0.7)', marginBottom: '4px' }}>LEADS</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>{leads.length}</div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(251, 191, 36, 0.7)', marginBottom: '4px' }}>CAMPAÑAS</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#fbbf24' }}>{campanas.length}</div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(239, 68, 68, 0.7)', marginBottom: '4px' }}>REUNIONES</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>{reuniones.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        <div style={{ display: 'flex', gap: '6px', padding: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', width: 'fit-content', minWidth: '100%' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 20px',
                background: activeTab === tab.id ? 'rgba(102, 126, 234, 0.15)' : 'transparent',
                border: activeTab === tab.id ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
                borderRadius: '10px',
                color: activeTab === tab.id ? '#667eea' : 'rgba(255, 255, 255, 0.5)',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
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
        {activeTab === 'general' && <GeneralTab cliente={cliente} socios={socios} infoAdicional={infoAdicional} />}
        {activeTab === 'facturacion' && <FacturacionTab facturacion={facturacion} facturas={facturas} />}
        {activeTab === 'urls' && <URLsTab urls={urls} />}
        {activeTab === 'branding' && <BrandingTab branding={branding} />}
        {activeTab === 'leads' && <LeadsTab leads={leads} paquetes={paquetes} cliente={cliente} />}
        {activeTab === 'campanas' && <CampanasTab campanas={campanas} />}
        {activeTab === 'reuniones' && <ReunionesTab reuniones={reuniones} />}
        {activeTab === 'registro' && <RegistroTab historial={historial} />}
      </div>
    </div>
  )
}

// ==================== TABS ====================

function GeneralTab({ cliente, socios, infoAdicional }) {
  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Información básica */}
      <Card title="📋 Información Básica">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <Field label="Nombre Comercial" value={cliente.nombre_comercial} />
          <Field label="Email" value={cliente.email_portal} />
          <Field label="Teléfono" value={cliente.telefono} />
          <Field label="Servicio Contratado" value={cliente.servicio_contratado} />
          <Field label="Fecha Onboarding" value={cliente.fecha_onboarding} />
          <Field label="Especialidad" value={cliente.especialidad?.join(', ')} />
        </div>
      </Card>

      {/* Socios */}
      {socios.length > 0 && (
        <Card title="👥 Socios">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {socios.map((socio, idx) => (
              <div key={socio.id} style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.4)', marginBottom: '12px' }}>SOCIO {socio.numero_socio}</div>
                <div style={{ marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' }}>{socio.nombre_apellidos}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>{socio.email}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>{socio.telefono}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Info adicional */}
      {infoAdicional && (
        <Card title="🔧 Integraciones">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {infoAdicional.id_discord && <Field label="Discord ID" value={infoAdicional.id_discord} />}
            {infoAdicional.id_chatwoot && <Field label="Chatwoot ID" value={infoAdicional.id_chatwoot} />}
            {infoAdicional.id_ghl && <Field label="GHL ID" value={infoAdicional.id_ghl} />}
            {infoAdicional.url_drive && <Field label="Google Drive" value={<a href={infoAdicional.url_drive} target="_blank" style={{ color: '#4285f4' }}>Ver Drive</a>} />}
            {infoAdicional.url_drive_creativos && <Field label="Drive Creativos" value={<a href={infoAdicional.url_drive_creativos} target="_blank" style={{ color: '#4285f4' }}>Ver Creativos</a>} />}
          </div>
        </Card>
      )}
    </div>
  )
}

function FacturacionTab({ facturacion, facturas }) {
  const totalFacturado = facturas.reduce((sum, f) => sum + parseFloat(f.importe_total || 0), 0)
  const facturasPagadas = facturas.filter(f => f.estado === 'pagada').length
  const facturasPendientes = facturas.filter(f => f.estado === 'pendiente').length

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div style={{ padding: '24px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(16, 185, 129, 0.7)', marginBottom: '8px' }}>TOTAL FACTURADO</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981' }}>{totalFacturado.toFixed(2)}€</div>
        </div>
        <div style={{ padding: '24px', background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.2)', borderRadius: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(102, 126, 234, 0.7)', marginBottom: '8px' }}>FACTURAS PAGADAS</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#667eea' }}>{facturasPagadas}</div>
        </div>
        <div style={{ padding: '24px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(251, 191, 36, 0.7)', marginBottom: '8px' }}>PENDIENTES</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#fbbf24' }}>{facturasPendientes}</div>
        </div>
      </div>

      {/* Datos fiscales */}
      {facturacion && (
        <Card title="🏢 Datos Fiscales">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            <Field label="Nombre Fiscal" value={facturacion.nombre_fiscal} fullWidth />
            <Field label="CIF/NIF" value={facturacion.cif_nif} />
            <Field label="Dirección Fiscal" value={facturacion.direccion_fiscal} fullWidth />
            <Field label="Ciudad" value={facturacion.ciudad} />
            <Field label="Provincia" value={facturacion.provincia} />
            <Field label="Código Postal" value={facturacion.codigo_postal} />
            <Field label="País" value={facturacion.pais} />
          </div>
        </Card>
      )}

      {/* Listado de facturas */}
      <Card title="📄 Facturas Recientes">
        {facturas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>
            No hay facturas registradas
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {facturas.slice(0, 10).map(factura => (
              <div key={factura.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '4px' }}>{factura.numero_factura}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>{factura.concepto}</div>
                </div>
                <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginRight: '16px' }}>
                  {new Date(factura.fecha).toLocaleDateString('es-ES')}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'rgba(255, 255, 255, 0.9)', marginRight: '16px' }}>
                  {parseFloat(factura.importe_total || 0).toFixed(2)}€
                </div>
                <span style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: factura.estado === 'pagada' ? 'rgba(16, 185, 129, 0.15)' : factura.estado === 'pendiente' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: factura.estado === 'pagada' ? '#10b981' : factura.estado === 'pendiente' ? '#fbbf24' : '#ef4444' }}>
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

function URLsTab({ urls }) {
  if (!urls) return <Card title="🔗 URLs"><div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>No hay URLs configuradas</div></Card>

  const urlList = [
    { label: 'Página Web', value: urls.pagina_web, icon: '🌐' },
    { label: 'Página Web 2', value: urls.pagina_web_2, icon: '🌐' },
    { label: 'Instagram', value: urls.instagram, icon: '📸' },
    { label: 'Facebook', value: urls.facebook, icon: '👍' },
    { label: 'LinkedIn', value: urls.linkedin, icon: '💼' },
    { label: 'TikTok', value: urls.tiktok, icon: '🎵' },
    { label: 'YouTube', value: urls.youtube, icon: '▶️' },
  ].filter(item => item.value)

  return (
    <Card title="🔗 URLs y Redes Sociales">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {urlList.map((item, idx) => (
          <a key={idx} href={item.value} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', textDecoration: 'none', color: 'rgba(255, 255, 255, 0.9)', transition: 'all 0.2s ease' }}>
            <span style={{ fontSize: '24px' }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>{item.label}</div>
              <div style={{ fontSize: '14px', color: '#667eea', fontWeight: '500' }}>{item.value.replace(/^https?:\/\/(www\.)?/, '')}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </a>
        ))}
      </div>
    </Card>
  )
}

function BrandingTab({ branding }) {
  if (!branding) return <Card title="🎨 Branding"><div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>No hay información de branding configurada</div></Card>

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Colores */}
      {branding.colores && (
        <Card title="🎨 Paleta de Colores">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {branding.colores.split(',').map((color, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: color.trim(), border: '1px solid rgba(255, 255, 255, 0.1)' }} />
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace' }}>{color.trim()}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tipografías */}
      {branding.tipografias && (
        <Card title="🔤 Tipografías">
          <div style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', fontSize: '15px', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)' }}>
            {branding.tipografias}
          </div>
        </Card>
      )}

      {/* Tono de marca */}
      {branding.tono_marca && (
        <Card title="💬 Tono de Marca">
          <div style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', fontSize: '15px', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)' }}>
            {branding.tono_marca}
          </div>
        </Card>
      )}

      {/* Especificaciones de funnel */}
      {branding.especificaciones_funnel && (
        <Card title="🎯 Especificaciones del Funnel">
          <div style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', fontSize: '15px', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)', whiteSpace: 'pre-wrap' }}>
            {branding.especificaciones_funnel}
          </div>
        </Card>
      )}

      {/* Logo y guía de estilo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {branding.logo_url && (
          <Card title="📷 Logo">
            <a href={branding.logo_url} target="_blank" style={{ display: 'block', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', color: '#667eea', textDecoration: 'none', textAlign: 'center' }}>
              Ver Logo
            </a>
          </Card>
        )}
        {branding.guia_estilo_url && (
          <Card title="📘 Guía de Estilo">
            <a href={branding.guia_estilo_url} target="_blank" style={{ display: 'block', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', color: '#667eea', textDecoration: 'none', textAlign: 'center' }}>
              Ver Guía
            </a>
          </Card>
        )}
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
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div style={{ padding: '24px', background: 'rgba(102, 126, 234, 0.1)', border: '1px solid rgba(102, 126, 234, 0.2)', borderRadius: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(102, 126, 234, 0.7)', marginBottom: '8px' }}>COMPRADOS</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#667eea' }}>{totalComprados}</div>
        </div>
        <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(239, 68, 68, 0.7)', marginBottom: '8px' }}>UTILIZADOS</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>{totalUtilizados}</div>
        </div>
        <div style={{ padding: '24px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(16, 185, 129, 0.7)', marginBottom: '8px' }}>DISPONIBLES</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981' }}>{disponibles}</div>
        </div>
      </div>

      {/* Paquetes comprados */}
      <Card title="📦 Paquetes Comprados">
        {paquetes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>
            No hay paquetes comprados
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {paquetes.map(paquete => (
              <div key={paquete.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '4px' }}>
                    Paquete de {paquete.cantidad} leads
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {new Date(paquete.fecha_compra).toLocaleDateString('es-ES')}
                  </div>
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
                  {parseFloat(paquete.importe || 0).toFixed(2)}€
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Leads recientes */}
      <Card title="📊 Leads Recientes">
        {leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>
            No hay leads registrados
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {leads.slice(0, 10).map(lead => (
              <div key={lead.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '4px' }}>{lead.nombre}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>{lead.email} • {lead.telefono}</div>
                </div>
                <span style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: lead.estado === 'contrato_firmado' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)', color: lead.estado === 'contrato_firmado' ? '#10b981' : '#fbbf24' }}>
                  {lead.estado}
                </span>
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
    <Card title="🎯 Campañas Activas">
      {campanas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>
          No hay campañas registradas
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {campanas.map(campana => (
            <div key={campana.id} style={{ padding: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'rgba(255, 255, 255, 0.9)', margin: 0 }}>{campana.nombre}</h3>
                <span style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: campana.activa ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: campana.activa ? '#10b981' : '#ef4444' }}>
                  {campana.activa ? 'Activa' : 'Pausada'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>INICIO</div>
                  <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>{campana.fecha_inicio ? new Date(campana.fecha_inicio).toLocaleDateString('es-ES') : '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>FIN</div>
                  <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>{campana.fecha_fin ? new Date(campana.fecha_fin).toLocaleDateString('es-ES') : '-'}</div>
                </div>
                {campana.presupuesto_diario && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>PRESUPUESTO DIARIO</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>{parseFloat(campana.presupuesto_diario).toFixed(2)}€</div>
                  </div>
                )}
                {campana.ubicaciones && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>UBICACIONES</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>{campana.ubicaciones.join(', ')}</div>
                  </div>
                )}
              </div>
              {campana.especificaciones && (
                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '12px', fontSize: '14px', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.7)' }}>
                  {campana.especificaciones}
                </div>
              )}
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
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>
          No hay reuniones registradas
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reuniones.map(reunion => (
            <div key={reunion.id} style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)' }}>
                    {new Date(reunion.fecha).toLocaleDateString('es-ES')}
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: 'rgba(102, 126, 234, 0.15)', color: '#667eea' }}>
                    {reunion.tipo}
                  </span>
                </div>
                <span style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: reunion.estado === 'realizada' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)', color: reunion.estado === 'realizada' ? '#10b981' : '#fbbf24' }}>
                  {reunion.estado}
                </span>
              </div>
              {reunion.notas && (
                <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
                  {reunion.notas}
                </div>
              )}
              {reunion.agente && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  Agente: {reunion.agente.nombre} {reunion.agente.apellidos}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function RegistroTab({ historial }) {
  return (
    <Card title="📝 Historial de Cambios">
      {historial.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>
          No hay cambios registrados
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {historial.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: '16px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: item.accion === 'crear' ? 'rgba(16, 185, 129, 0.15)' : item.accion === 'editar' ? 'rgba(102, 126, 234, 0.15)' : 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                {item.accion === 'crear' ? '➕' : item.accion === 'editar' ? '✏️' : '🗑️'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '4px' }}>
                  {item.accion.charAt(0).toUpperCase() + item.accion.slice(1)}
                </div>
                {item.descripcion && (
                  <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px' }}>
                    {item.descripcion}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  {item.usuario?.nombre} {item.usuario?.apellidos} • {new Date(item.fecha).toLocaleString('es-ES')}
                </div>
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
    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '16px', padding: '24px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '20px' }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value, fullWidth }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.5' }}>{value || '-'}</div>
    </div>
  )
}
