import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useCallback, useRef } from 'react'
import CRMLeadCard from './CRMLeadCard'

export default function CRMKanbanColumn({
  etapa,
  leads = [],
  count = 0,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  showAssignee = false,
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: etapa.id,
    data: { type: 'column', etapaId: etapa.id },
  })

  const scrollRef = useRef(null)
  const leadIds = leads.map(l => l.id)

  const handleScroll = useCallback(() => {
    if (!hasMore || loadingMore || !scrollRef.current) return
    const el = scrollRef.current
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      onLoadMore?.(etapa.id)
    }
  }, [hasMore, loadingMore, onLoadMore, etapa.id])

  return (
    <div className={`crm-column${isOver ? ' drag-over' : ''}`} ref={setNodeRef}>
      <div className="crm-column-header">
        <span className="crm-column-dot" style={{ background: etapa.color || '#6B7280' }} />
        <span className="crm-column-name">{etapa.nombre}</span>
        <span className="crm-column-count">{count}</span>
      </div>

      <div className="crm-column-body" ref={scrollRef} onScroll={handleScroll}>
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <CRMLeadCard
              key={lead.id}
              lead={lead}
              etapa={etapa}
              showAssignee={showAssignee}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && !loadingMore && (
          <div className="crm-empty">Sin leads</div>
        )}

        {loadingMore && (
          <div className="crm-skeleton crm-skeleton-card" />
        )}

        {hasMore && !loadingMore && leads.length > 0 && (
          <div className="crm-load-more">
            <button onClick={() => onLoadMore?.(etapa.id)}>
              Cargar más
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
