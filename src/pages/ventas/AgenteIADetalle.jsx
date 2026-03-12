import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAgentesIA, TIPO_LABELS, DEFAULT_CONFIG } from '../../hooks/useAgentesIA'
import { Bot, ArrowLeft, Settings, MessageSquare, BarChart3, ScrollText, Power, Save, Trash2, Upload, UserPlus } from 'lucide-react'
import TabConversaciones from '../../components/ventas/TabConversaciones'
import TabMetricas from '../../components/ventas/TabMetricas'
import TabLogs from '../../components/ventas/TabLogs'
import ImportarLeadsModal from '../../components/ventas/ImportarLeadsModal'
import ContactoManualModal from '../../components/ventas/ContactoManualModal'
import '../../styles/agentes-ia.css'

const TABS = [
  { id: 'config', label: 'Configuración', icon: Settings },
  { id: 'conversaciones', label: 'Conversaciones', icon: MessageSquare },
  { id: 'metricas', label: 'Métricas', icon: BarChart3 },
  { id: 'logs', label: 'Logs', icon: ScrollText },
]

function TabConfig({ agente, onSave, saving, tienePermiso, onImportarLeads, onContactoManual }) {
  const [form, setForm] = useState({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (agente) {
      setForm({
        nombre: agente.nombre || '',
        tipo: agente.tipo || 'setter',
        system_prompt: agente.system_prompt || '',
        system_prompt_b: agente.system_prompt_b || '',
        ab_test_activo: agente.ab_test_activo || false,
        ab_split: agente.ab_split || 50,
        whatsapp_phone_id: agente.whatsapp_phone_id || '',
        modo_sandbox: agente.modo_sandbox ?? true,
        sandbox_phones: (agente.sandbox_phones || []).join(', '),
        rate_limit_msg_hora: agente.rate_limit_msg_hora || 60,
        rate_limit_nuevos_dia: agente.rate_limit_nuevos_dia || 50,
        config: agente.config || DEFAULT_CONFIG,
      })
      setDirty(false)
    }
  }, [agente])

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const updateConfig = (key, value) => {
    setForm(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value }
    }))
    setDirty(true)
  }

  const handleSave = () => {
    const changes = {
      nombre: form.nombre,
      tipo: form.tipo,
      system_prompt: form.system_prompt,
      system_prompt_b: form.system_prompt_b || null,
      ab_test_activo: form.ab_test_activo,
      ab_split: parseInt(form.ab_split) || 50,
      whatsapp_phone_id: form.whatsapp_phone_id || null,
      modo_sandbox: form.modo_sandbox,
      sandbox_phones: form.sandbox_phones ? form.sandbox_phones.split(',').map(s => s.trim()).filter(Boolean) : [],
      rate_limit_msg_hora: parseInt(form.rate_limit_msg_hora) || 60,
      rate_limit_nuevos_dia: parseInt(form.rate_limit_nuevos_dia) || 50,
      config: form.config,
    }
    onSave(changes)
    setDirty(false)
  }

  const canEdit = tienePermiso('ventas.agentes_ia.editar')
  const config = form.config || DEFAULT_CONFIG

  return (
    <div>
      {/* Identidad */}
      <div className="ia-config-section">
        <h3>Identidad</h3>
        <div className="ia-config-row">
          <div className="ia-field">
            <label>Nombre del agente</label>
            <input
              value={form.nombre || ''}
              onChange={e => update('nombre', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="ia-field">
            <label>Tipo</label>
            <select value={form.tipo || 'setter'} onChange={e => update('tipo', e.target.value)} disabled={!canEdit}>
              <option value="setter">Setter (publicidad)</option>
              <option value="repescadora">Repescadora</option>
              <option value="outbound_frio">Outbound Frío</option>
            </select>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="ia-config-section">
        <h3>System Prompt (personalidad del agente)</h3>
        <div className="ia-field">
          <label>Prompt A {form.ab_test_activo ? '(principal)' : ''}</label>
          <textarea
            value={form.system_prompt || ''}
            onChange={e => update('system_prompt', e.target.value)}
            placeholder="Define la personalidad, reglas y comportamiento del agente..."
            style={{ minHeight: 200 }}
            disabled={!canEdit}
          />
        </div>

        <div className="ia-toggle-row">
          <div className="ia-toggle-label">
            <span>Test A/B de prompts</span>
            <span>Compara dos versiones del prompt con métricas reales</span>
          </div>
          <button
            className={`ia-switch ${form.ab_test_activo ? 'on' : ''}`}
            onClick={() => update('ab_test_activo', !form.ab_test_activo)}
            disabled={!canEdit}
          />
        </div>

        {form.ab_test_activo && (
          <>
            <div className="ia-field" style={{ marginTop: 12 }}>
              <label>Prompt B (alternativo)</label>
              <textarea
                value={form.system_prompt_b || ''}
                onChange={e => update('system_prompt_b', e.target.value)}
                placeholder="Versión alternativa del prompt para comparar..."
                style={{ minHeight: 150 }}
                disabled={!canEdit}
              />
            </div>
            <div className="ia-field">
              <label>Split (% de leads que van a versión B)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.ab_split || 50}
                onChange={e => update('ab_split', e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </>
        )}
      </div>

      {/* WhatsApp */}
      <div className="ia-config-section">
        <h3>WhatsApp</h3>
        <div className="ia-field">
          <label>Phone Number ID (Meta Business)</label>
          <input
            value={form.whatsapp_phone_id || ''}
            onChange={e => update('whatsapp_phone_id', e.target.value)}
            placeholder="Ej: 123456789012345"
            disabled={!canEdit}
          />
        </div>

        <div className="ia-toggle-row">
          <div className="ia-toggle-label">
            <span>Modo Sandbox</span>
            <span>Solo envía a números de prueba — actívalo antes de ir a producción</span>
          </div>
          <button
            className={`ia-switch ${form.modo_sandbox ? 'on' : ''}`}
            onClick={() => update('modo_sandbox', !form.modo_sandbox)}
            disabled={!canEdit}
          />
        </div>

        {form.modo_sandbox && (
          <div className="ia-field" style={{ marginTop: 12 }}>
            <label>Números de prueba (separados por coma)</label>
            <input
              value={form.sandbox_phones || ''}
              onChange={e => update('sandbox_phones', e.target.value)}
              placeholder="+34612345678, +34698765432"
              disabled={!canEdit}
            />
          </div>
        )}

        <div className="ia-config-row" style={{ marginTop: 12 }}>
          <div className="ia-field">
            <label>Máx. mensajes por hora</label>
            <input
              type="number"
              value={form.rate_limit_msg_hora || 60}
              onChange={e => update('rate_limit_msg_hora', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="ia-field">
            <label>Máx. nuevos contactos por día</label>
            <input
              type="number"
              value={form.rate_limit_nuevos_dia || 50}
              onChange={e => update('rate_limit_nuevos_dia', e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>
      </div>

      {/* Operativa */}
      <div className="ia-config-section">
        <h3>Operativa</h3>
        <div className="ia-config-row">
          <div className="ia-field">
            <label>Horario inicio</label>
            <input
              type="time"
              value={config.horario?.inicio || '08:30'}
              onChange={e => updateConfig('horario', { ...config.horario, inicio: e.target.value })}
              disabled={!canEdit}
            />
          </div>
          <div className="ia-field">
            <label>Horario fin</label>
            <input
              type="time"
              value={config.horario?.fin || '21:00'}
              onChange={e => updateConfig('horario', { ...config.horario, fin: e.target.value })}
              disabled={!canEdit}
            />
          </div>
        </div>
        <div className="ia-config-row">
          <div className="ia-field">
            <label>Máx. conversaciones simultáneas</label>
            <input
              type="number"
              value={config.max_conversaciones || 100}
              onChange={e => updateConfig('max_conversaciones', parseInt(e.target.value) || 100)}
              disabled={!canEdit}
            />
          </div>
          <div className="ia-field">
            <label>Máx. mensajes por día</label>
            <input
              type="number"
              value={config.max_mensajes_dia || 500}
              onChange={e => updateConfig('max_mensajes_dia', parseInt(e.target.value) || 500)}
              disabled={!canEdit}
            />
          </div>
        </div>
        <div className="ia-config-row">
          <div className="ia-field">
            <label>Umbral lead score para reunión (0-100)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={config.umbral_score_reunion || 60}
              onChange={e => updateConfig('umbral_score_reunion', parseInt(e.target.value) || 60)}
              disabled={!canEdit}
            />
          </div>
          <div className="ia-field">
            <label>Umbral calidad mínima (1-10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.umbral_calidad_minima || 6}
              onChange={e => updateConfig('umbral_calidad_minima', parseInt(e.target.value) || 6)}
              disabled={!canEdit}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      {canEdit && dirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button className="ia-btn ia-btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Acciones de leads */}
      {canEdit && (
        <div className="ia-config-section">
          <h3>Acciones de leads</h3>
          <div className="ia-config-row">
            {agente.tipo !== 'setter' && (
              <button className="ia-btn ia-btn-secondary" onClick={onImportarLeads}>
                <Upload size={14} />
                Importar leads
              </button>
            )}
            <button className="ia-btn ia-btn-secondary" onClick={onContactoManual}>
              <UserPlus size={14} />
              Contacto manual
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TabPlaceholder({ title }) {
  return (
    <div className="ia-empty">
      <h2>{title}</h2>
      <p>Esta sección se implementará en las siguientes fases.</p>
    </div>
  )
}

export default function AgenteIADetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { tienePermiso } = useAuth()
  const { agente, loading, saving, cargarAgente, actualizarAgente, eliminarAgente } = useAgentesIA()
  const [activeTab, setActiveTab] = useState('config')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importarModalOpen, setImportarModalOpen] = useState(false)
  const [contactoModalOpen, setContactoModalOpen] = useState(false)

  useEffect(() => {
    if (id) cargarAgente(id)
  }, [id, cargarAgente])

  const handleSave = useCallback(async (cambios) => {
    await actualizarAgente(id, cambios)
  }, [id, actualizarAgente])

  const handleDelete = async () => {
    await eliminarAgente(id)
    navigate('/ventas/agentes-ia')
  }

  const handleToggleActivo = async () => {
    await actualizarAgente(id, { activo: !agente.activo })
  }

  if (!tienePermiso('ventas.agentes_ia.ver')) {
    return (
      <div className="ia-page">
        <div className="ia-error">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  if (loading || !agente) {
    return (
      <div className="ia-page">
        <div className="ia-loading">
          <div className="ia-spinner" />
          <span>Cargando agente...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ia-page">
      <button className="ia-back" onClick={() => navigate('/ventas/agentes-ia')}>
        <ArrowLeft size={16} />
        Volver a agentes
      </button>

      <div className="ia-header">
        <div className="ia-header-left">
          <Bot size={28} />
          <div>
            <h1>{agente.nombre}</h1>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {TIPO_LABELS[agente.tipo] || agente.tipo}
              {agente.modo_sandbox && ' · Sandbox'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`ia-estado-toggle ${agente.activo ? 'ia-estado-activo' : 'ia-estado-inactivo'}`}
            onClick={handleToggleActivo}
            style={{ padding: '8px 14px' }}
          >
            <Power size={14} />
            {agente.activo ? 'Activo' : 'Inactivo'}
          </button>
          {tienePermiso('ventas.agentes_ia.eliminar') && (
            confirmDelete ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="ia-btn ia-btn-danger" onClick={handleDelete}>Confirmar</button>
                <button className="ia-btn ia-btn-secondary" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              </div>
            ) : (
              <button className="ia-btn ia-btn-secondary" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} />
              </button>
            )
          )}
        </div>
      </div>

      <div className="ia-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`ia-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <TabConfig
          agente={agente}
          onSave={handleSave}
          saving={saving}
          tienePermiso={tienePermiso}
          onImportarLeads={() => setImportarModalOpen(true)}
          onContactoManual={() => setContactoModalOpen(true)}
        />
      )}
      {activeTab === 'conversaciones' && <TabConversaciones agenteId={id} />}
      {activeTab === 'metricas' && <TabMetricas agenteId={id} agente={agente} />}
      {activeTab === 'logs' && <TabLogs agenteId={id} />}

      <ImportarLeadsModal
        open={importarModalOpen}
        onClose={() => setImportarModalOpen(false)}
        agenteId={id}
      />
      <ContactoManualModal
        open={contactoModalOpen}
        onClose={() => setContactoModalOpen(false)}
        agenteId={id}
      />
    </div>
  )
}
