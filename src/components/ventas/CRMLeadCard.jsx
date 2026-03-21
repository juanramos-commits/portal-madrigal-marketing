import { memo, useRef, useCallback, useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft } from 'lucide-react'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import { prefetchLeadDetail } from './CRMLeadDetalle'

function getInitials(name) {
  if (!name) return '?'
  const words = name.split(' ')
  if (words.length === 1) return name.slice(0, 2).toUpperCase()
  return words.map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function timeAgo(date) {
  if (!date) return ''
  const now = new Date()
  const d = new Date(date)
  const diffMs = now - d
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'hace 1 día'
  return `hace ${days} días`
}

function getAvatarColor(name) {
  if (!name) return 'var(--bg-active)'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 50%, 40%)`
}

// PERF: memo prevents re-render of all cards when sibling leads change or column state updates
export default memo(function CRMLeadCard({ lead, etapa, showAssignee, pipelineNombre, onMoverMobile, virtualize = false }) {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(!virtualize)
  const observerRef = useRef(null)
  const hoverTimer = useRef(null)

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: { type: 'lead', lead, etapaId: etapa?.id },
  })

  // Combined ref: attach sortable + IntersectionObserver when virtualizing
  const nodeRef = useCallback((node) => {
    setSortableRef(node)
    if (!virtualize) return
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (node) {
      const obs = new IntersectionObserver(
        ([entry]) => setIsVisible(entry.isIntersecting),
        { rootMargin: '300px 0px' }
      )
      obs.observe(node)
      observerRef.current = obs
    }
  }, [setSortableRef, virtualize])

  useEffect(() => () => {
    observerRef.current?.disconnect()
    clearTimeout(hoverTimer.current)
  }, [])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Off-screen placeholder — keeps useSortable active for dnd-kit, minimal DOM
  if (virtualize && !isVisible && !isDragging) {
    return (
      <div
        ref={nodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="crm-card crm-card-placeholder"
      />
    )
  }

  // Prefetch lead data on hover so detail page opens instantly
  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => prefetchLeadDetail(lead.id), 150)
  }
  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current)
  }

  const handleClick = () => {
    if (isDragging) return
    prefetchLeadDetail(lead.id)
    navigate(`/ventas/crm/lead/${lead.id}`)
  }

  const handleWhatsApp = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!lead.telefono) return
    const phone = lead.telefono.replace(/[^0-9+]/g, '')
    window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer')
  }

  const handleMoverMobile = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (onMoverMobile) onMoverMobile(lead, etapa)
  }

  const showAttempts = etapa && (etapa.tipo === 'ghosting' || etapa.tipo === 'seguimiento')
  const esCloserPipeline = pipelineNombre?.toLowerCase().includes('closer')
  const assignee = esCloserPipeline ? (lead.closer || lead.setter) : (lead.setter || lead.closer)
  const isHot = lead.lead_etiquetas?.some(le => le.etiqueta?.nombre === 'Hot Lead')

  return (
    <div
      ref={nodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`crm-card${isDragging ? ' dragging' : ''}${isHot ? ' crm-card-is-hot' : ''}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isHot && <span className="crm-card-hot" />}
      <div className="crm-card-top">
        <span className="crm-card-name">{lead.nombre}</span>
        <div className="crm-card-actions">
          {onMoverMobile && (
            <button
              className="crm-card-move"
              onClick={handleMoverMobile}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Mover a otra etapa"
            >
              <ArrowRightLeft />
            </button>
          )}
          {lead.telefono && (
            <button
              className="crm-card-wa"
              onClick={handleWhatsApp}
              onPointerDown={(e) => e.stopPropagation()}
              title="WhatsApp"
              aria-label="Enviar WhatsApp"
            >
              <WhatsAppIcon />
            </button>
          )}
        </div>
      </div>

      {lead.telefono && (
        <div className="crm-card-phone">{lead.telefono}</div>
      )}

      <div className="crm-card-bottom">
        {lead.categoria?.nombre && (
          <span className="crm-card-cat">{lead.categoria.nombre}</span>
        )}
        {showAttempts && lead.contador_intentos > 0 && (
          <span className="crm-card-attempts">
            {etapa.tipo === 'ghosting' && etapa.max_intentos
              ? `Intento ${lead.contador_intentos}/${etapa.max_intentos}`
              : `Seguimiento ${lead.contador_intentos}`
            }
          </span>
        )}
        {showAssignee && assignee && (
          <span className="crm-card-avatar" aria-label={assignee.nombre} style={{ background: getAvatarColor(assignee.nombre) }}>
            {getInitials(assignee.nombre)}
          </span>
        )}
      </div>
      {lead.created_at && (
        <div className="crm-card-date">{timeAgo(lead.created_at)}</div>
      )}
    </div>
  )
})
