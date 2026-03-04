import { useState, useEffect } from 'react'
import Select from '../ui/Select'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'

const SUPABASE_URL = 'https://ootncgtcvwnrskqtamak.supabase.co'
const CRM_FIELDS = [
  { value: 'nombre', label: 'Nombre' },
  { value: 'email', label: 'Email' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'nombre_negocio', label: 'Nombre del negocio' },
  { value: 'fuente', label: 'Fuente' },
  { value: 'ciudad', label: 'Ciudad' },
  { value: 'pais', label: 'País' },
  { value: 'notas', label: 'Notas' },
  { value: 'valor_estimado', label: 'Valor estimado' },
  { value: 'categoria_id', label: 'Categoría' },
]

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aj-icon-sm" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

function tiempoRelativo(fecha) {
  if (!fecha) return '-'
  const diffMs = Date.now() - new Date(fecha).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `Hace ${diffMin}m`
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 24) return `Hace ${diffH}h`
  return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

export default function AjustesWebhooks({
  webhooks, onCargar, onCrear, onEditar, onEliminar,
  onGuardarMapeo, onCargarLogs,
}) {
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', fuente: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Mapeo
  const [showMapeo, setShowMapeo] = useState(null)
  const [mapeo, setMapeo] = useState([])
  const [savingMapeo, setSavingMapeo] = useState(false)

  // Logs
  const [showLogs, setShowLogs] = useState(null)
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [expandedLog, setExpandedLog] = useState(null)

  useEffect(() => { onCargar() }, [])

  const getWebhookUrl = (w) => `${SUPABASE_URL}/functions/v1/webhook-leads/${w.endpoint_token}`

  const copiarUrl = (w) => {
    navigator.clipboard.writeText(getWebhookUrl(w))
    setCopiado(w.id)
    setTimeout(() => setCopiado(null), 2000)
  }

  const abrirNuevo = () => { setEditando(null); setForm({ nombre: '', fuente: '' }); setError(null); setShowForm(true) }
  const abrirEditar = (w) => { setEditando(w); setForm({ nombre: w.nombre, fuente: w.fuente || '' }); setError(null); setShowForm(true) }

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    try {
      if (editando) { await onEditar(editando.id, { nombre: form.nombre, fuente: form.fuente || null }) }
      else { await onCrear({ nombre: form.nombre, fuente: form.fuente || null }) }
      setShowForm(false)
    } catch (e) { setError(e.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const handleEliminar = async () => {
    if (!confirmDelete) return
    try { await onEliminar(confirmDelete.id) } catch (err) { console.warn('Error al eliminar webhook:', err) }
    setConfirmDelete(null)
  }

  const handleToggleActivo = async (w) => {
    try { await onEditar(w.id, { activo: !w.activo }) } catch (err) { console.warn('Error al cambiar estado webhook:', err) }
  }

  // Mapeo
  const abrirMapeo = (w) => {
    const existing = w.mapeo_campos || {}
    const entries = Object.entries(existing).map(([webhook, crm]) => ({ webhook, crm }))
    if (entries.length === 0) entries.push({ webhook: '', crm: '' })
    setMapeo(entries)
    setShowMapeo(w)
  }

  const addMapeoRow = () => setMapeo(prev => [...prev, { webhook: '', crm: '' }])
  const removeMapeoRow = (idx) => setMapeo(prev => prev.filter((_, i) => i !== idx))
  const updateMapeo = (idx, field, value) => {
    setMapeo(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const handleGuardarMapeo = async () => {
    const obj = {}
    for (const r of mapeo) {
      if (r.webhook.trim() && r.crm) obj[r.webhook.trim()] = r.crm
    }
    setSavingMapeo(true)
    try {
      await onGuardarMapeo(showMapeo.id, obj)
      setShowMapeo(null)
    } catch (err) { console.warn('Error al guardar mapeo:', err) }
    finally { setSavingMapeo(false) }
  }

  // Logs
  const abrirLogs = async (w) => {
    setShowLogs(w)
    setLogsLoading(true)
    const data = await onCargarLogs(w.id)
    setLogs(data)
    setLogsLoading(false)
  }

  return (
    <div className="aj-seccion">
      <div className="aj-seccion-header">
        <h3>Webhooks</h3>
        <button className="aj-btn-sm" onClick={abrirNuevo}>+ Nuevo webhook</button>
      </div>

      {webhooks.length === 0 ? (
        <div className="aj-empty">No hay webhooks configurados</div>
      ) : (
        <div className="aj-cards-list">
          {webhooks.map(w => (
            <div key={w.id} className="aj-card">
              <div className="aj-card-top">
                <span className="aj-card-title">{w.nombre}</span>
                <button className={`aj-status-badge ${w.activo ? 'aj-status-active' : 'aj-status-inactive'}`} onClick={() => handleToggleActivo(w)} aria-label={w.activo ? 'Desactivar webhook' : 'Activar webhook'}>
                  {w.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
              <div className="aj-webhook-url">
                <code>{getWebhookUrl(w)}</code>
                <button className="aj-btn-icon" onClick={() => copiarUrl(w)} aria-label="Copiar URL">
                  <CopyIcon />
                  {copiado === w.id && <span className="aj-copiado" aria-live="polite">¡Copiado!</span>}
                </button>
              </div>
              {w.fuente && <div className="aj-card-meta">Fuente: {w.fuente}</div>}
              <div className="aj-card-actions">
                <button className="aj-btn-sm" onClick={() => abrirMapeo(w)}>Mapeo</button>
                <button className="aj-btn-sm" onClick={() => abrirLogs(w)}>Logs</button>
                <button className="aj-btn-sm" onClick={() => abrirEditar(w)}>Editar</button>
                <button className="aj-btn-icon-danger" onClick={() => setConfirmDelete(w)} aria-label="Eliminar webhook">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aj-icon-sm" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editando ? 'Editar webhook' : 'Nuevo webhook'}
        size="sm"
        footer={
          <>
            <button className="aj-btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="aj-btn-primary" onClick={handleGuardar} disabled={saving}>{saving ? 'Guardando...' : editando ? 'Guardar' : 'Crear'}</button>
          </>
        }
      >
        <div className="aj-field"><label>Nombre *</label><input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
        <div className="aj-field"><label>Fuente</label><input type="text" value={form.fuente} onChange={e => setForm(p => ({ ...p, fuente: e.target.value }))} placeholder="Instagram Ads, Facebook Ads..." /></div>
        {error && <div className="aj-error">{error}</div>}
      </Modal>

      {/* Mapeo modal */}
      <Modal
        open={!!showMapeo}
        onClose={() => setShowMapeo(null)}
        title={`Mapeo de campos — ${showMapeo?.nombre || ''}`}
        footer={
          <>
            <button className="aj-btn-ghost" onClick={() => setShowMapeo(null)}>Cancelar</button>
            <button className="aj-btn-primary" onClick={handleGuardarMapeo} disabled={savingMapeo}>{savingMapeo ? 'Guardando...' : 'Guardar mapeo'}</button>
          </>
        }
      >
        <div className="aj-mapeo-header">
          <span>Campo del webhook</span>
          <span />
          <span>Campo del CRM</span>
          <span />
        </div>
        {mapeo.map((r, i) => (
          <div key={i} className="aj-mapeo-row">
            <input type="text" value={r.webhook} onChange={e => updateMapeo(i, 'webhook', e.target.value)} placeholder="name" />
            <span className="aj-mapeo-arrow">→</span>
            <Select value={r.crm} onChange={e => updateMapeo(i, 'crm', e.target.value)}>
              <option value="">Seleccionar</option>
              {CRM_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
            <button className="aj-btn-icon-danger" onClick={() => removeMapeoRow(i)} aria-label="Eliminar mapeo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aj-icon-sm" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
        <button className="aj-btn-sm aj-mt" onClick={addMapeoRow}>+ Añadir campo</button>
      </Modal>

      {/* Logs modal */}
      <Modal
        open={!!showLogs}
        onClose={() => setShowLogs(null)}
        title={`Logs — ${showLogs?.nombre || ''}`}
        size="lg"
      >
        {logsLoading ? (
          <div className="aj-loading">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="aj-empty">Sin registros</div>
        ) : (
          <div className="aj-logs-list">
            {logs.map(l => (
              <div key={l.id} className="aj-log-row" role="button" tabIndex={0} onClick={() => setExpandedLog(expandedLog === l.id ? null : l.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedLog(expandedLog === l.id ? null : l.id) } }} aria-expanded={expandedLog === l.id}>
                <div className="aj-log-main">
                  <span className="aj-log-fecha">{new Date(l.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={`aj-log-resultado ${l.resultado === 'exito' ? 'aj-text-success' : 'aj-text-error'}`}>
                    {l.resultado === 'exito' ? 'Éxito' : 'Error'}
                  </span>
                  {l.lead_nombre && <span>{l.lead_nombre}</span>}
                  {l.mensaje_error && <span className="aj-text-error">{l.mensaje_error}</span>}
                </div>
                {expandedLog === l.id && l.payload && (
                  <pre className="aj-log-payload">{JSON.stringify(l.payload, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar webhook"
        message={<>¿Eliminar <strong>{confirmDelete?.nombre}</strong>?</>}
        variant="danger"
        confirmText="Eliminar"
        onConfirm={handleEliminar}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
