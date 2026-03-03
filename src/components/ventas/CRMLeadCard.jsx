import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft } from 'lucide-react'
import WhatsAppIcon from '../icons/WhatsAppIcon'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
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

export default function CRMLeadCard({ lead, etapa, showAssignee, onMoverMobile }) {
  const navigate = useNavigate()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: { type: 'lead', lead, etapaId: etapa?.id },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleClick = () => {
    if (isDragging) return
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
  const assignee = lead.setter || lead.closer

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`crm-card${isDragging ? ' dragging' : ''}`}
      onClick={handleClick}
    >
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
    </div>
  )
}
