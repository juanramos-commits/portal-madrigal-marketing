import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Select from '../ui/Select'

const TIPOS_ACCION = [
  { value: '', label: 'Todas las acciones' },
  { value: 'creacion', label: 'Creación' },
  { value: 'cambio_etapa', label: 'Cambio de etapa' },
  { value: 'edicion', label: 'Edición' },
  { value: 'venta', label: 'Venta' },
  { value: 'asignacion', label: 'Asignación' },
  { value: 'nota', label: 'Nota' },
]

const POR_PAGINA = 50

export default function AjustesLog({
  actividad, actividadTotal, onCargar,
}) {
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
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
      tipo: filtroTipo || undefined,
      desde: filtroDesde || undefined,
      hasta: filtroHasta || undefined,
    }, pagina, POR_PAGINA).finally(() => setLoading(false))
  }, [filtroUsuario, filtroTipo, filtroDesde, filtroHasta, pagina])

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
        <Select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPagina(0) }}>
          {TIPOS_ACCION.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
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
                  <th>Acción</th>
                  <th>Lead</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {actividad.map(a => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{a.usuario?.nombre || a.usuario?.email || '-'}</td>
                    <td><span className="aj-log-tipo">{a.tipo}</span></td>
                    <td>{a.lead?.nombre || '-'}</td>
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
