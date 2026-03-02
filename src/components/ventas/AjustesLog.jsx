import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Select from '../ui/Select'

const MODULOS = [
  { value: '', label: 'Todos los módulos' },
  { value: 'auth', label: 'Autenticación' },
  { value: 'crm', label: 'CRM' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'ajustes', label: 'Ajustes' },
  { value: 'calendario', label: 'Calendario' },
  { value: 'biblioteca', label: 'Biblioteca' },
]

const ACCIONES = [
  { value: '', label: 'Todas las acciones' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'crear', label: 'Crear' },
  { value: 'editar', label: 'Editar' },
  { value: 'eliminar', label: 'Eliminar' },
  { value: 'aprobar', label: 'Aprobar' },
  { value: 'rechazar', label: 'Rechazar' },
  { value: 'cambio_etapa', label: 'Cambio de etapa' },
  { value: 'asignar', label: 'Asignación' },
  { value: 'devolucion', label: 'Devolución' },
]

const MODULO_LABELS = {
  auth: 'Auth',
  crm: 'CRM',
  ventas: 'Ventas',
  wallet: 'Wallet',
  ajustes: 'Ajustes',
  calendario: 'Calendario',
  biblioteca: 'Biblioteca',
}

const POR_PAGINA = 50

export default function AjustesLog({
  actividad, actividadTotal, onCargar,
}) {
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [pagina, setPagina] = useState(0)
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cargarUsuarios = async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('activo', true)
        .order('nombre')
      setUsuarios(data || [])
    }
    cargarUsuarios()
  }, [])

  useEffect(() => {
    setLoading(true)
    onCargar({
      usuario_id: filtroUsuario || undefined,
      modulo: filtroModulo || undefined,
      accion: filtroAccion || undefined,
      desde: filtroDesde || undefined,
      hasta: filtroHasta || undefined,
    }, pagina, POR_PAGINA).finally(() => setLoading(false))
  }, [filtroUsuario, filtroModulo, filtroAccion, filtroDesde, filtroHasta, pagina])

  const totalPaginas = Math.ceil(actividadTotal / POR_PAGINA)

  return (
    <div className="aj-seccion aj-seccion-wide">
      <h3>Log de actividad</h3>

      <div className="aj-log-filtros">
        <Select value={filtroUsuario} onChange={e => { setFiltroUsuario(e.target.value); setPagina(0) }}>
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => (
            <option key={u.id} value={u.id}>{u.nombre || u.email}</option>
          ))}
        </Select>
        <Select value={filtroModulo} onChange={e => { setFiltroModulo(e.target.value); setPagina(0) }}>
          {MODULOS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </Select>
        <Select value={filtroAccion} onChange={e => { setFiltroAccion(e.target.value); setPagina(0) }}>
          {ACCIONES.map(a => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </Select>
        <div className="aj-log-date-field">
          <label>Desde</label>
          <input type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setPagina(0) }} />
        </div>
        <div className="aj-log-date-field">
          <label>Hasta</label>
          <input type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setPagina(0) }} />
        </div>
      </div>

      {loading ? (
        <div className="aj-loading">Cargando...</div>
      ) : actividad.length === 0 ? (
        <div className="aj-empty">Sin registros de actividad</div>
      ) : (
        <>
          <div className="aj-log-table-wrap">
            <table className="aj-log-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Módulo</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {actividad.map(a => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{a.usuario?.nombre || a.usuario?.email || '-'}</td>
                    <td><span className={`aj-modulo-badge aj-modulo-${a.modulo}`}>{MODULO_LABELS[a.modulo] || a.modulo}</span></td>
                    <td><span className="aj-log-tipo">{a.accion}</span></td>
                    <td className="aj-log-desc">{a.descripcion || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="aj-paginacion">
              <button className="aj-btn-sm" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
              <span className="aj-pag-info">Página {pagina + 1} de {totalPaginas}</span>
              <button className="aj-btn-sm" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
