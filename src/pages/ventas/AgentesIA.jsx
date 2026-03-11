import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAgentesIA, TIPO_LABELS, DEFAULT_CONFIG } from '../../hooks/useAgentesIA'
import { Bot, Plus, Power, Zap, Users, Calendar, AlertTriangle, DollarSign } from 'lucide-react'
import '../../styles/agentes-ia.css'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="ia-stat-card">
      <div className="ia-stat-icon" style={{ color }}>
        <Icon size={20} />
      </div>
      <div className="ia-stat-info">
        <span className="ia-stat-value">{value}</span>
        <span className="ia-stat-label">{label}</span>
      </div>
    </div>
  )
}

function CrearAgenteModal({ open, onClose, onCrear, saving }) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('setter')

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return
    await onCrear({ nombre: nombre.trim(), tipo, config: DEFAULT_CONFIG })
    setNombre('')
    setTipo('setter')
    onClose()
  }

  return (
    <div className="ia-modal-overlay" onClick={onClose}>
      <div className="ia-modal" onClick={e => e.stopPropagation()}>
        <h2>Crear agente</h2>
        <form onSubmit={handleSubmit}>
          <div className="ia-field">
            <label>Nombre del agente</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Rosalia"
              autoFocus
            />
          </div>
          <div className="ia-field">
            <label>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="setter">Setter (publicidad)</option>
              <option value="repescadora">Repescadora</option>
              <option value="outbound_frio">Outbound Frío</option>
            </select>
          </div>
          <div className="ia-modal-actions">
            <button type="button" className="ia-btn ia-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="ia-btn ia-btn-primary" disabled={saving || !nombre.trim()}>
              {saving ? 'Creando...' : 'Crear agente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TipoBadge({ tipo }) {
  const colors = {
    setter: '#3b82f6',
    repescadora: '#f59e0b',
    outbound_frio: '#8b5cf6',
  }
  return (
    <span className="ia-tipo-badge" style={{ background: `${colors[tipo]}20`, color: colors[tipo] }}>
      {TIPO_LABELS[tipo] || tipo}
    </span>
  )
}

function EstadoToggle({ activo, onToggle, disabled }) {
  return (
    <button
      className={`ia-estado-toggle ${activo ? 'ia-estado-activo' : 'ia-estado-inactivo'}`}
      onClick={onToggle}
      disabled={disabled}
      title={activo ? 'Activo — clic para desactivar' : 'Inactivo — clic para activar'}
    >
      <Power size={14} />
      <span>{activo ? 'Activo' : 'Inactivo'}</span>
    </button>
  )
}

export default function AgentesIA() {
  const { tienePermiso } = useAuth()
  const { agentes, loading, saving, stats, cargarAgentes, crearAgente, toggleActivo } = useAgentesIA()
  const [modalOpen, setModalOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    cargarAgentes()
  }, [cargarAgentes])

  if (!tienePermiso('ventas.agentes_ia.ver')) {
    return (
      <div className="ia-page">
        <div className="ia-error">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  return (
    <div className="ia-page">
      <div className="ia-header">
        <div className="ia-header-left">
          <Bot size={28} />
          <h1>Agentes IA</h1>
        </div>
        {tienePermiso('ventas.agentes_ia.crear') && (
          <button className="ia-btn ia-btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            Crear agente
          </button>
        )}
      </div>

      {/* Mini-dashboard */}
      <div className="ia-stats-grid">
        <StatCard icon={Calendar} label="Agendados hoy" value={stats.agendados_hoy} color="#10b981" />
        <StatCard icon={Users} label="Leads activos" value={stats.leads_activos} color="#3b82f6" />
        <StatCard icon={AlertTriangle} label="Alertas" value={stats.alertas} color={stats.alertas > 0 ? '#ef4444' : '#6b7280'} />
        <StatCard icon={DollarSign} label="Gasto mes" value={`$${stats.gasto_mes.toFixed(2)}`} color="#f59e0b" />
      </div>

      {/* Tabla de agentes */}
      {loading ? (
        <div className="ia-loading">
          <div className="ia-spinner" />
          <span>Cargando agentes...</span>
        </div>
      ) : agentes.length === 0 ? (
        <div className="ia-empty">
          <Bot size={48} strokeWidth={1.5} />
          <h2>No hay agentes</h2>
          <p>Crea tu primer agente IA para empezar a automatizar ventas por WhatsApp.</p>
          {tienePermiso('ventas.agentes_ia.crear') && (
            <button className="ia-btn ia-btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              Crear agente
            </button>
          )}
        </div>
      ) : (
        <div className="ia-table-wrapper">
          <table className="ia-table">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Modo</th>
                <th>Última actividad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agentes.map(agente => (
                <tr
                  key={agente.id}
                  className="ia-table-row"
                  onClick={() => navigate(`/ventas/agentes-ia/${agente.id}`)}
                >
                  <td>
                    <div className="ia-agente-nombre">
                      <Bot size={18} />
                      <span>{agente.nombre}</span>
                    </div>
                  </td>
                  <td><TipoBadge tipo={agente.tipo} /></td>
                  <td>
                    <EstadoToggle
                      activo={agente.activo}
                      onToggle={(e) => {
                        e.stopPropagation()
                        toggleActivo(agente.id, !agente.activo)
                      }}
                    />
                  </td>
                  <td>
                    {agente.modo_sandbox ? (
                      <span className="ia-modo-badge ia-modo-sandbox">Sandbox</span>
                    ) : (
                      <span className="ia-modo-badge ia-modo-produccion">Producción</span>
                    )}
                  </td>
                  <td className="ia-fecha">
                    {agente.updated_at ? new Date(agente.updated_at).toLocaleString('es-ES', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    }) : '—'}
                  </td>
                  <td>
                    <Zap size={16} className="ia-row-arrow" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CrearAgenteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCrear={crearAgente}
        saving={saving}
      />
    </div>
  )
}
