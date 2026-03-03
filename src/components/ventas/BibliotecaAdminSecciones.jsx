import { useState } from 'react'
import ConfirmDialog from '../ui/ConfirmDialog'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const GripIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
    <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
  </svg>
)

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

function SortableSeccion({ seccion, recursosCount, onEditar, onEliminar }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: seccion.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="bib-admin-seccion-row">
      <button className="bib-drag-handle" {...attributes} {...listeners}>
        <GripIcon />
      </button>
      <div className="bib-admin-seccion-info">
        <span className="bib-admin-seccion-nombre">{seccion.nombre}</span>
        {seccion.descripcion && (
          <span className="bib-admin-seccion-desc">{seccion.descripcion}</span>
        )}
        <span className="bib-admin-seccion-count">{recursosCount} recursos</span>
      </div>
      <div className="bib-admin-seccion-actions">
        <button className="bib-btn-icon" onClick={() => onEditar(seccion)} title="Editar">
          <EditIcon />
        </button>
        <button className="bib-btn-icon-danger" onClick={() => onEliminar(seccion)} title="Eliminar">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

export default function BibliotecaAdminSecciones({
  secciones,
  recursos,
  onNueva,
  onEditar,
  onEliminar,
  onReordenar,
}) {
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = secciones.findIndex(s => s.id === active.id)
    const newIndex = secciones.findIndex(s => s.id === over.id)
    const nuevasIds = arrayMove(secciones.map(s => s.id), oldIndex, newIndex)
    onReordenar(nuevasIds)
  }

  const handleConfirmEliminar = async () => {
    if (!confirmEliminar) return
    setEliminando(true)
    setErrorEliminar(null)
    try {
      await onEliminar(confirmEliminar.id)
      setConfirmEliminar(null)
    } catch (e) {
      setErrorEliminar(e?.message || 'Error al eliminar la sección')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="bib-admin-secciones">
      <div className="bib-admin-header">
        <h3>Secciones</h3>
        <button className="bib-btn-sm" onClick={onNueva}>
          <PlusIcon /> Nueva sección
        </button>
      </div>

      {secciones.length === 0 ? (
        <div className="bib-empty-sm">No hay secciones creadas</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={secciones.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="bib-admin-secciones-list">
              {secciones.map(s => (
                <SortableSeccion
                  key={s.id}
                  seccion={s}
                  recursosCount={recursos.filter(r => r.seccion_id === s.id).length}
                  onEditar={onEditar}
                  onEliminar={setConfirmEliminar}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <ConfirmDialog
        open={!!confirmEliminar}
        title="Eliminar sección"
        message={<>¿Eliminar la sección <strong>{confirmEliminar?.nombre}</strong> y todos sus recursos?<br /><span className="bib-text-muted">Esta acción no se puede deshacer.</span>{errorEliminar && <><br /><span className="bib-confirm-error">{errorEliminar}</span></>}</>}
        variant="danger"
        confirmText="Eliminar"
        loading={eliminando}
        onConfirm={handleConfirmEliminar}
        onCancel={() => { setConfirmEliminar(null); setErrorEliminar(null) }}
      />
    </div>
  )
}
