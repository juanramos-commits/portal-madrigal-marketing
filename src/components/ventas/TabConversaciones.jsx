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
  AlertTriangle, Heart, Flame
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

const SENTIMIENTO_ICONS = {
  positivo: { icon: Smile, color: 'var(--success, #2ee59d)' },
  interesado: { icon: Heart, color: '#ec4899' },
  urgente: { icon: Flame, color: '#f97316' },
  neutro: { icon: Meh, color: 'var(--text-secondary)' },
  negativo: { icon: Frown, color: 'var(--error)' },
  frustrado: { icon: AlertTriangle, color: 'var(--error)' },
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

// ─── Lead Sidebar Panel ──────────────────────────────
function LeadSidebar({ conv, onClose, onToggleFavorite, onAssign, usuarios }) {
  const lead = conv?.lead || {}
  const sentimiento = SENTIMIENTO_ICONS[lead.sentimiento_actual] || SENTIMIENTO_ICONS.neutro
  const SentimientoIcon = sentimiento.icon

  return (
    <div className="ia-lead-sidebar">
      <div className="ia-lead-sidebar-header">
        <span className="ia-lead-sidebar-title">Detalle del lead</span>
        <button className="ia-lead-sidebar-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="ia-lead-sidebar-content">
        {/* Contact info */}
        <div className="ia-lead-sidebar-section">
          <div className="ia-lead-sidebar-name">{lead.nombre || 'Sin nombre'}</div>
          {lead.telefono && (
            <div className="ia-lead-sidebar-row">
              <Phone size={12} /> {lead.telefono}
            </div>
          )}
          {lead.email && (
            <div className="ia-lead-sidebar-row">
              <Mail size={12} /> {lead.email}
            </div>
          )}
        </div>

        {/* Score & Sentiment */}
        <div className="ia-lead-sidebar-section">
          <div className="ia-lead-sidebar-label">Lead Score</div>
          <div className="ia-lead-sidebar-score-bar">
            <div
              className="ia-lead-sidebar-score-fill"
              style={{ width: `${lead.lead_score || 0}%` }}
            />
            <span className="ia-lead-sidebar-score-text">{lead.lead_score ?? '–'}/100</span>
          </div>

          <div className="ia-lead-sidebar-label" style={{ marginTop: 12 }}>Sentimiento</div>
          <div className="ia-lead-sidebar-sentiment" style={{ color: sentimiento.color }}>
            <SentimientoIcon size={16} />
            {lead.sentimiento_actual || 'neutro'}
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
          <span className="ia-lead-sidebar-value">{conv.step || '–'}</span>

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

        {/* Timestamps */}
        <div className="ia-lead-sidebar-section">
          <div className="ia-lead-sidebar-label">Primer mensaje</div>
          <span className="ia-lead-sidebar-value">{formatFullTime(conv.first_message_sent_at)}</span>

          <div className="ia-lead-sidebar-label" style={{ marginTop: 8 }}>Último msg lead</div>
          <span className="ia-lead-sidebar-value">{formatFullTime(conv.last_lead_message_at)}</span>

          <div className="ia-lead-sidebar-label" style={{ marginTop: 8 }}>Ventana 24h</div>
          <span className="ia-lead-sidebar-value">
            {conv.wa_window_expires_at
              ? new Date(conv.wa_window_expires_at) > new Date()
                ? `Abierta hasta ${formatFullTime(conv.wa_window_expires_at)}`
                : 'Cerrada (solo plantillas)'
              : '–'}
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

  useEffect(() => {
    if (!agenteId || !open) return
    supabase
      .from('ia_respuestas_rapidas')
      .select('id, titulo, contenido')
      .eq('agente_id', agenteId)
      .order('titulo')
      .then(({ data }) => setRespuestas(data || []))
  }, [agenteId, open])

  if (respuestas.length === 0 && !open) return null

  return (
    <div className="ia-quick-replies">
      <button
        type="button"
        className="ia-chat-mode-btn"
        onClick={() => setOpen(!open)}
        title="Respuestas rápidas"
      >
        <Zap size={14} />
      </button>
      {open && (
        <div className="ia-quick-replies-dropdown">
          {respuestas.length === 0 ? (
            <div className="ia-quick-replies-empty">Sin respuestas rápidas</div>
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

// ─── Conversation List ───────────────────────────────
function ConversationItem({ conv, isActive, onClick }) {
  const lead = conv.lead || {}
  const nombre = lead.nombre || lead.telefono || 'Desconocido'
  const sentimiento = SENTIMIENTO_ICONS[lead.sentimiento_actual]
  const SentIcon = sentimiento?.icon

  return (
    <div
      className={`ia-inbox-item ${isActive ? 'active' : ''} ${!conv.leida ? 'unread' : ''}`}
      onClick={onClick}
    >
      <div className="ia-inbox-item-avatar">
        {conv.handoff_humano ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className="ia-inbox-item-body">
        <div className="ia-inbox-item-top">
          <span className="ia-inbox-item-name">{nombre}</span>
          <span className="ia-inbox-item-time">{formatTime(conv.updated_at)}</span>
        </div>
        <div className="ia-inbox-item-bottom">
          <span
            className="ia-inbox-item-estado"
            style={{ color: ESTADO_COLORS[conv.estado] }}
          >
            {ESTADO_LABELS[conv.estado] || conv.estado}
          </span>
          {SentIcon && <SentIcon size={10} style={{ color: sentimiento.color }} />}
          {lead.lead_score != null && lead.lead_score > 0 && (
            <span className="ia-inbox-item-score">{lead.lead_score}</span>
          )}
          {!conv.leida && <span className="ia-inbox-unread-dot" />}
          {conv.favorita && <Star size={10} fill="var(--warning, #ffa94d)" stroke="var(--warning, #ffa94d)" />}
        </div>
      </div>
    </div>
  )
}

// ─── Chat Panel ───────────────────────────────────────
function ChatPanel({ conv, mensajes, loading, sending, onSend, onNote, onToggleChatbot, onShowSidebar, agenteId }) {
  const [texto, setTexto] = useState('')
  const [modo, setModo] = useState('mensaje') // 'mensaje' | 'nota'
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  useEffect(() => {
    inputRef.current?.focus()
  }, [conv?.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!texto.trim() || sending) return
    try {
      if (modo === 'nota') {
        await onNote(texto)
      } else {
        await onSend(texto)
      }
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
        <MessageSquare size={48} strokeWidth={1} />
        <p>Selecciona una conversación</p>
      </div>
    )
  }

  return (
    <div className="ia-chat-panel">
      {/* Header */}
      <div className="ia-chat-header">
        <div className="ia-chat-header-info">
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
              <span className="ia-chat-score">Score: {lead.lead_score}</span>
            )}
          </div>
        </div>
        <div className="ia-chat-header-actions">
          <button
            className={`ia-btn ia-btn-secondary ia-btn-sm ${conv.chatbot_activo ? '' : 'ia-chatbot-off'}`}
            onClick={() => onToggleChatbot(conv.id, !conv.chatbot_activo)}
            title={conv.chatbot_activo ? 'Bot activo — click para desactivar' : 'Bot desactivado — click para activar'}
          >
            <Bot size={14} />
            {conv.chatbot_activo ? 'Bot ON' : 'Bot OFF'}
          </button>
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
                        <em>Transcripción: {msg.transcription}</em>
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
        <div className="ia-chat-input-mode">
          <button
            type="button"
            className={`ia-chat-mode-btn ${modo === 'mensaje' ? 'active' : ''}`}
            onClick={() => setModo('mensaje')}
            title="Enviar mensaje por WhatsApp"
          >
            <Send size={14} />
          </button>
          <button
            type="button"
            className={`ia-chat-mode-btn ${modo === 'nota' ? 'active' : ''}`}
            onClick={() => setModo('nota')}
            title="Agregar nota interna"
          >
            <StickyNote size={14} />
          </button>
          <QuickReplies agenteId={agenteId} onSelect={setTexto} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={modo === 'nota' ? 'Escribir nota interna...' : 'Enviar mensaje como humano...'}
          disabled={sending}
          className="ia-chat-input-field"
        />
        <button
          type="submit"
          className="ia-btn ia-btn-primary ia-btn-sm"
          disabled={!texto.trim() || sending}
        >
          {sending ? <Clock size={14} /> : modo === 'nota' ? <StickyNote size={14} /> : <Send size={14} />}
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
    try {
      await enviarMensaje(texto)
    } catch (err) {
      showToast(err.message || 'Error enviando mensaje', 'error')
      throw err
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
      showToast(activo ? 'Bot reactivado' : 'Bot desactivado — modo humano', 'info')
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
    showToast(favorita ? 'Conversación marcada como favorita' : 'Favorita quitada', 'success')
  }, [showToast])

  const handleAssign = useCallback(async (convId, userId) => {
    const { error } = await supabase
      .from('ia_conversaciones')
      .update({ asignado_a: userId })
      .eq('id', convId)
    if (error) {
      showToast('Error asignando conversación', 'error')
      return
    }
    const userName = userId
      ? (usuarios.find(u => u.id === userId)?.nombre || 'usuario')
      : null
    showToast(userId ? `Asignada a ${userName}` : 'Asignación quitada', 'success')
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
            placeholder="Buscar por nombre o teléfono..."
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
          onNote={handleNote}
          onToggleChatbot={handleToggleChatbot}
          onShowSidebar={() => setShowSidebar(!showSidebar)}
          agenteId={agenteId}
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
