import { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import CRMKanbanColumn from './CRMKanbanColumn'
import CRMLeadCard from './CRMLeadCard'
import CRMBottomSheetMover from './CRMBottomSheetMover'

export default function CRMKanban({
  etapas = [],
  leads,
  leadCounts,
  hasMore = {},
  loadingMore = {},
  onLoadMore,
  onMoverLead,
  showAssignee,
  loading,
  onError,
  canMove = true,
}) {
  const [activeLead, setActiveLead] = useState(null)
  const [activeEtapa, setActiveEtapa] = useState(null)
  const [moverSheetData, setMoverSheetData] = useState(null)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleMoverMobile = useCallback((lead, etapa) => {
    setMoverSheetData({ lead, etapa })
  }, [])

  const handleSheetMover = useCallback(async (leadId, from, to) => {
    try {
      await onMoverLead(leadId, from, to)
    } catch (err) {
      onError?.(err.message || 'Error al mover el lead')
    }
  }, [onMoverLead, onError])

  const activeSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )
  const noSensors = useSensors()
  const sensors = canMove ? activeSensors : noSensors

  const findLeadEtapa = useCallback((leadId) => {
    for (const etapa of etapas) {
      const found = (leads[etapa.id] || []).find(l => l.id === leadId)
      if (found) return { lead: found, etapaId: etapa.id }
    }
    return null
  }, [etapas, leads])

  const handleDragStart = useCallback((event) => {
    const { active } = event
    const result = findLeadEtapa(active.id)
    if (result) {
      setActiveLead(result.lead)
      setActiveEtapa(etapas.find(e => e.id === result.etapaId))
    }
  }, [findLeadEtapa, etapas])

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event
    setActiveLead(null)
    setActiveEtapa(null)

    if (!over) return

    const result = findLeadEtapa(active.id)
    if (!result) return

    // Determine target column
    let targetEtapaId = null

    // Dropped on a column
    if (etapas.find(e => e.id === over.id)) {
      targetEtapaId = over.id
    }
    // Dropped on a lead card — find which column it belongs to
    else {
      const overResult = findLeadEtapa(over.id)
      if (overResult) {
        targetEtapaId = overResult.etapaId
      }
    }

    if (!targetEtapaId || targetEtapaId === result.etapaId) return

    try {
      await onMoverLead(active.id, result.etapaId, targetEtapaId)
    } catch (err) {
      onError?.(err.message || 'Error al mover el lead')
    }
  }, [findLeadEtapa, etapas, onMoverLead, onError])

  const handleDragCancel = useCallback(() => {
    setActiveLead(null)
    setActiveEtapa(null)
  }, [])

  if (loading) {
    return (
      <div className="crm-kanban" aria-busy="true" aria-label="Cargando tablero">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="crm-column">
            <div className="crm-column-header">
              <span className="crm-skeleton crm-skeleton-dot" />
              <span className="crm-skeleton crm-skeleton-title" />
            </div>
            <div className="crm-column-body">
              {[1, 2, 3].map(j => (
                <div key={j} className="crm-skeleton crm-skeleton-card" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="crm-kanban">
        {etapas.map(etapa => (
          <CRMKanbanColumn
            key={etapa.id}
            etapa={etapa}
            leads={leads[etapa.id] || []}
            count={leadCounts[etapa.id] || 0}
            hasMore={hasMore[etapa.id]}
            loadingMore={loadingMore[etapa.id]}
            onLoadMore={onLoadMore}
            showAssignee={showAssignee}
            onMoverMobile={isMobile && canMove ? handleMoverMobile : undefined}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="crm-drag-overlay" aria-hidden="true" style={{ width: 268, '--column-color': activeEtapa?.color }}>
            <CRMLeadCard
              lead={activeLead}
              etapa={activeEtapa}
              showAssignee={showAssignee}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>

    {moverSheetData && (
      <CRMBottomSheetMover
        lead={moverSheetData.lead}
        etapaActual={moverSheetData.etapa}
        etapas={etapas}
        onMover={handleSheetMover}
        onCerrar={() => setMoverSheetData(null)}
      />
    )}
    </>
  )
}
