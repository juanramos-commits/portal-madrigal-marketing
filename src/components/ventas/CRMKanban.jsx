import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  rectIntersection,
} from '@dnd-kit/core'
import CRMKanbanColumn from './CRMKanbanColumn'
import CRMLeadCard from './CRMLeadCard'
import CRMBottomSheetMover from './CRMBottomSheetMover'

// ── Custom collision detection for kanban boards ──────────────────────
// closestCenter fails in horizontal kanbans because it matches elements
// across ALL columns by geometric distance. This algorithm:
// 1. Finds which column the pointer is physically inside (horizontal axis)
// 2. Within that column, finds the closest card (vertical axis)
// Result: drops always land in the column under the cursor.
function kanbanCollisionDetection(args) {
  const { droppableRects, droppableContainers, pointerCoordinates } = args

  if (!pointerCoordinates) {
    return closestCenter(args)
  }

  // Step 1: Find the column whose horizontal bounds contain the pointer
  let targetColumn = null
  let closestColumnDist = Infinity

  for (const container of droppableContainers) {
    if (container.data?.current?.type !== 'column') continue
    const rect = droppableRects.get(container.id)
    if (!rect) continue

    // Pointer is inside this column's horizontal range
    if (pointerCoordinates.x >= rect.left && pointerCoordinates.x <= rect.right) {
      targetColumn = container
      break
    }

    // Track closest column as fallback (when pointer is between columns)
    const centerX = rect.left + rect.width / 2
    const dist = Math.abs(pointerCoordinates.x - centerX)
    if (dist < closestColumnDist) {
      closestColumnDist = dist
      targetColumn = container
    }
  }

  if (!targetColumn) {
    return rectIntersection(args)
  }

  // Step 2: Within that column, find the closest card by vertical distance
  let closestCard = null
  let closestCardDist = Infinity

  for (const container of droppableContainers) {
    if (container.data?.current?.type !== 'lead') continue
    if (container.data?.current?.etapaId !== targetColumn.id) continue
    const rect = droppableRects.get(container.id)
    if (!rect) continue

    const centerY = rect.top + rect.height / 2
    const dist = Math.abs(pointerCoordinates.y - centerY)
    if (dist < closestCardDist) {
      closestCardDist = dist
      closestCard = container
    }
  }

  if (closestCard) {
    return [{ id: closestCard.id }]
  }

  // Empty column — return the column itself
  return [{ id: targetColumn.id }]
}

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
  const [overColumnId, setOverColumnId] = useState(null)
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
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

  const etapaIdSet = useMemo(() => new Set(etapas.map(e => e.id)), [etapas])

  const handleDragStart = useCallback((event) => {
    const { active } = event
    const result = findLeadEtapa(active.id)
    if (result) {
      setActiveLead(result.lead)
      setActiveEtapa(etapas.find(e => e.id === result.etapaId))
    }
  }, [findLeadEtapa, etapas])

  // Track which column the dragged card is over (for visual highlight)
  const handleDragOver = useCallback((event) => {
    const { over } = event
    if (!over) {
      setOverColumnId(null)
      return
    }
    // Over a column directly
    if (etapaIdSet.has(over.id)) {
      setOverColumnId(over.id)
      return
    }
    // Over a card — resolve its column
    const overData = over.data?.current
    if (overData?.etapaId) {
      setOverColumnId(overData.etapaId)
    }
  }, [etapaIdSet])

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event
    setActiveLead(null)
    setActiveEtapa(null)
    setOverColumnId(null)

    if (!over) return

    const result = findLeadEtapa(active.id)
    if (!result) return

    // Determine target column and drop index
    let targetEtapaId = null
    let dropIndex = 0

    // Dropped on a column directly
    if (etapaIdSet.has(over.id)) {
      targetEtapaId = over.id
      dropIndex = (leads[over.id] || []).length // append at end
    }
    // Dropped on a lead card — find which column and position
    else {
      const overData = over.data?.current
      if (overData?.etapaId) {
        targetEtapaId = overData.etapaId
        const columnLeads = leads[overData.etapaId] || []
        const overIndex = columnLeads.findIndex(l => l.id === over.id)
        dropIndex = overIndex >= 0 ? overIndex : columnLeads.length
      }
    }

    if (!targetEtapaId || targetEtapaId === result.etapaId) return

    try {
      await onMoverLead(active.id, result.etapaId, targetEtapaId, dropIndex)
    } catch (err) {
      onError?.(err.message || 'Error al mover el lead')
    }
  }, [findLeadEtapa, etapaIdSet, leads, onMoverLead, onError])

  const handleDragCancel = useCallback(() => {
    setActiveLead(null)
    setActiveEtapa(null)
    setOverColumnId(null)
  }, [])

  // Stable empty array reference — prevents React.memo bypass on CRMKanbanColumn
  const EMPTY_LEADS = useMemo(() => [], [])

  // Cache column structure for intelligent skeletons
  const structureSaved = useRef(false)
  useEffect(() => {
    if (loading || etapas.length === 0 || structureSaved.current) return
    structureSaved.current = true
    try {
      const structure = etapas.map(e => ({
        nombre: e.nombre,
        color: e.color,
        count: Math.min((leads[e.id] || []).length, 6),
      }))
      sessionStorage.setItem('crm_skeleton', JSON.stringify(structure))
    } catch { /* ignore quota errors */ }
  }, [loading, etapas, leads])

  // FIX: only show skeleton if loading AND no data exists
  // When refreshing on tab switch, we have cached data — show it, don't flash skeleton
  const hasData = etapas.length > 0 && Object.keys(leads).some(k => (leads[k] || []).length > 0)
  if (loading && !hasData) {
    let skeleton = [1, 2, 3, 4].map(i => ({ nombre: null, color: null, count: 3 }))
    try {
      const cached = sessionStorage.getItem('crm_skeleton')
      if (cached) skeleton = JSON.parse(cached)
    } catch { /* use default */ }
    return (
      <div className="crm-kanban" aria-busy="true" aria-label="Cargando tablero">
        {skeleton.map((col, i) => (
          <div key={i} className="crm-column" style={col.color ? { '--column-color': col.color } : undefined}>
            <div className="crm-column-header">
              {col.nombre ? (
                <>
                  <span className="crm-column-dot" style={{ background: col.color || 'var(--text-muted)' }} />
                  <span className="crm-column-name">{col.nombre}</span>
                </>
              ) : (
                <>
                  <span className="crm-skeleton crm-skeleton-dot" />
                  <span className="crm-skeleton crm-skeleton-title" />
                </>
              )}
            </div>
            <div className="crm-column-body">
              {Array.from({ length: col.count || 3 }, (_, j) => (
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
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="crm-kanban">
        {etapas.map(etapa => (
          <CRMKanbanColumn
            key={etapa.id}
            etapa={etapa}
            leads={leads[etapa.id] || EMPTY_LEADS}
            count={leadCounts[etapa.id] || 0}
            hasMore={hasMore[etapa.id]}
            loadingMore={loadingMore[etapa.id]}
            onLoadMore={onLoadMore}
            showAssignee={showAssignee}
            onMoverMobile={isMobile && canMove ? handleMoverMobile : undefined}
            isDropTarget={overColumnId === etapa.id}
            isDragging={!!activeLead}
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
