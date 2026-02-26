import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function CRMLeadCard({ lead, etapa, showAssignee }) {
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

  const handleClick = (e) => {
    if (isDragging) return
    navigate(`/ventas/crm/lead/${lead.id}`)
  }

  const handleWhatsApp = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!lead.telefono) return
    const phone = lead.telefono.replace(/[^0-9+]/g, '')
    window.open(`https://wa.me/${phone}`, '_blank')
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
        {lead.telefono && (
          <button className="crm-card-wa" onClick={handleWhatsApp} title="WhatsApp">
            <WhatsAppIcon />
          </button>
        )}
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
          <span className="crm-card-avatar" title={assignee.nombre}>
            {getInitials(assignee.nombre)}
          </span>
        )}
      </div>
    </div>
  )
}
