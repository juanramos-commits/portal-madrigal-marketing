import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  ExternalLink,
  Phone,
  Mail
} from 'lucide-react'

export default function Clientes() {
  const { tienePermiso } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [vistaTabla, setVistaTabla] = useState(true)

  useEffect(() => {
    cargarClientes()
  }, [filtroEstado])

  const cargarClientes = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('clientes')
        .select(`
          *,
          usuario_asignado:usuarios(nombre),
          clientes_urls(pagina_web, instagram)
        `)
        .order('nombre_comercial', { ascending: true })

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

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
    const busquedaLower = busqueda.toLowerCase()
    return (
      cliente.nombre_comercial?.toLowerCase().includes(busquedaLower) ||
      cliente.email_portal?.toLowerCase().includes(busquedaLower) ||
      cliente.telefono?.includes(busqueda)
    )
  })

  const getEstadoBadge = (estado) => {
    const estilos = {
      'campañas_activas': 'bg-green-100 text-green-700',
      'pausado': 'bg-yellow-100 text-yellow-700',
      'baja': 'bg-red-100 text-red-700',
      'onboarding': 'bg-blue-100 text-blue-700'
    }
    const nombres = {
      'campañas_activas': 'Activo',
      'pausado': 'Pausado',
      'baja': 'Baja',
      'onboarding': 'Onboarding'
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estilos[estado] || 'bg-gray-100 text-gray-700'}`}>
        {nombres[estado] || estado}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-1">
            Gestiona todos tus clientes desde aquí
          </p>
        </div>
        {tienePermiso('clientes.crear') && (
          <Link
            to="/clientes/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Nuevo Cliente
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, email, provincia, URLs..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
            />
          </div>

          {/* Estado filter */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white"
          >
            <option value="todos">Todos los estados</option>
            <option value="campañas_activas">Campañas Activas</option>
            <option value="pausado">Pausado</option>
            <option value="onboarding">Onboarding</option>
            <option value="baja">Baja</option>
          </select>

          {/* Vista toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setVistaTabla(true)}
              className={`px-4 py-2.5 text-sm font-medium ${
                vistaTabla
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Tabla
            </button>
            <button
              onClick={() => setVistaTabla(false)}
              className={`px-4 py-2.5 text-sm font-medium ${
                !vistaTabla
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Tarjetas
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No hay clientes
          </h3>
          <p className="text-gray-500 mb-4">
            {busqueda
              ? 'No se encontraron clientes con esos criterios'
              : 'Comienza añadiendo tu primer cliente'}
          </p>
          {tienePermiso('clientes.crear') && !busqueda && (
            <Link
              to="/clientes/nuevo"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              <Plus className="h-5 w-5" />
              Nuevo Cliente
            </Link>
          )}
        </div>
      ) : vistaTabla ? (
        /* Vista Tabla */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Servicio
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Asignado a
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clientesFiltrados.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center font-medium text-gray-600">
                          {cliente.nombre_comercial?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 hover:text-black">
                            {cliente.nombre_comercial}
                          </p>
                          <p className="text-sm text-gray-500">
                            ID: {cliente.id_numerico}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {cliente.email_portal && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4" />
                            {cliente.email_portal}
                          </div>
                        )}
                        {cliente.telefono && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="h-4 w-4" />
                            {cliente.telefono}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {cliente.servicio_contratado || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getEstadoBadge(cliente.estado)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {cliente.usuario_asignado?.nombre || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="text-sm font-medium text-black hover:underline"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Vista Tarjetas */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map((cliente) => (
            <Link
              key={cliente.id}
              to={`/clientes/${cliente.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center font-medium text-gray-600 text-lg">
                    {cliente.nombre_comercial?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {cliente.nombre_comercial}
                    </h3>
                    <p className="text-sm text-gray-500">
                      ID: {cliente.id_numerico}
                    </p>
                  </div>
                </div>
                {getEstadoBadge(cliente.estado)}
              </div>

              <div className="space-y-2 text-sm">
                {cliente.servicio_contratado && (
                  <p className="text-gray-600">
                    <span className="font-medium">Servicio:</span> {cliente.servicio_contratado}
                  </p>
                )}
                {cliente.email_portal && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {cliente.email_portal}
                  </p>
                )}
                {cliente.telefono && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {cliente.telefono}
                  </p>
                )}
              </div>

              {cliente.especialidad?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-4">
                  {cliente.especialidad.map((esp, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                    >
                      {esp}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Pagination placeholder */}
      {clientesFiltrados.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Mostrando {clientesFiltrados.length} de {clientes.length} clientes
          </p>
        </div>
      )}
    </div>
  )
}
