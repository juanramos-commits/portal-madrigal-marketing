import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft,
  ExternalLink,
  Phone,
  Mail,
  Save,
  Loader2,
  FolderOpen,
  MessageCircle,
  Edit2,
  X,
  Check
} from 'lucide-react'

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
      // Cargar cliente principal
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select(`
          *,
          usuario_asignado:usuarios(id, nombre)
        `)
        .eq('id', id)
        .single()

      if (clienteError) throw clienteError
      setCliente(clienteData)

      // Cargar datos relacionados en paralelo
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
      // Añadir más tablas según necesidad
      
      setEditando(prev => ({ ...prev, [campo]: false }))
    } catch (error) {
      console.error('Error guardando:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cliente no encontrado</p>
        <Link to="/clientes" className="text-black hover:underline mt-2 inline-block">
          Volver a clientes
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            to="/clientes"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-medium text-gray-600">
              {cliente.nombre_comercial?.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {cliente.nombre_comercial}
              </h1>
              <p className="text-gray-500">{cliente.nombre_pila}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">ID: {cliente.id_numerico}</span>
          {urls?.url_drive && (
            <a
              href={urls.url_drive}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              Drive
            </a>
          )}
          <a
            href={`https://wa.me/${cliente.telefono?.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8 overflow-x-auto">
          {TABS.map((tab) => {
            const permisoTab = `clientes.${tab.id}.ver`
            // Siempre mostrar General, para las demás verificar permiso
            if (tab.id !== 'general' && !tienePermiso(permisoTab) && !tienePermiso('clientes.general.ver')) {
              return null
            }
            
            return (
              <button
                key={tab.id}
                onClick={() => setTabActiva(tab.id)}
                className={`pb-4 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tabActiva === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.nombre}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200">
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
        {tabActiva === 'facturacion' && (
          <TabFacturacion
            facturacion={facturacion}
            clienteId={id}
            tienePermiso={tienePermiso}
          />
        )}
        {tabActiva === 'urls' && (
          <TabUrls
            urls={urls}
            tienePermiso={tienePermiso}
          />
        )}
        {tabActiva === 'branding' && (
          <TabBranding
            branding={branding}
            tienePermiso={tienePermiso}
          />
        )}
        {tabActiva === 'leads' && (
          <TabLeads
            clienteId={id}
            tienePermiso={tienePermiso}
          />
        )}
        {tabActiva === 'campanas' && (
          <TabCampanas
            clienteId={id}
            tienePermiso={tienePermiso}
          />
        )}
        {tabActiva === 'reuniones' && (
          <TabReuniones
            clienteId={id}
            tienePermiso={tienePermiso}
          />
        )}
        {tabActiva === 'registro' && (
          <TabRegistro
            clienteId={id}
          />
        )}
      </div>
    </div>
  )
}

// Componente para campo editable
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
      <div>
        <label className="block text-sm font-medium text-gray-500 mb-1">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {tipo === 'select' ? (
            <select
              value={valorTemp || ''}
              onChange={(e) => setValorTemp(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
            >
              {opciones.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={tipo}
              value={valorTemp || ''}
              onChange={(e) => setValorTemp(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
            />
          )}
          <button
            onClick={guardar}
            disabled={saving}
            className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            onClick={cancelarEdicion}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-500 mb-1">
        {label}
      </label>
      <div
        onClick={iniciarEdicion}
        className={`px-3 py-2 bg-gray-50 rounded-lg ${puedeEditar ? 'cursor-pointer hover:bg-gray-100' : ''}`}
      >
        {valor || <span className="text-gray-400">-</span>}
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
    <div className="p-6 space-y-8">
      {/* Datos Empresa */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos Empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CampoEditable
            label="Nombre Comercial"
            valor={cliente.nombre_comercial}
            campo="nombre_comercial"
            tienePermiso={tienePermiso}
            permiso="clientes.general.editar_nombre_comercial"
            editando={editando}
            setEditando={setEditando}
            guardarCampo={guardarCampo}
            saving={saving}
          />
          <CampoEditable
            label="Correo Electrónico (PORTAL)"
            valor={cliente.email_portal}
            campo="email_portal"
            tipo="email"
            tienePermiso={tienePermiso}
            permiso="clientes.general.editar_email"
            editando={editando}
            setEditando={setEditando}
            guardarCampo={guardarCampo}
            saving={saving}
          />
          <CampoEditable
            label="Nº De Teléfono"
            valor={cliente.telefono}
            campo="telefono"
            tipo="tel"
            tienePermiso={tienePermiso}
            permiso="clientes.general.editar_telefono"
            editando={editando}
            setEditando={setEditando}
            guardarCampo={guardarCampo}
            saving={saving}
          />
          <CampoEditable
            label="Nombre de pila"
            valor={cliente.nombre_pila}
            campo="nombre_pila"
            tienePermiso={tienePermiso}
            permiso="clientes.general.editar_nombre_pila"
            editando={editando}
            setEditando={setEditando}
            guardarCampo={guardarCampo}
            saving={saving}
          />
          {tienePermiso('clientes.general.ver_password') && (
            <CampoEditable
              label="Contraseña Portal"
              valor={cliente.password_portal}
              campo="password_portal"
              tienePermiso={tienePermiso}
              permiso="clientes.general.editar_password"
              editando={editando}
              setEditando={setEditando}
              guardarCampo={guardarCampo}
              saving={saving}
            />
          )}
        </div>
      </div>

      {/* Socios */}
      {tienePermiso('clientes.socios.ver') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos Socio 1</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Nombre y Apellidos
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {socios[0]?.nombre_apellidos || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Nº De Teléfono
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {socios[0]?.telefono || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Correo Electrónico
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {socios[0]?.email || '-'}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos Socio 2</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Nombre y Apellidos
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {socios[1]?.nombre_apellidos || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Nº De Teléfono
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {socios[1]?.telefono || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Correo Electrónico
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {socios[1]?.email || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detalles Servicio */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalles Servicio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CampoEditable
            label="Servicio Contratado"
            valor={cliente.servicio_contratado}
            campo="servicio_contratado"
            tienePermiso={tienePermiso}
            permiso="clientes.general.editar_servicio"
            editando={editando}
            setEditando={setEditando}
            guardarCampo={guardarCampo}
            saving={saving}
          />
          <CampoEditable
            label="Fecha de Onboarding"
            valor={cliente.fecha_onboarding}
            campo="fecha_onboarding"
            tipo="date"
            tienePermiso={tienePermiso}
            permiso="clientes.general.editar_fecha_onboarding"
            editando={editando}
            setEditando={setEditando}
            guardarCampo={guardarCampo}
            saving={saving}
          />
          <CampoEditable
            label="Estado"
            valor={cliente.estado}
            campo="estado"
            tipo="select"
            opciones={estadoOpciones}
            tienePermiso={tienePermiso}
            permiso="clientes.general.editar_estado"
            editando={editando}
            setEditando={setEditando}
            guardarCampo={guardarCampo}
            saving={saving}
          />
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Especialidad
            </label>
            <div className="flex flex-wrap gap-2">
              {cliente.especialidad?.map((esp, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {esp}
                  {tienePermiso('clientes.general.editar_especialidad') && (
                    <button className="hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              )) || <span className="text-gray-400">-</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Tab Facturación (placeholder)
function TabFacturacion({ facturacion, clienteId, tienePermiso }) {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de Facturación</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Nombre Fiscal</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">{facturacion?.nombre_fiscal || '-'}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">CIF/NIF</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">{facturacion?.cif_nif || '-'}</div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-500 mb-1">Dirección Fiscal</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">{facturacion?.direccion_fiscal || '-'}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Provincia</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">{facturacion?.provincia || '-'}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Código Postal</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">{facturacion?.codigo_postal || '-'}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Ciudad</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">{facturacion?.ciudad || '-'}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">País</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">{facturacion?.pais || '-'}</div>
        </div>
      </div>
    </div>
  )
}

// Tab URLs (placeholder)
function TabUrls({ urls, tienePermiso }) {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">URLs y RRSS</h3>
      <div className="space-y-4">
        {[
          { label: 'Página Web', valor: urls?.pagina_web },
          { label: 'Página Web 2', valor: urls?.pagina_web_2 },
          { label: 'Instagram Profesional', valor: urls?.instagram },
          { label: 'Facebook Profesional', valor: urls?.facebook },
        ].map((item, i) => (
          <div key={i}>
            <label className="block text-sm font-medium text-gray-500 mb-1">{item.label}</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg truncate">
                {item.valor || '-'}
              </div>
              {item.valor && (
                <a
                  href={item.valor.startsWith('http') ? item.valor : `https://${item.valor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Tab Branding (placeholder)
function TabBranding({ branding, tienePermiso }) {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding y Contenido de Marca</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Colores</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg min-h-[80px]">
            {branding?.colores || <span className="text-gray-400">Ingrese las especificaciones y apuntes</span>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Tipografías</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg min-h-[80px]">
            {branding?.tipografias || <span className="text-gray-400">Ingrese las especificaciones y apuntes</span>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Tono de Marca</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg min-h-[80px]">
            {branding?.tono_marca || <span className="text-gray-400">Ingrese las especificaciones y apuntes</span>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Especificaciones Funnel</label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg min-h-[80px]">
            {branding?.especificaciones_funnel || <span className="text-gray-400">Ingrese las especificaciones y apuntes</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// Tab Leads (placeholder - lo completaremos después)
function TabLeads({ clienteId, tienePermiso }) {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Control de Clientes Potenciales</h3>
      <p className="text-gray-500">Módulo de leads en desarrollo...</p>
    </div>
  )
}

// Tab Campañas (placeholder)
function TabCampanas({ clienteId, tienePermiso }) {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Campañas y Segmentación</h3>
      <p className="text-gray-500">Módulo de campañas en desarrollo...</p>
    </div>
  )
}

// Tab Reuniones (placeholder)
function TabReuniones({ clienteId, tienePermiso }) {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Reuniones</h3>
      <p className="text-gray-500">Módulo de reuniones en desarrollo...</p>
    </div>
  )
}

// Tab Registro (placeholder)
function TabRegistro({ clienteId }) {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Registro de Cambios en la Ficha del Cliente</h3>
      <p className="text-gray-500">Historial de cambios en desarrollo...</p>
    </div>
  )
}
