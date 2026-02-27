import { useAjustes } from '../../hooks/useAjustes'
import AjustesPerfil from '../../components/ventas/AjustesPerfil'
import AjustesTema from '../../components/ventas/AjustesTema'
import AjustesDatosFiscales from '../../components/ventas/AjustesDatosFiscales'
import AjustesCuentaBancaria from '../../components/ventas/AjustesCuentaBancaria'
import AjustesCalendario from '../../components/ventas/AjustesCalendario'
import AjustesPipelines from '../../components/ventas/AjustesPipelines'
import AjustesReparto from '../../components/ventas/AjustesReparto'
import AjustesPaquetes from '../../components/ventas/AjustesPaquetes'
import AjustesCategorias from '../../components/ventas/AjustesCategorias'
import AjustesComisiones from '../../components/ventas/AjustesComisiones'
import AjustesEmpresaFiscal from '../../components/ventas/AjustesEmpresaFiscal'
import AjustesEquipo from '../../components/ventas/AjustesEquipo'
import AjustesWebhooks from '../../components/ventas/AjustesWebhooks'
import AjustesReunionEstados from '../../components/ventas/AjustesReunionEstados'
import AjustesCamposObligatorios from '../../components/ventas/AjustesCamposObligatorios'
import AjustesLog from '../../components/ventas/AjustesLog'
import '../../styles/ventas-ajustes.css'

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const PaletteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/>
  </svg>
)
const FileTextIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const BankIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
)
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const GitBranchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
)
const SlidersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
  </svg>
)
const PackageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  </svg>
)
const TagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
)
const DollarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)
const BuildingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><line x1="9" y1="18" x2="15" y2="18"/>
  </svg>
)
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const WebhookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M18 16.98h1a2 2 0 0 0 1.74-3.01L13 2 5.26 13.97A2 2 0 0 0 7 16.98h1"/>
    <path d="M12 2v16"/>
  </svg>
)
const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
)
const CheckSquareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)
const ActivityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const ChevronLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const SECCIONES = [
  {
    grupo: 'PERSONAL',
    items: [
      { id: 'perfil', label: 'Perfil', icon: UserIcon, minRole: null },
      { id: 'tema', label: 'Tema', icon: PaletteIcon, minRole: null },
      { id: 'datos_fiscales', label: 'Datos fiscales', icon: FileTextIcon, minRole: null },
      { id: 'cuenta_bancaria', label: 'Cuenta bancaria', icon: BankIcon, minRole: null },
      { id: 'calendario', label: 'Calendario', icon: CalendarIcon, minRole: null },
    ],
  },
  {
    grupo: 'DIRECTOR',
    items: [
      { id: 'pipelines', label: 'Pipelines y etapas', icon: GitBranchIcon, minRole: 'director' },
      { id: 'reparto', label: 'Reparto de leads', icon: SlidersIcon, minRole: 'director' },
    ],
  },
  {
    grupo: 'ADMINISTRACION',
    items: [
      { id: 'paquetes', label: 'Paquetes', icon: PackageIcon, minRole: 'admin' },
      { id: 'categorias', label: 'Categorias', icon: TagIcon, minRole: 'admin' },
      { id: 'comisiones', label: 'Comisiones', icon: DollarIcon, minRole: 'admin' },
      { id: 'empresa_fiscal', label: 'Empresa fiscal', icon: BuildingIcon, minRole: 'admin' },
      { id: 'equipo', label: 'Equipo comercial', icon: UsersIcon, minRole: 'admin' },
      { id: 'webhooks', label: 'Webhooks', icon: WebhookIcon, minRole: 'admin' },
      { id: 'reunion_estados', label: 'Estados de reunion', icon: VideoIcon, minRole: 'admin' },
      { id: 'campos_obligatorios', label: 'Campos obligatorios', icon: CheckSquareIcon, minRole: 'admin' },
      { id: 'log', label: 'Log de actividad', icon: ActivityIcon, minRole: 'admin' },
    ],
  },
]

