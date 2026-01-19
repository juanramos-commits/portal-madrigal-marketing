import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Iconos
const Icons = {
  ArrowLeft: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  ExternalLink: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
  FolderOpen: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  MessageCircle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Edit2: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

const TABS = [
  { id: 'general', nombre: 'General' },
  { id: 'facturacion', nombre: 'Facturación' },
  { id: 'urls', nombre: 'URLs' },
  { id: 'branding', nombre: 'Branding' },
  { id: 'leads', nombre: 'Leads' },
  { id: 'campanas', nombre: 'Campañas' },
  { id: 'reuniones', nombre: 'Reuniones' },
  { id: 'registro', nombre: 'Registro' }
]

export default function ClienteDetalle() {
  const { id } = useParams()
  const { tienePermiso } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tabActiva, setTabActiva] = useState('general')
  const [cliente, setCliente] = useState(null)
  const [facturacion, setFacturacion] = useState(null)
  const [urls, setUrls] = useState(null)
  const [branding, setBranding] = useState(null)
  const [socios, setSocios] = useState([])
  const [editando, setEditando] = useState({})

  useEffect(() => {
    cargarCliente()
  }, [id])

  const cargarCliente = async () => {
    setLoading(true)
    try {
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select(`*, usuario_asignado:usuarios(id, nombre)`)
        .eq('id', id)
        .single()

      if (clienteError) throw clienteError
      setCliente(clienteData)

      const [facturacionRes, urlsRes, brandingRes, sociosRes] = await Promise.all([
        supabase.from('clientes_facturacion').select('*').eq('cliente_id', id).single(),
        supabase.from('clientes_urls').select('*').eq('cliente_id', id).single(),
        supabase.from('clientes_branding').select('*').eq('cliente_id', id).single(),
        supabase.from('clientes_socios').select('*').eq('cliente_id', id).order('numero_socio')
      ])

      setFacturacion(facturacionRes.data)
      setUrls(urlsRes.data)
      setBranding(brandingRes.data)
      setSocios(sociosRes.data || [])
    } catch (error) {
      console.error('Error cargando cliente:', error)
    } finally {
      setLoading(false)
    }
  }

  const guardarCampo = async (tabla, campo, valor) => {
    setSaving(true)
    try {
      if (tabla === 'clientes') {
        const { error } = await supabase
          .from('clientes')
          .update({ [campo]: valor })
          .eq('id', id)

        if (error) throw error
        setCliente(prev => ({ ...prev, [campo]: valor }))
      }
      setEditando(prev => ({ ...prev, [campo]: false }))
    } catch (error) {
      console.error('Error guardando:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Cliente no encontrado</p>
        <Link to="/clientes" className="btn">Volver a clientes</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/clientes" className="btn btn-icon">
            <Icons.ArrowLeft />
          </Link>
          <div className="avatar" style={{ width: '56px', height: '56px', fontSize: '20px' }}>
            {cliente.nombre_comercial?.charAt(0)}
          </div>
          <div>
            <h1 className="h2" style={{ marginBottom: '4px' }}>{cliente.nombre_comercial}</h1>
            <p className="sub">{cliente.nombre_pila}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>ID: {cliente.id_numerico}</span>
          {urls?.url_drive && (
            <a href={urls.url_drive} target="_blank" rel="noopener noreferrer" className="btn">
              <Icons.FolderOpen /> Drive
            </a>
          )}
          <a
            href={`https://wa.me/${cliente.telefono?.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
          >
            <Icons.MessageCircle /> WhatsApp
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <nav style={{ display: 'flex', gap: '24px', overflowX: 'auto' }}>
          {TABS.map((tab) => {
            const permisoTab = `clientes.${tab.id}.ver`
            if (tab.id !== 'general' && !tienePermiso(permisoTab) && !tienePermiso('clientes.general.ver')) {
              return null
            }
            return (
              <button
                key={tab.id}
                onClick={() => setTabActiva(tab.id)}
                style={{
                  padding: '12px 0',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: tabActiva === tab.id ? 'var(--text)' : 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  borderBottom: tabActiva === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {tab.nombre}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        {tabActiva === 'general' && (
          <TabGeneral
            cliente={cliente}
            socios={socios}
            tienePermiso={tienePermiso}
            editando={editando}
            setEditando={setEditando}
            guardarCampo={guardarCampo}
            saving={saving}
          />
        )}
        {tabActiva === 'facturacion' && <TabFacturacion facturacion={facturacion} />}
        {tabActiva === 'urls' && <TabUrls urls={urls} />}
        {tabActiva === 'branding' && <TabBranding branding={branding} />}
        {tabActiva === 'leads' && <TabLeads clienteId={id} />}
        {tabActiva === 'campanas' && <TabCampanas clienteId={id} />}
        {tabActiva === 'reuniones' && <TabReuniones clienteId={id} />}
        {tabActiva === 'registro' && <TabRegistro clienteId={id} />}
      </div>
    </div>
  )
}

// Campo editable
function CampoEditable({ label, valor, campo, tipo = 'text', opciones, tienePermiso, permiso, editando, setEditando, guardarCampo, saving }) {
  const [valorTemp, setValorTemp] = useState(valor)
  const puedeEditar = tienePermiso(permiso)
  const estaEditando = editando[campo]

  const iniciarEdicion = () => {
    if (!puedeEditar) return
    setValorTemp(valor)
    setEditando(prev => ({ ...prev, [campo]: true }))
  }

  const cancelarEdicion = () => {
    setValorTemp(valor)
    setEditando(prev => ({ ...prev, [campo]: false }))
  }

  const guardar = () => {
    guardarCampo('clientes', campo, valorTemp)
  }

  if (estaEditando) {
    return (
      <div className="field">
        <label className="field-label">{label}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tipo === 'select' ? (
            <select value={valorTemp || ''} onChange={(e) => setValorTemp(e.target.value)} className="select" style={{ flex: 1 }}>
              {opciones.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          ) : (
            <input type={tipo} value={valorTemp || ''} onChange={(e) => setValorTemp(e.target.value)} className="input" style={{ flex: 1 }} />
          )}
          <button onClick={guardar} disabled={saving} className="btn primary btn-icon">
            {saving ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : <Icons.Check />}
          </button>
          <button onClick={cancelarEdicion} className="btn btn-icon"><Icons.X /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div
        onClick={iniciarEdicion}
        style={{
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px',
          cursor: puedeEditar ? 'pointer' : 'default',
          border: '1px solid var(--border)',
          fontSize: '14px',
          color: valor ? 'var(--text)' : 'var(--text-muted)'
        }}
      >
        {valor || '-'}
      </div>
    </div>
  )
}

// Tab General
function TabGeneral({ cliente, socios, tienePermiso, editando, setEditando, guardarCampo, saving }) {
  const estadoOpciones = [
    { value: 'campañas_activas', label: 'Campañas Activas' },
    { value: 'pausado', label: 'Pausado' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'baja', label: 'Baja' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Datos Empresa */}
      <div>
        <h3 className="h3" style={{ marginBottom: '16px' }}>Datos Empresa</h3>
        <div className="grid grid-cols-2 gap-4">
          <CampoEditable label="Nombre Comercial" valor={cliente.nombre_comercial} campo="nombre_comercial" tienePermiso={tienePermiso} permiso="clientes.general.editar_nombre_comercial" editando={editando} setEditando={setEditando} guardarCampo={guardarCampo} saving={saving} />
          <CampoEditable label="Correo Electrónico (PORTAL)" valor={cliente.email_portal} campo="email_portal" tipo="email" tienePermiso={tienePermiso} permiso="clientes.general.editar_email" editando={editando} setEditando={setEditando} guardarCampo={guardarCampo} saving={saving} />
          <CampoEditable label="Nº De Teléfono" valor={cliente.telefono} campo="telefono" tipo="tel" tienePermiso={tienePermiso} permiso="clientes.general.editar_telefono" editando={editando} setEditando={setEditando} guardarCampo={guardarCampo} saving={saving} />
          <CampoEditable label="Nombre de pila" valor={cliente.nombre_pila} campo="nombre_pila" tienePermiso={tienePermiso} permiso="clientes.general.editar_nombre_pila" editando={editando} setEditando={setEditando} guardarCampo={guardarCampo} saving={saving} />
          {tienePermiso('clientes.general.ver_password') && (
            <CampoEditable label="Contraseña Portal" valor={cliente.password_portal} campo="password_portal" tienePermiso={tienePermiso} permiso="clientes.general.editar_password" editando={editando} setEditando={setEditando} guardarCampo={guardarCampo} saving={saving} />
          )}
        </div>
      </div>

      {/* Socios */}
      {tienePermiso('clientes.socios.ver') && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="h3" style={{ marginBottom: '16px' }}>Datos Socio 1</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <CampoDisplay label="Nombre y Apellidos" valor={socios[0]?.nombre_apellidos} />
              <CampoDisplay label="Nº De Teléfono" valor={socios[0]?.telefono} />
              <CampoDisplay label="Correo Electrónico" valor={socios[0]?.email} />
            </div>
          </div>
          <div>
            <h3 className="h3" style={{ marginBottom: '16px' }}>Datos Socio 2</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <CampoDisplay label="Nombre y Apellidos" valor={socios[1]?.nombre_apellidos} />
              <CampoDisplay label="Nº De Teléfono" valor={socios[1]?.telefono} />
              <CampoDisplay label="Correo Electrónico" valor={socios[1]?.email} />
            </div>
          </div>
        </div>
      )}

      {/* Detalles Servicio */}
      <div>
        <h3 className="h3" style={{ marginBottom: '16px' }}>Detalles Servicio</h3>
        <div className="grid grid-cols-2 gap-4">
          <CampoEditable label="Servicio Contratado" valor={cliente.servicio_contratado} campo="servicio_contratado" tienePermiso={tienePermiso} permiso="clientes.general.editar_servicio" editando={editando} setEditando={setEditando} guardarCampo={guardarCampo} saving={saving} />
          <CampoEditable label="Fecha de Onboarding" valor={cliente.fecha_onboarding} campo="fecha_onboarding" tipo="date" tienePermiso={tienePermiso} permiso="clientes.general.editar_fecha_onboarding" editando={editando} setEditando={setEditando} guardarCampo={guardarCampo} saving={saving} />
          <CampoEditable label="Estado" valor={cliente.estado} campo="estado" tipo="select" opciones={estadoOpciones} tienePermiso={tienePermiso} permiso="clientes.general.editar_estado" editando={editando} setEditando={setEditando} guardarCampo={guardarCampo} saving={saving} />
          <div className="field">
            <label className="field-label">Especialidad</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {cliente.especialidad?.map((esp, i) => (
                <span key={i} className="badge info">{esp}</span>
              )) || <span style={{ color: 'var(--text-muted)' }}>-</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Campo solo lectura
function CampoDisplay({ label, valor }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: valor ? 'var(--text)' : 'var(--text-muted)' }}>
        {valor || '-'}
      </div>
    </div>
  )
}

// Tab Facturación
function TabFacturacion({ facturacion }) {
  return (
    <div>
      <h3 className="h3" style={{ marginBottom: '16px' }}>Información de Facturación</h3>
      <div className="grid grid-cols-2 gap-4">
        <CampoDisplay label="Nombre Fiscal" valor={facturacion?.nombre_fiscal} />
        <CampoDisplay label="CIF/NIF" valor={facturacion?.cif_nif} />
        <div style={{ gridColumn: 'span 2' }}>
          <CampoDisplay label="Dirección Fiscal" valor={facturacion?.direccion_fiscal} />
        </div>
        <CampoDisplay label="Provincia" valor={facturacion?.provincia} />
        <CampoDisplay label="Código Postal" valor={facturacion?.codigo_postal} />
        <CampoDisplay label="Ciudad" valor={facturacion?.ciudad} />
        <CampoDisplay label="País" valor={facturacion?.pais} />
      </div>
    </div>
  )
}

// Tab URLs
function TabUrls({ urls }) {
  const items = [
    { label: 'Página Web', valor: urls?.pagina_web },
    { label: 'Página Web 2', valor: urls?.pagina_web_2 },
    { label: 'Instagram Profesional', valor: urls?.instagram },
    { label: 'Facebook Profesional', valor: urls?.facebook },
  ]

  return (
    <div>
      <h3 className="h3" style={{ marginBottom: '16px' }}>URLs y RRSS</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {items.map((item, i) => (
          <div key={i} className="field">
            <label className="field-label">{item.label}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', color: item.valor ? 'var(--text)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.valor || '-'}
              </div>
              {item.valor && (
                <a href={item.valor.startsWith('http') ? item.valor : `https://${item.valor}`} target="_blank" rel="noopener noreferrer" className="btn btn-icon">
                  <Icons.ExternalLink />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Tab Branding
function TabBranding({ branding }) {
  return (
    <div>
      <h3 className="h3" style={{ marginBottom: '16px' }}>Branding y Contenido de Marca</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <CampoDisplay label="Colores" valor={branding?.colores} />
        <CampoDisplay label="Tipografías" valor={branding?.tipografias} />
        <CampoDisplay label="Tono de Marca" valor={branding?.tono_marca} />
        <CampoDisplay label="Especificaciones Funnel" valor={branding?.especificaciones_funnel} />
      </div>
    </div>
  )
}

// Tab Leads (placeholder)
function TabLeads({ clienteId }) {
  return (
    <div>
      <h3 className="h3" style={{ marginBottom: '16px' }}>Control de Clientes Potenciales</h3>
      <p style={{ color: 'var(--text-muted)' }}>Módulo de leads en desarrollo...</p>
    </div>
  )
}

// Tab Campañas (placeholder)
function TabCampanas({ clienteId }) {
  return (
    <div>
      <h3 className="h3" style={{ marginBottom: '16px' }}>Campañas y Segmentación</h3>
      <p style={{ color: 'var(--text-muted)' }}>Módulo de campañas en desarrollo...</p>
    </div>
  )
}

// Tab Reuniones (placeholder)
function TabReuniones({ clienteId }) {
  return (
    <div>
      <h3 className="h3" style={{ marginBottom: '16px' }}>Histórico de Reuniones</h3>
      <p style={{ color: 'var(--text-muted)' }}>Módulo de reuniones en desarrollo...</p>
    </div>
  )
}

// Tab Registro (placeholder)
function TabRegistro({ clienteId }) {
  return (
    <div>
      <h3 className="h3" style={{ marginBottom: '16px' }}>Registro de Cambios</h3>
      <p style={{ color: 'var(--text-muted)' }}>Historial de cambios en desarrollo...</p>
    </div>
  )
}
