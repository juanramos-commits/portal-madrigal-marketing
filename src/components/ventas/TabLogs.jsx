import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  RefreshCw, ChevronDown, ChevronRight, Calendar,
  Info, AlertTriangle, AlertCircle, Bot, MessageSquare,
  ShieldCheck, Heart, X, Search
} from 'lucide-react'

const TIPOS = [
  { id: 'info', label: 'Info', color: '#6495ed', icon: Info },
  { id: 'error', label: 'Error', color: '#ef4444', icon: AlertCircle },
  { id: 'warning', label: 'Warning', color: '#ffa94d', icon: AlertTriangle },
  { id: 'ai_call', label: 'AI Call', color: '#a855f7', icon: Bot },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', icon: MessageSquare },
  { id: 'quality_check', label: 'Quality', color: '#14b8a6', icon: ShieldCheck },
  { id: 'sentiment', label: 'Sentiment', color: '#ec4899', icon: Heart },
]

const TIPO_MAP = Object.fromEntries(TIPOS.map(t => [t.id, t]))

const PAGE_SIZE = 50

function formatTimestamp(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function truncate(str, len = 120) {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '...' : str
}

function TipoBadge({ tipo }) {
  const config = TIPO_MAP[tipo] || { label: tipo, color: 'var(--text-secondary)', icon: Info }
  const Icon = config.icon
  return (
    <span
      className="ia-logs-badge"
      style={{
        color: config.color,
        borderColor: config.color,
        background: `${config.color}15`,
      }}
    >
      <Icon size={11} />
      {config.label}
    </span>
  )
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="ia-logs-row"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <td className="ia-logs-cell ia-logs-cell-expand">
          {expanded
            ? <ChevronDown size={14} />
            : <ChevronRight size={14} />}
        </td>
        <td className="ia-logs-cell ia-logs-cell-time">
          {formatTimestamp(log.created_at)}
        </td>
        <td className="ia-logs-cell ia-logs-cell-tipo">
          <TipoBadge tipo={log.tipo} />
        </td>
        <td className="ia-logs-cell ia-logs-cell-msg">
          {truncate(log.mensaje)}
        </td>
      </tr>
      {expanded && (
        <tr className="ia-logs-row-detail">
          <td colSpan={4}>
            <div className="ia-logs-detail">
              <div className="ia-logs-detail-section">
                <span className="ia-logs-detail-label">Mensaje completo</span>
                <pre className="ia-logs-detail-pre">{log.mensaje || '(sin mensaje)'}</pre>
              </div>
              {log.conversacion_id && (
                <div className="ia-logs-detail-section">
                  <span className="ia-logs-detail-label">Conversacion ID</span>
                  <span className="ia-logs-detail-value">{log.conversacion_id}</span>
                </div>
              )}
              {log.detalles && typeof log.detalles === 'object' && !Array.isArray(log.detalles) && Object.keys(log.detalles).length > 0 && (
                <div className="ia-logs-detail-section">
                  <span className="ia-logs-detail-label">Detalles</span>
                  <pre className="ia-logs-detail-pre">
                    {JSON.stringify(log.detalles, null, 2)}
                  </pre>
                </div>
              )}
              <div className="ia-logs-detail-section">
                <span className="ia-logs-detail-label">ID</span>
                <span className="ia-logs-detail-value">{log.id}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function TabLogs({ agenteId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [tiposFiltro, setTiposFiltro] = useState([])
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const pageOffsetRef = useRef(0)
  const searchTimeoutRef = useRef(null)

  // Refs for realtime callback to avoid stale closures
  const tiposFiltroRef = useRef(tiposFiltro)
  const fechaDesdeRef = useRef(fechaDesde)
  const fechaHastaRef = useRef(fechaHasta)
  const busquedaRef = useRef(busqueda)
  useEffect(() => { tiposFiltroRef.current = tiposFiltro }, [tiposFiltro])
  useEffect(() => { fechaDesdeRef.current = fechaDesde }, [fechaDesde])
  useEffect(() => { fechaHastaRef.current = fechaHasta }, [fechaHasta])
  useEffect(() => { busquedaRef.current = busqueda }, [busqueda])

  const fetchLogs = useCallback(async (offset = 0, append = false) => {
    if (!agenteId) return

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      pageOffsetRef.current = 0
    }

    try {
      let query = supabase
        .from('ia_logs')
        .select('*')
        .eq('agente_id', agenteId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (tiposFiltro.length > 0) {
        query = query.in('tipo', tiposFiltro)
      }
      if (fechaDesde) {
        query = query.gte('created_at', new Date(fechaDesde).toISOString())
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        query = query.lte('created_at', hasta.toISOString())
      }
      if (busqueda.trim()) {
        query = query.ilike('mensaje', `%${busqueda.trim()}%`)
      }

      const { data, error } = await query
      if (error) throw error

      const rows = data || []
      setHasMore(rows.length === PAGE_SIZE)

      if (append) {
        setLogs(prev => [...prev, ...rows])
        pageOffsetRef.current = offset + rows.length
      } else {
        setLogs(rows)
        pageOffsetRef.current = rows.length
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [agenteId, tiposFiltro, fechaDesde, fechaHasta, busqueda])

  // Initial fetch and refetch on filter change
  useEffect(() => {
    fetchLogs(0, false)
  }, [fetchLogs])

  // Realtime subscription -- stable, only depends on agenteId
  useEffect(() => {
    if (!agenteId) return

    const channelId = `ia_logs_${agenteId}_${Date.now()}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ia_logs',
          filter: `agente_id=eq.${agenteId}`,
        },
        (payload) => {
          const newLog = payload.new
          // Read current filter values from refs
          const tipos = tiposFiltroRef.current
          const desde = fechaDesdeRef.current
          const hasta = fechaHastaRef.current
          const search = busquedaRef.current

          if (tipos.length > 0 && !tipos.includes(newLog.tipo)) return
          if (desde && new Date(newLog.created_at) < new Date(desde)) return
          if (hasta) {
            const hastaDate = new Date(hasta)
            hastaDate.setHours(23, 59, 59, 999)
            if (new Date(newLog.created_at) > hastaDate) return
          }
          if (search.trim() && newLog.mensaje && !newLog.mensaje.toLowerCase().includes(search.trim().toLowerCase())) return

          setLogs(prev => {
            // Deduplicate
            if (prev.some(l => l.id === newLog.id)) return prev
            return [newLog, ...prev]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [agenteId])

  const toggleTipo = (tipoId) => {
    setTiposFiltro(prev =>
      prev.includes(tipoId)
        ? prev.filter(t => t !== tipoId)
        : [...prev, tipoId]
    )
  }

  const clearFilters = () => {
    setTiposFiltro([])
    setFechaDesde('')
    setFechaHasta('')
    setBusqueda('')
  }

  const handleSearchChange = (e) => {
    const val = e.target.value
    setBusqueda(val)
  }

  const handleLoadMore = () => {
    fetchLogs(pageOffsetRef.current, true)
  }

  const hasActiveFilters = tiposFiltro.length > 0 || fechaDesde || fechaHasta || busqueda.trim()

  return (
    <div className="ia-logs">
      {/* Filters */}
      <div className="ia-logs-filters">
        <div className="ia-logs-filters-row">
          <div className="ia-logs-tipos-filter">
            {TIPOS.map(t => (
              <button
                key={t.id}
                className={`ia-logs-tipo-pill ${tiposFiltro.includes(t.id) ? 'active' : ''}`}
                onClick={() => toggleTipo(t.id)}
                style={
                  tiposFiltro.includes(t.id)
                    ? { background: t.color, color: '#fff', borderColor: t.color }
                    : { borderColor: `${t.color}60`, color: t.color }
                }
              >
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="ia-logs-search-filter">
            <Search size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input
              type="text"
              className="ia-logs-search-input"
              placeholder="Buscar en logs..."
              value={busqueda}
              onChange={handleSearchChange}
            />
          </div>

          <div className="ia-logs-date-filter">
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="date"
              className="ia-logs-date-input"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
            />
            <span style={{ color: 'var(--text-secondary)' }}>-</span>
            <input
              type="date"
              className="ia-logs-date-input"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
            />
          </div>

          {hasActiveFilters && (
            <button className="ia-logs-clear-btn" onClick={clearFilters}>
              <X size={12} /> Limpiar
            </button>
          )}

          <button
            className="ia-btn ia-btn-secondary ia-btn-sm"
            onClick={() => fetchLogs(0, false)}
            title="Recargar"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="ia-logs-table-wrap">
        {loading ? (
          <div className="ia-loading" style={{ padding: 40 }}>
            <div className="ia-spinner" />
          </div>
        ) : logs.length === 0 ? (
          <div className="ia-logs-empty">
            <Info size={24} strokeWidth={1} />
            <p>No hay logs{hasActiveFilters ? ' con estos filtros' : ''}</p>
          </div>
        ) : (
          <table className="ia-logs-table">
            <thead>
              <tr>
                <th className="ia-logs-th" style={{ width: 30 }} />
                <th className="ia-logs-th" style={{ width: 180 }}>Fecha</th>
                <th className="ia-logs-th" style={{ width: 120 }}>Tipo</th>
                <th className="ia-logs-th">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <LogRow key={log.id} log={log} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Load more */}
      {!loading && hasMore && logs.length > 0 && (
        <div className="ia-logs-load-more">
          <button
            className="ia-btn ia-btn-secondary"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <div className="ia-spinner" style={{ width: 14, height: 14 }} />
                Cargando...
              </>
            ) : (
              `Cargar más (${logs.length} mostrados)`
            )}
          </button>
        </div>
      )}
    </div>
  )
}