export default function VentasAjustes() {
  const ajustes = useAjustes()
  const {
    seccionActiva, setSeccionActiva,
    esAdmin, esDirector,
  } = ajustes

  const seccionesVisibles = SECCIONES.map(grupo => ({
    ...grupo,
    items: grupo.items.filter(item => {
      if (!item.minRole) return true
      if (item.minRole === 'director') return esDirector
      if (item.minRole === 'admin') return esAdmin
      return false
    }),
  })).filter(g => g.items.length > 0)

  const seccionActivaValida = seccionesVisibles
    .flatMap(g => g.items)
    .some(i => i.id === seccionActiva)

  const seccionFinal = seccionActivaValida ? seccionActiva : 'perfil'

  const renderSeccion = () => {
    switch (seccionFinal) {
      case 'perfil':
        return (
          <AjustesPerfil
            perfil={ajustes.perfil}
            rolesComerciales={ajustes.rolesComerciales}
            onGuardarPerfil={ajustes.guardarPerfil}
            onSubirFoto={ajustes.subirFotoPerfil}
            onCambiarContrasena={ajustes.cambiarContrasena}
          />
        )
      case 'tema':
        return <AjustesTema tema={ajustes.tema} onCambiar={ajustes.setTema} />
      case 'datos_fiscales':
        return <AjustesDatosFiscales />
      case 'cuenta_bancaria':
        return <AjustesCuentaBancaria />
      case 'pipelines':
        return (
          <AjustesPipelines
            pipelines={ajustes.pipelines}
            etapas={ajustes.etapas}
            onCargarPipelines={ajustes.cargarPipelines}
            onCargarEtapas={ajustes.cargarEtapas}
            onCrearEtapa={ajustes.crearEtapa}
            onEditarEtapa={ajustes.editarEtapa}
            onEliminarEtapa={ajustes.eliminarEtapa}
            onReordenarEtapas={ajustes.reordenarEtapas}
          />
        )
      case 'reparto':
        return (
          <AjustesReparto
            repartoConfig={ajustes.repartoConfig}
            setters={(ajustes.rolesComerciales || []).filter(r => r.rol === 'setter' && r.activo)}
            onCargarReparto={ajustes.cargarReparto}
            onGuardarReparto={ajustes.guardarReparto}
          />
        )
      case 'paquetes':
        return (
          <AjustesPaquetes
            paquetes={ajustes.paquetes}
            onCargar={ajustes.cargarPaquetes}
            onCrear={ajustes.crearPaquete}
            onEditar={ajustes.editarPaquete}
            onEliminar={ajustes.eliminarPaquete}
          />
        )
      case 'categorias':
        return (
          <AjustesCategorias
            categorias={ajustes.categorias}
            onCargar={ajustes.cargarCategorias}
            onCrear={ajustes.crearCategoria}
            onEditar={ajustes.editarCategoria}
            onEliminar={ajustes.eliminarCategoria}
            onReordenar={ajustes.reordenarCategorias}
          />
        )
      case 'comisiones':
        return (
          <AjustesComisiones
            comisionesConfig={ajustes.comisionesConfig}
            equipo={ajustes.equipo}
            onCargar={ajustes.cargarComisionesConfig}
            onGuardar={ajustes.guardarComisionesConfig}
            onAsignarBonus={ajustes.asignarBonusManual}
          />
        )
      case 'empresa_fiscal':
        return (
          <AjustesEmpresaFiscal
            empresaFiscal={ajustes.empresaFiscal}
            onCargar={ajustes.cargarEmpresaFiscal}
            onGuardar={ajustes.guardarEmpresaFiscal}
          />
        )
      case 'equipo':
        return (
          <AjustesEquipo
            equipo={ajustes.equipo}
            onCargar={ajustes.cargarEquipo}
            onAsignarRol={ajustes.asignarRolComercial}
            onEditarRoles={ajustes.editarRoles}
            onDesactivar={ajustes.desactivarMiembro}
          />
        )
      case 'webhooks':
        return (
          <AjustesWebhooks
            webhooks={ajustes.webhooks}
            onCargar={ajustes.cargarWebhooks}
            onCrear={ajustes.crearWebhook}
            onEditar={ajustes.editarWebhook}
            onEliminar={ajustes.eliminarWebhook}
            onGuardarMapeo={ajustes.guardarMapeo}
            onCargarLogs={ajustes.cargarWebhookLogs}
          />
        )
      case 'reunion_estados':
        return (
          <AjustesReunionEstados
            reunionEstados={ajustes.reunionEstados}
            onCargar={ajustes.cargarReunionEstados}
            onCrear={ajustes.crearEstado}
            onEditar={ajustes.editarEstado}
            onEliminar={ajustes.eliminarEstado}
            onReordenar={ajustes.reordenarEstados}
          />
        )
      case 'campos_obligatorios':
        return (
          <AjustesCamposObligatorios
            camposObligatorios={ajustes.camposObligatorios}
            onCargar={ajustes.cargarCamposObligatorios}
            onToggle={ajustes.toggleCampoObligatorio}
          />
        )
      case 'log':
        return (
          <AjustesLog
            actividad={ajustes.actividad}
            actividadTotal={ajustes.actividadTotal}
            onCargar={ajustes.cargarActividad}
          />
        )
      default:
        return null
    }
  }

  const seccionLabel = seccionesVisibles
    .flatMap(g => g.items)
    .find(i => i.id === seccionFinal)?.label || 'Ajustes'

  return (
    <div className="aj-page">
      {/* Mobile back bar */}
      <div className="aj-mobile-bar">
        {seccionFinal !== 'perfil' ? (
          <button className="aj-back-btn" onClick={() => setSeccionActiva('perfil')}>
            <ChevronLeftIcon />
            <span>Ajustes</span>
          </button>
        ) : (
          <h1 className="aj-page-title">Ajustes</h1>
        )}
      </div>

      <div className="aj-layout">
        {/* Sidebar */}
        <aside className="aj-sidebar">
          <h1 className="aj-page-title">Ajustes</h1>
          {seccionesVisibles.map(grupo => (
            <div key={grupo.grupo} className="aj-nav-group">
              <span className="aj-nav-group-label">{grupo.grupo}</span>
              {grupo.items.map(item => (
                <button
                  key={item.id}
                  className={`aj-nav-item${seccionFinal === item.id ? ' active' : ''}`}
                  onClick={() => setSeccionActiva(item.id)}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Content */}
        <main className="aj-content">
          <div className="aj-content-header">
            <h2>{seccionLabel}</h2>
          </div>
          {renderSeccion()}
        </main>
      </div>

      {/* Mobile nav cards (shown when on 'perfil' section on mobile as home) */}
      <div className="aj-mobile-nav">
        {seccionesVisibles.map(grupo => (
          <div key={grupo.grupo} className="aj-mobile-group">
            <span className="aj-mobile-group-label">{grupo.grupo}</span>
            {grupo.items.map(item => (
              <button
                key={item.id}
                className={`aj-mobile-item${seccionFinal === item.id ? ' active' : ''}`}
                onClick={() => setSeccionActiva(item.id)}
              >
                <item.icon />
                <span>{item.label}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, marginLeft: 'auto', opacity: 0.4 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
