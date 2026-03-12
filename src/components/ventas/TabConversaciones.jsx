import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useConversacionesIA } from '../../hooks/useConversacionesIA'
import { useToast } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import {
  Search, Send, StickyNote, Bot, User, Phone, Mail,
  CheckCheck, Check, Clock, Star, Zap,
  MessageSquare, Filter, ChevronLeft, Mic, Image,
  FileText, Video, UserPlus, Info, X,
  ChevronRight, Smile, Frown, Meh, TrendingUp,
  AlertTriangle, Heart, Flame, Paperclip, Shield,
  ExternalLink, Link
} from 'lucide-react'

const ESTADO_LABELS = {
  needs_reply: 'Necesita respuesta',
  waiting_reply: 'Esperando respuesta',
  agendado: 'Reunión agendada',
  descartado: 'Descartado',
  scheduled_followup: 'Followup programado',
  no_response: 'Sin respuesta',
  handoff_humano: 'Humano',
}

const ESTADO_COLORS = {
  needs_reply: 'var(--error)',
  waiting_reply: 'var(--warning, #ffa94d)',
  agendado: 'var(--success, #2ee59d)',
  descartado: 'var(--text-secondary)',
  scheduled_followup: 'var(--info, #6495ed)',
  no_response: 'var(--text-secondary)',
  handoff_humano: '#a855f7',
}

const SENTIMIENTO_CONFIG = {
  positivo: { icon: Smile, color: 'var(--success, #2ee59d)', emoji: '\u{1F60A}', text: 'Positivo' },
  interesado: { icon: Heart, color: '#ec4899', emoji: '\u{1F914}', text: 'Interesado' },
  urgente: { icon: Flame, color: '#f97316', emoji: '\u{26A1}', text: 'Urgente' },
  neutro: { icon: Meh, color: 'var(--text-secondary)', emoji: '\u{1F610}', text: 'Neutro' },
  negativo: { icon: Frown, color: 'var(--error)', emoji: '\u{1F61F}', text: 'Negativo' },
  frustrado: { icon: AlertTriangle, color: 'var(--error)', emoji: '\u{1F624}', text: 'Frustrado' },
}

const FILTROS = [
  { id: 'todas', label: 'Todas' },
  { id: 'sin_leer', label: 'Sin leer' },
  { id: 'needs_reply', label: 'Necesitan resp.' },
  { id: 'humano', label: 'Humano' },
  { id: 'agendado', label: 'Agendados' },
  { id: 'descartado', label: 'Descartados' },
]

