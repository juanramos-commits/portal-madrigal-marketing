import { useState } from 'react'
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
import { TIPO_LABELS, ROL_BADGES } from './BibliotecaRecurso'

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

function SortableRecurso({ recurso, onEditar, onEliminar }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: recurso.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const tipo = recurso.tipo || 'otro'

  return (
    <div ref={setNodeRef} style={style} className="bib-admin-recurso-row">
      <button className="bib-drag-handle" {...attributes} {...listeners}>
        <GripIcon />
      </button>
      <div className="bib-admin-recurso-info">
        <div className="bib-admin-recurso-top">
          <span className="bib-admin-recurso-nombre">{recurso.nombre}</span>
          <span className="bib-admin-recurso-tipo">{TIPO_LABELS[tipo] || tipo}</span>
        </div>
        {recurso.url && (
          <span className="bib-admin-recurso-url">{recurso.url}</span>
        )}
        {recurso.visible_para && recurso.visible_para.length > 0 && (
          <div className="bib-admin-recurso-badges">
            {recurso.visible_para.map(rol => {
              const badge = ROL_BADGES[rol]
              if (!badge) return null
              return (
                <span key={rol} className={`bib-badge bib-badge-xs ${badge.className}`}>
                  {badge.label}
                </span>
              )
            })}
          </div>
        )}
      </div>
      <div className="bib-admin-recurso-actions">
        <button className="bib-btn-icon" onClick={() => onEditar(recurso)} title="Editar">
          <EditIcon />
        </button>
        <button className="bib-btn-icon-danger" onClick={() => onEliminar(recurso)} title="Eliminar">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

export default function BibliotecaAdminRecursos({
  secciones,
  recursos,
  onNuevo,
  onEditar,
  onEliminar,
  onReordenar,
}) {
  const [seccionActiva, setSeccionActiva] = useState(secciones[0]?.id || '')
  const [confirmEliminar, setConfirmEliminar] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const recursosSeccion = recursos.filter(r => r.seccion_id === seccionActiva)

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = recursosSeccion.findIndex(r => r.id === active.id)
    const newIndex = recursosSeccion.findIndex(r => r.id === over.id)
    const nuevasIds = arrayMove(recursosSeccion.map(r => r.id), oldIndex, newIndex)
    onReordenar(seccionActiva, nuevasIds)
  }

  const handleConfirmEliminar = async () => {
    if (!confirmEliminar) return
    try {
      await onEliminar(confirmEliminar.id)
    } catch (_) {
      // silently fail
    }
    setConfirmEliminar(null)
  }

  return (
    <div className="bib-admin-recursos">
      <div className="bib-admin-header">
        <h3>Recursos</h3>
        <button className="bib-btn-sm" onClick={() => onNuevo(seccionActiva)}>
          <PlusIcon /> Nuevo recurso
        </button>
      </div>

      {secciones.length === 0 ? (
        <div className="bib-empty-sm">Crea una sección primero</div>
      ) : (
        <>
          <div className="bib-admin-seccion-tabs">
            {secciones.map(s => (
              <button
                key={s.id}
                className={`bib-admin-seccion-tab${seccionActiva === s.id ? ' active' : ''}`}
                onClick={() => setSeccionActiva(s.id)}
              >
                {s.nombre}
                <span className="bib-admin-tab-count">
                  {recursos.filter(r => r.seccion_id === s.id).length}
                </span>
              </button>
            ))}
          </div>

          {recursosSeccion.length === 0 ? (
            <div className="bib-empty-sm">Sin recursos en esta sección</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={recursosSeccion.map(r => r.id)} strategy={verticalListSortingStrategy}>
                <div className="bib-admin-recursos-list">
                  {recursosSeccion.map(r => (
                    <SortableRecurso
                      key={r.id}
                      recurso={r}
                      onEditar={onEditar}
                      onEliminar={setConfirmEliminar}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      {confirmEliminar && (
        <>
          <div className="bib-modal-overlay" onClick={() => setConfirmEliminar(null)} />
          <div className="bib-modal bib-modal-sm">
            <div className="bib-modal-header">
              <h2>Eliminar recurso</h2>
            </div>
            <div className="bib-modal-body">
              <p>¿Eliminar el recurso <strong>{confirmEliminar.nombre}</strong>?</p>
              <p className="bib-text-muted">Esta acción no se puede deshacer.</p>
            </div>
            <div className="bib-modal-actions">
              <button className="bib-btn-ghost" onClick={() => setConfirmEliminar(null)}>Cancelar</button>
              <button className="bib-btn-danger" onClick={handleConfirmEliminar}>Eliminar</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
