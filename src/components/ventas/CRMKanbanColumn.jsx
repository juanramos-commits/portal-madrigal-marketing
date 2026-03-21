import { memo, useCallback, useMemo, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Inbox } from 'lucide-react'
import CRMLeadCard from './CRMLeadCard'

// PERF: memo prevents re-render of all columns when only one column's leads change
// NOTE: Virtualización descartada — dnd-kit SortableContext + closestCenter requiere que todos
// los items estén montados en el DOM para detección de colisiones. LEADS_PER_BATCH=20 ya limita
// la carga inicial; el caso típico (20-60 leads/columna) no justifica el riesgo de romper DnD.
export default memo(function CRMKanbanColumn({
  etapa,
  leads = [],
  count = 0,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  showAssignee = false,
  pipelineNombre,
  onMoverMobile,
  isDropTarget = false,
  isDragging = false,
}) {
  const { setNodeRef } = useDroppable({
    id: etapa.id,
    data: { type: 'column', etapaId: etapa.id },
  })

  const scrollRef = useRef(null)
  const scrollThrottleRef = useRef(false)
  const leadIds = useMemo(() => leads.map(l => l.id), [leads])

  const handleScroll = useCallback(() => {
    if (scrollThrottleRef.current) return
    scrollThrottleRef.current = true
    requestAnimationFrame(() => {
      scrollThrottleRef.current = false
      if (!hasMore || loadingMore || !scrollRef.current) return
      const el = scrollRef.current
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        onLoadMore?.(etapa.id)
      }
    })
  }, [hasMore, loadingMore, onLoadMore, etapa.id])

  return (
    <div className={`crm-column${isDropTarget ? ' drag-over' : ''}${isDragging ? ' drag-active' : ''}`} ref={setNodeRef} role="group" aria-label={`${etapa.nombre} — ${count} leads`} style={{ '--column-color': etapa.color || 'var(--text-muted)' }}>
      <div className="crm-column-header">
        <span className="crm-column-dot" style={{ background: etapa.color || 'var(--text-muted)' }} />
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
              pipelineNombre={pipelineNombre}
              onMoverMobile={onMoverMobile}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && !loadingMore && (
          <div className="crm-empty" role="status">
            <span className="crm-empty-icon"><Inbox /></span>
            Sin leads
          </div>
        )}

        {loadingMore && (
          <div className="crm-skeleton crm-skeleton-card" />
        )}

        {hasMore && !loadingMore && leads.length > 0 && (
          <div className="crm-load-more">
            <button onClick={() => onLoadMore?.(etapa.id)} aria-label={`Cargar más leads en ${etapa.nombre}`}>
              Cargar más
            </button>
          </div>
        )}
      </div>
    </div>
  )
})