function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function formatFullTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('es-ES', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function MessageTypeIcon({ type, size = 12 }) {
  switch (type) {
    case 'audio': return <Mic size={size} />
    case 'image': case 'sticker': return <Image size={size} />
    case 'video': return <Video size={size} />
    case 'document': return <FileText size={size} />
    default: return null
  }
}

function WaStatus({ status }) {
  if (!status) return null
  switch (status) {
    case 'sent': return <Check size={12} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
    case 'delivered': return <CheckCheck size={12} style={{ color: 'var(--text-secondary)' }} />
    case 'read': return <CheckCheck size={12} style={{ color: '#53bdeb' }} />
    default: return null
  }
}

function getScoreColor(score) {
  if (score < 30) return '#ef4444'
  if (score < 60) return '#f59e0b'
  return '#10b981'
}

function getInitials(nombre) {
  if (!nombre) return '?'
  const parts = nombre.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return parts[0].substring(0, 2).toUpperCase()
}

// ─── Lead Sidebar Panel ──────────────────────────────
function LeadSidebar({ conv, onClose, onToggleFavorite, onAssign, usuarios }) {
  const lead = conv?.lead || {}
  const sentConfig = SENTIMIENTO_CONFIG[lead.sentimiento_actual] || SENTIMIENTO_CONFIG.neutro
  const SentimientoIcon = sentConfig.icon

  const [leadFull, setLeadFull] = useState(null)
  const [objeciones, setObjeciones] = useState([])
  const [loadingLead, setLoadingLead] = useState(false)

  // Load full lead data + objeciones
  useEffect(() => {
    if (!conv?.lead_id) return
    setLoadingLead(true)

    Promise.all([
      supabase
        .from('ia_leads')
        .select('*')
        .eq('id', conv.lead_id)
        .single(),
      supabase
        .from('ia_objeciones')
        .select('id, tipo, resuelta, created_at')
        .eq('conversacion_id', conv.id)
        .order('created_at', { ascending: false }),
    ]).then(([leadRes, objRes]) => {
      if (leadRes.data) setLeadFull(leadRes.data)
      setObjeciones(objRes.data || [])
    }).finally(() => setLoadingLead(false))
  }, [conv?.lead_id, conv?.id])

  const fullLead = leadFull || lead
  const score = fullLead.lead_score ?? 0
  const scoreColor = getScoreColor(score)
  const scoreDetalles = fullLead.score_detalles || null

  return (
    <div className="ia-lead-sidebar">
      <div className="ia-lead-sidebar-header">
        <span className="ia-lead-sidebar-title">Detalle del lead</span>
        <button className="ia-lead-sidebar-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="ia-lead-sidebar-content">
        {loadingLead && (
          <div className="ia-loading" style={{ padding: 20 }}>
            <div className="ia-spinner" />
          </div>
        )}

        {/* Contact info */}
        <div className="ia-lead-sidebar-section">
          <div className="ia-lead-sidebar-name">{fullLead.nombre || 'Sin nombre'}</div>
          {fullLead.telefono && (
            <div className="ia-lead-sidebar-row">
              <Phone size={12} /> {fullLead.telefono}
            </div>
          )}
          {fullLead.email && (
            <div className="ia-lead-sidebar-row">
              <Mail size={12} /> {fullLead.email}
            </div>
          )}
        </div>

        {/* Score */}
        <div className="ia-lead-sidebar-section">
          <div className="ia-lead-sidebar-label">Lead Score</div>
          <div className="ia-lead-sidebar-score-bar">
            <div
              className="ia-lead-sidebar-score-fill"
              style={{ width: `${score}%`, background: scoreColor }}
            />
            <span className="ia-lead-sidebar-score-text">{score}/100</span>
          </div>

          {/* Score breakdown */}
          {scoreDetalles && (
            <div className="ia-lead-score-breakdown">
              {scoreDetalles.interes != null && (
                <div className="ia-lead-score-breakdown-row">
                  <span>Interes</span>
                  <div className="ia-lead-score-mini-bar">
                    <div style={{ width: `${scoreDetalles.interes}%`, background: getScoreColor(scoreDetalles.interes) }} />
                  </div>
                  <span className="ia-lead-score-breakdown-val">{scoreDetalles.interes}</span>
                </div>
              )}
              {scoreDetalles.encaje != null && (
                <div className="ia-lead-score-breakdown-row">
                  <span>Encaje</span>
                  <div className="ia-lead-score-mini-bar">
                    <div style={{ width: `${scoreDetalles.encaje}%`, background: getScoreColor(scoreDetalles.encaje) }} />
                  </div>
                  <span className="ia-lead-score-breakdown-val">{scoreDetalles.encaje}</span>
                </div>
              )}
              {scoreDetalles.urgencia != null && (
                <div className="ia-lead-score-breakdown-row">
                  <span>Urgencia</span>
                  <div className="ia-lead-score-mini-bar">
                    <div style={{ width: `${scoreDetalles.urgencia}%`, background: getScoreColor(scoreDetalles.urgencia) }} />
                  </div>
                  <span className="ia-lead-score-breakdown-val">{scoreDetalles.urgencia}</span>
                </div>
              )}
              {scoreDetalles.capacidad_inversion != null && (
                <div className="ia-lead-score-breakdown-row">
                  <span>Inversion</span>
                  <div className="ia-lead-score-mini-bar">
                    <div style={{ width: `${scoreDetalles.capacidad_inversion}%`, background: getScoreColor(scoreDetalles.capacidad_inversion) }} />
                  </div>
                  <span className="ia-lead-score-breakdown-val">{scoreDetalles.capacidad_inversion}</span>
                </div>
              )}
            </div>
          )}

          {/* Sentimiento */}
          <div className="ia-lead-sidebar-label" style={{ marginTop: 12 }}>Sentimiento</div>
          <div className="ia-lead-sidebar-sentiment" style={{ color: sentConfig.color }}>
            <span className="ia-lead-sidebar-sentiment-emoji">{sentConfig.emoji}</span>
            {sentConfig.text}
          </div>
        </div>

        {/* Conversation info */}
        <div className="ia-lead-sidebar-section">
          <div className="ia-lead-sidebar-label">Estado</div>
          <span
            className="ia-chat-estado-badge"
            style={{ color: ESTADO_COLORS[conv.estado], borderColor: ESTADO_COLORS[conv.estado] }}
          >
            {ESTADO_LABELS[conv.estado] || conv.estado}
          </span>

          <div className="ia-lead-sidebar-label" style={{ marginTop: 12 }}>Step</div>
          <span className="ia-lead-sidebar-value">{conv.step || '\u2013'}</span>

          <div className="ia-lead-sidebar-label" style={{ marginTop: 12 }}>Bot</div>
          <span className="ia-lead-sidebar-value">
            {conv.chatbot_activo ? 'Activo' : 'Desactivado'}
            {conv.handoff_humano && ' (Humano)'}
          </span>

          {conv.ab_version && (
            <>
              <div className="ia-lead-sidebar-label" style={{ marginTop: 12 }}>A/B Version</div>
              <span className="ia-lead-sidebar-value">{conv.ab_version}</span>
            </>
          )}
        </div>

        {/* Summary */}
        {conv.resumen && (
          <div className="ia-lead-sidebar-section">
            <div className="ia-lead-sidebar-label">Resumen IA</div>
            <div className="ia-lead-sidebar-summary">{conv.resumen}</div>
          </div>
        )}

        {/* Objeciones */}
        {objeciones.length > 0 && (
          <div className="ia-lead-sidebar-section">
            <div className="ia-lead-sidebar-label">Objeciones ({objeciones.length})</div>
            <div className="ia-lead-sidebar-objeciones">
              {objeciones.map(obj => (
                <div key={obj.id} className="ia-lead-sidebar-objecion-item">
                  <span className="ia-lead-sidebar-objecion-tipo">{obj.tipo}</span>
                  <span className={`ia-lead-sidebar-objecion-badge ${obj.resuelta ? 'resuelta' : 'pendiente'}`}>
                    {obj.resuelta ? 'Resuelta' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CRM Link */}
        {fullLead.crm_lead_id && (
          <div className="ia-lead-sidebar-section">
            <div className="ia-lead-sidebar-label">CRM</div>
            <a
              href={`/ventas/leads/${fullLead.crm_lead_id}`}
              className="ia-lead-sidebar-crm-link"
            >
              <Link size={12} />
              Ver lead en CRM
              <ExternalLink size={10} />
            </a>
          </div>
        )}

        {/* RGPD + Created at */}
        <div className="ia-lead-sidebar-section">
          <div className="ia-lead-sidebar-label">Consentimiento RGPD</div>
          <div className="ia-lead-sidebar-rgpd">
            <Shield size={14} />
            <span className={`ia-lead-sidebar-rgpd-status ${fullLead.consentimiento_rgpd ? 'granted' : 'missing'}`}>
              {fullLead.consentimiento_rgpd ? 'Otorgado' : 'No otorgado'}
            </span>
          </div>

          <div className="ia-lead-sidebar-label" style={{ marginTop: 12 }}>Creado</div>
          <span className="ia-lead-sidebar-value">{formatDate(fullLead.created_at)}</span>
        </div>

        {/* Timestamps */}
        <div className="ia-lead-sidebar-section">
          <div className="ia-lead-sidebar-label">Primer mensaje</div>
          <span className="ia-lead-sidebar-value">{formatFullTime(conv.first_message_sent_at)}</span>

          <div className="ia-lead-sidebar-label" style={{ marginTop: 8 }}>Ultimo msg lead</div>
          <span className="ia-lead-sidebar-value">{formatFullTime(conv.last_lead_message_at)}</span>

          <div className="ia-lead-sidebar-label" style={{ marginTop: 8 }}>Ventana 24h</div>
          <span className="ia-lead-sidebar-value">
            {conv.wa_window_expires_at
              ? new Date(conv.wa_window_expires_at) > new Date()
                ? `Abierta hasta ${formatFullTime(conv.wa_window_expires_at)}`
                : 'Cerrada (solo plantillas)'
              : '\u2013'}
          </span>
        </div>

        {/* Actions */}
        <div className="ia-lead-sidebar-section">
          <button
            className="ia-btn ia-btn-secondary ia-btn-sm ia-lead-sidebar-action"
            onClick={() => onToggleFavorite(conv.id, !conv.favorita)}
          >
            <Star size={14} fill={conv.favorita ? 'var(--warning, #ffa94d)' : 'none'} stroke={conv.favorita ? 'var(--warning, #ffa94d)' : 'currentColor'} />
            {conv.favorita ? 'Quitar favorita' : 'Marcar favorita'}
          </button>

          {/* Assign */}
          <div className="ia-lead-sidebar-assign">
            <div className="ia-lead-sidebar-label">Asignar a</div>
            <select
              className="ia-lead-sidebar-select"
              value={conv.asignado_a || ''}
              onChange={e => onAssign(conv.id, e.target.value || null)}
            >
              <option value="">Sin asignar</option>
              {(usuarios || []).map(u => (
                <option key={u.id} value={u.id}>{u.nombre || u.email}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Replies Dropdown ──────────────────────────
function QuickReplies({ agenteId, onSelect }) {
  const [respuestas, setRespuestas] = useState([])
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!agenteId || !open) return
    supabase
      .from('ia_respuestas_rapidas')
      .select('id, titulo, contenido')
      .eq('agente_id', agenteId)
      .order('orden')
      .then(({ data }) => {
        setRespuestas(data || [])
        setLoaded(true)
      })
  }, [agenteId, open])

  return (
    <div className="ia-quick-replies">
      <button
        type="button"
        className="ia-chat-mode-btn"
        onClick={() => setOpen(!open)}
        title="Respuestas rapidas"
      >
        <Zap size={14} />
      </button>
      {open && (
        <div className="ia-quick-replies-dropdown">
          {loaded && respuestas.length === 0 ? (
            <div className="ia-quick-replies-empty">Sin respuestas rapidas</div>
          ) : !loaded ? (
            <div className="ia-quick-replies-empty">Cargando...</div>
          ) : (
            respuestas.map(r => (
              <button
                key={r.id}
                className="ia-quick-reply-item"
                onClick={() => { onSelect(r.contenido); setOpen(false) }}
              >
                <span className="ia-quick-reply-title">{r.titulo}</span>
                <span className="ia-quick-reply-preview">{r.contenido.substring(0, 60)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Assign Dropdown ──────────────────────────────────
function AssignDropdown({ conv, usuarios, onAssign }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleSelect = (userId) => {
    onAssign(conv.id, userId || null)
    setOpen(false)
  }

  return (
    <div className="ia-assign-wrapper" ref={dropdownRef}>
      <button
        className="ia-btn ia-btn-secondary ia-btn-sm"
        onClick={() => setOpen(!open)}
        title="Asignar a equipo"
      >
        <UserPlus size={14} />
      </button>
      {open && (
        <div className="ia-assign-dropdown">
          <div className="ia-assign-dropdown-header">Asignar conversacion</div>
          <button
            className={`ia-assign-dropdown-item ${!conv.asignado_a ? 'active' : ''}`}
            onClick={() => handleSelect(null)}
          >
            <span className="ia-assign-dropdown-initials ia-assign-none">--</span>
            <span>Sin asignar</span>
          </button>
          {(usuarios || []).map(u => (
            <button
              key={u.id}
              className={`ia-assign-dropdown-item ${conv.asignado_a === u.id ? 'active' : ''}`}
              onClick={() => handleSelect(u.id)}
            >
              <span className="ia-assign-dropdown-initials">{getInitials(u.nombre || u.email)}</span>
              <span>{u.nombre || u.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── File Upload Button ──────────────────────────────
function FileUploadButton({ agenteId, conversacionId, onUploaded, disabled }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef(null)
  const { showToast } = useToast()

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input
    e.target.value = ''

    setUploading(true)
    setProgress(10)

    try {
      // Determine media type
      let mediaType = 'document'
      if (file.type.startsWith('image/')) mediaType = 'image'
      else if (file.type.startsWith('audio/')) mediaType = 'audio'
      else if (file.type.startsWith('video/')) mediaType = 'video'

      // Generate unique filename
      const ext = file.name.split('.').pop()
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
      const storagePath = `${agenteId}/${conversacionId}/${uniqueName}`

      setProgress(30)

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('ia-media')
        .upload(storagePath, file, { contentType: file.type })

      if (error) throw new Error(`Error subiendo archivo: ${error.message}`)

      setProgress(70)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('ia-media')
        .getPublicUrl(storagePath)

      setProgress(90)

      onUploaded(publicUrl, mediaType, file.name)
      setProgress(100)
      showToast('Archivo subido correctamente', 'success')
    } catch (err) {
      console.error('Error uploading file:', err)
      showToast(err.message || 'Error subiendo archivo', 'error')
    } finally {
      setTimeout(() => {
        setUploading(false)
        setProgress(0)
      }, 500)
    }
  }

  return (
    <div className="ia-file-upload-wrapper">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        className="ia-chat-mode-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        title="Adjuntar archivo"
      >
        {uploading ? (
          <div className="ia-file-upload-progress">
            <div className="ia-file-upload-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        ) : (
          <Paperclip size={14} />
        )}
      </button>
    </div>
  )
}

// ─── Conversation List ───────────────────────────────
function getAvatarColor(nombre) {
  if (!nombre) return '#6b7280'
  const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#6366f1', '#ef4444', '#14b8a6', '#f59e0b', '#a855f7']
  let hash = 0
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function ConversationItem({ conv, isActive, onClick, usuarios }) {
  const lead = conv.lead || {}
  const nombre = lead.nombre || lead.telefono || 'Desconocido'
  const sentimiento = SENTIMIENTO_CONFIG[lead.sentimiento_actual]
  const SentIcon = sentimiento?.icon
  const avatarColor = getAvatarColor(nombre)

  // Find assigned user
  const asignado = conv.asignado_a
    ? (usuarios || []).find(u => u.id === conv.asignado_a)
    : null

  // Last message preview
  const lastMsg = conv.ultimo_mensaje || conv.last_message_preview || ''

  return (
    <div
      className={`ia-inbox-item ${isActive ? 'active' : ''} ${!conv.leida ? 'unread' : ''}`}
      onClick={onClick}
    >
      <div className="ia-inbox-item-avatar" style={{ background: `${avatarColor}22`, color: avatarColor }}>
        {getInitials(nombre)}
        {conv.handoff_humano && <span className="ia-inbox-avatar-badge ia-badge-humano" title="Modo humano" />}
        {!conv.handoff_humano && conv.chatbot_activo && <span className="ia-inbox-avatar-badge ia-badge-bot" title="Bot activo" />}
      </div>
      <div className="ia-inbox-item-body">
        <div className="ia-inbox-item-top">
          <span className="ia-inbox-item-name">{nombre}</span>
          <span className={`ia-inbox-item-time ${!conv.leida ? 'unread' : ''}`}>{formatTime(conv.updated_at)}</span>
        </div>
        <div className="ia-inbox-item-preview">
          {lastMsg ? (
            <span className="ia-inbox-item-preview-text">{lastMsg}</span>
          ) : (
            <span
              className="ia-inbox-item-estado"
              style={{ color: ESTADO_COLORS[conv.estado] }}
            >
              {ESTADO_LABELS[conv.estado] || conv.estado}
            </span>
          )}
          <div className="ia-inbox-item-badges">
            {!conv.leida && <span className="ia-inbox-unread-dot" />}
            {conv.favorita && <Star size={12} fill="var(--warning, #ffa94d)" stroke="var(--warning, #ffa94d)" />}
            {lead.lead_score != null && lead.lead_score > 0 && (
              <span className="ia-inbox-item-score" style={{ color: getScoreColor(lead.lead_score) }}>{lead.lead_score}</span>
            )}
          </div>
        </div>
        {(SentIcon || asignado) && (
          <div className="ia-inbox-item-meta">
            {SentIcon && (
              <span className="ia-inbox-item-sentimiento" style={{ color: sentimiento.color }}>
                <SentIcon size={10} /> {sentimiento.text}
              </span>
            )}
            {asignado && (
              <span className="ia-inbox-item-assigned" title={asignado.nombre || asignado.email}>
                {getInitials(asignado.nombre || asignado.email)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chat Panel ───────────────────────────────────────
function ChatPanel({ conv, mensajes, loading, sending, onSend, onNote, onToggleChatbot, onShowSidebar, onAssign, agenteId, usuarios, onSendMedia }) {
  const [texto, setTexto] = useState('')
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const prevMensajesLen = useRef(0)
  const inputRef = useRef(null)
  const { showToast } = useToast()

  useEffect(() => {
    if (!mensajes.length) return
    // Only smooth scroll when new messages are added, instant on full reload
    const isNewMessage = mensajes.length > prevMensajesLen.current && prevMensajesLen.current > 0
    messagesEndRef.current?.scrollIntoView({ behavior: isNewMessage ? 'smooth' : 'instant' })
    prevMensajesLen.current = mensajes.length
  }, [mensajes])

  useEffect(() => {
    inputRef.current?.focus()
  }, [conv?.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!texto.trim() || sending) return
    try {
      await onSend(texto)
      setTexto('')
    } catch {
      // Error handled upstream
    }
  }

  const lead = conv?.lead || {}

  const groupedMessages = useMemo(() => {
    const groups = []
    let currentDate = ''
    for (const msg of mensajes) {
      const date = new Date(msg.created_at).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
      })
      if (date !== currentDate) {
        currentDate = date
        groups.push({ type: 'date', date })
      }
      groups.push({ type: 'msg', msg })
    }
    return groups
  }, [mensajes])

  if (!conv) {
    return (
      <div className="ia-chat-empty">
        <div className="ia-chat-empty-icon">
          <MessageSquare size={56} strokeWidth={1} />
        </div>
        <h3>Selecciona una conversacion</h3>
        <p>Elige un lead de la lista para ver sus mensajes</p>
      </div>
    )
  }

  return (
    <div className="ia-chat-panel">
      {/* Header */}
      <div className="ia-chat-header">
        <div className="ia-chat-header-info">
          <div className="ia-chat-header-avatar" style={{ background: `${getAvatarColor(lead.nombre || lead.telefono)}22`, color: getAvatarColor(lead.nombre || lead.telefono) }}>
            {getInitials(lead.nombre || lead.telefono || 'L')}
          </div>
          <div className="ia-chat-header-text">
            <span className="ia-chat-header-name">{lead.nombre || lead.telefono || 'Lead'}</span>
            <div className="ia-chat-header-meta">
              {lead.telefono && (
                <span><Phone size={11} /> {lead.telefono}</span>
              )}
              <span
                className="ia-chat-estado-badge"
                style={{ color: ESTADO_COLORS[conv.estado], borderColor: ESTADO_COLORS[conv.estado] }}
              >
                {ESTADO_LABELS[conv.estado] || conv.estado}
              </span>
              {lead.lead_score != null && (
                <span className="ia-chat-score" style={{ color: getScoreColor(lead.lead_score) }}>Score: {lead.lead_score}</span>
              )}
            </div>
          </div>
        </div>
        <div className="ia-chat-header-actions">
          <button
            className={`ia-btn ia-btn-secondary ia-btn-sm ${conv.chatbot_activo ? '' : 'ia-chatbot-off'}`}
            onClick={() => onToggleChatbot(conv.id, !conv.chatbot_activo)}
            title={conv.chatbot_activo ? 'Bot activo -- click para desactivar' : 'Bot desactivado -- click para activar'}
          >
            <Bot size={14} />
            {conv.chatbot_activo ? 'Bot ON' : 'Bot OFF'}
          </button>
          <AssignDropdown conv={conv} usuarios={usuarios} onAssign={onAssign} />
          <button
            className="ia-btn ia-btn-secondary ia-btn-sm"
            onClick={onShowSidebar}
            title="Ver detalle del lead"
          >
            <Info size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ia-chat-messages">
        {loading ? (
          <div className="ia-loading" style={{ padding: 40 }}>
            <div className="ia-spinner" />
          </div>
        ) : (
          <>
            {groupedMessages.map((item, i) => {
              if (item.type === 'date') {
                return (
                  <div key={`date-${i}`} className="ia-chat-date-separator">
                    <span>{item.date}</span>
                  </div>
                )
              }
              const msg = item.msg
              const isOutbound = msg.direction === 'outbound'
              const isNote = msg.message_type === 'nota_interna'
              const isBot = msg.sender === 'bot'

              return (
                <div
                  key={msg.id}
                  className={`ia-chat-msg ${isOutbound ? 'outbound' : 'inbound'} ${isNote ? 'note' : ''}`}
                >
                  {isNote && (
                    <div className="ia-chat-msg-note-label">
                      <StickyNote size={10} /> Nota interna
                    </div>
                  )}
                  <div className="ia-chat-msg-bubble">
                    {isOutbound && !isNote && (
                      <span className="ia-chat-msg-sender">
                        {isBot ? <><Bot size={10} /> Bot</> : <><User size={10} /> Humano</>}
                      </span>
                    )}
                    {msg.message_type !== 'text' && msg.message_type !== 'nota_interna' && (
                      <div className="ia-chat-msg-media-label">
                        <MessageTypeIcon type={msg.message_type} />
                        {msg.message_type === 'audio' && ' Audio'}
                        {msg.message_type === 'image' && ' Imagen'}
                        {msg.message_type === 'video' && ' Video'}
                        {msg.message_type === 'document' && ' Documento'}
                        {msg.message_type === 'sticker' && ' Sticker'}
                      </div>
                    )}
                    {msg.media_url && (
                      (msg.message_type === 'image' || msg.message_type === 'sticker') ? (
                        <img src={msg.media_url} alt="" className="ia-chat-msg-image" />
                      ) : msg.message_type === 'audio' ? (
                        <audio src={msg.media_url} controls className="ia-chat-msg-audio" />
                      ) : msg.message_type === 'video' ? (
                        <video src={msg.media_url} controls className="ia-chat-msg-video" />
                      ) : null
                    )}
                    {msg.transcription && (
                      <div className="ia-chat-msg-transcription">
                        <em>Transcripcion: {msg.transcription}</em>
                      </div>
                    )}
                    <div className="ia-chat-msg-content">{msg.content}</div>
                    <div className="ia-chat-msg-footer">
                      <span className="ia-chat-msg-time">
                        {new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOutbound && <WaStatus status={msg.wa_status} />}
                      {msg.calidad_score != null && (
                        <span className="ia-chat-msg-quality" title="Calidad IA">
                          {msg.calidad_score}/10
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form className="ia-chat-input" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Enviar mensaje como humano..."
          disabled={sending}
          className="ia-chat-input-field"
        />
        <button
          type="submit"
          className="ia-chat-send-btn"
          disabled={!texto.trim() || sending}
        >
          {sending ? <Clock size={18} /> : <Send size={18} />}
        </button>
      </form>
    </div>
  )
}

// ─── Main Tab Component ──────────────────────────────
export default function TabConversaciones({ agenteId }) {
  const {
    conversaciones,
    conversacionActiva,
    mensajes,
    loading,
    loadingMensajes,
    sending,
    filtro,
    busqueda,
    setFiltro,
    setBusqueda,
    seleccionarConversacion,
    enviarMensaje,
    enviarMensajeConMedia,
    agregarNota,
    toggleChatbot,
  } = useConversacionesIA(agenteId)

  const { showToast } = useToast()
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [usuarios, setUsuarios] = useState([])

  // Load team members for assignment
  useEffect(() => {
    supabase
      .from('usuarios')
      .select('id, nombre, email')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setUsuarios(data || []))
  }, [])

  const handleSelectConv = (conv) => {
    seleccionarConversacion(conv)
    setMobileShowChat(true)
  }

  const handleBack = () => {
    setMobileShowChat(false)
    seleccionarConversacion(null)
  }

  const handleSend = async (texto) => {
    const result = await enviarMensaje(texto)
    if (result && !result.ok) {
      showToast(result.error || 'Error enviando mensaje', 'error')
    }
  }

  const handleSendMedia = async (texto, mediaUrl, mediaType) => {
    const result = await enviarMensajeConMedia(texto, mediaUrl, mediaType)
    if (result && !result.ok) {
      showToast(result.error || 'Error enviando media', 'error')
    }
  }

  const handleNote = async (texto) => {
    try {
      await agregarNota(texto)
      showToast('Nota agregada', 'success')
    } catch (err) {
      showToast('Error agregando nota', 'error')
      throw err
    }
  }

  const handleToggleChatbot = async (id, activo) => {
    try {
      await toggleChatbot(id, activo)
      showToast(activo ? 'Bot reactivado' : 'Bot desactivado -- modo humano', 'info')
    } catch {
      showToast('Error cambiando modo', 'error')
    }
  }

  const handleToggleFavorite = useCallback(async (convId, favorita) => {
    const { error } = await supabase
      .from('ia_conversaciones')
      .update({ favorita })
      .eq('id', convId)
    if (error) {
      showToast('Error actualizando favorita', 'error')
      return
    }
    showToast(favorita ? 'Conversacion marcada como favorita' : 'Favorita quitada', 'success')
  }, [showToast])

  const handleAssign = useCallback(async (convId, userId) => {
    const { error } = await supabase
      .from('ia_conversaciones')
      .update({ asignado_a: userId })
      .eq('id', convId)
    if (error) {
      showToast('Error asignando conversacion', 'error')
      return
    }
    const userName = userId
      ? (usuarios.find(u => u.id === userId)?.nombre || 'usuario')
      : null
    showToast(userId ? `Asignada a ${userName}` : 'Asignacion quitada', 'success')
  }, [usuarios, showToast])

  const unreadCount = conversaciones.filter(c => !c.leida).length

  return (
    <div className={`ia-inbox ${mobileShowChat ? 'show-chat' : ''} ${showSidebar ? 'with-sidebar' : ''}`}>
      {/* Left: Conversation List */}
      <div className="ia-inbox-list">
        {/* Search */}
        <div className="ia-inbox-search">
          <Search size={14} />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o telefono..."
          />
        </div>

        {/* Filters */}
        <div className="ia-inbox-filters">
          {FILTROS.map(f => (
            <button
              key={f.id}
              className={`ia-inbox-filter ${filtro === f.id ? 'active' : ''}`}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}
              {f.id === 'sin_leer' && unreadCount > 0 && (
                <span className="ia-inbox-filter-count">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="ia-inbox-items">
          {loading ? (
            <div className="ia-loading" style={{ padding: 40 }}>
              <div className="ia-spinner" />
            </div>
          ) : conversaciones.length === 0 ? (
            <div className="ia-inbox-empty">
              <Filter size={24} strokeWidth={1} />
              <p>No hay conversaciones</p>
            </div>
          ) : (
            conversaciones.map(conv => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conversacionActiva?.id === conv.id}
                onClick={() => handleSelectConv(conv)}
                usuarios={usuarios}
              />
            ))
          )}
        </div>
      </div>

      {/* Center: Chat Panel */}
      <div className="ia-inbox-chat">
        {mobileShowChat && (
          <button className="ia-inbox-back-mobile" onClick={handleBack}>
            <ChevronLeft size={18} /> Volver
          </button>
        )}
        <ChatPanel
          conv={conversacionActiva}
          mensajes={mensajes}
          loading={loadingMensajes}
          sending={sending}
          onSend={handleSend}
          onSendMedia={handleSendMedia}
          onNote={handleNote}
          onToggleChatbot={handleToggleChatbot}
          onShowSidebar={() => setShowSidebar(!showSidebar)}
          onAssign={handleAssign}
          agenteId={agenteId}
          usuarios={usuarios}
        />
      </div>

      {/* Right: Lead Sidebar */}
      {showSidebar && conversacionActiva && (
        <LeadSidebar
          conv={conversacionActiva}
          onClose={() => setShowSidebar(false)}
          onToggleFavorite={handleToggleFavorite}
          onAssign={handleAssign}
          usuarios={usuarios}
        />
      )}
    </div>
  )
}
