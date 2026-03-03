import { useState, useEffect } from 'react'
import ConfirmDialog from '../ui/ConfirmDialog'
import { GripIcon, EditIcon, TrashIcon, PlusIcon } from './BibliotecaIcons'
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
        <button className="bib-btn-icon" onClick={() => onEditar(recurso)} aria-label="Editar recurso">
          <EditIcon />
        </button>
        <button className="bib-btn-icon bib-btn-icon--danger" onClick={() => onEliminar(recurso)} aria-label="Eliminar recurso">
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

  // Sync active section when secciones change (e.g. new section created, or active one deleted)
  useEffect(() => {
    if (secciones.length > 0 && !secciones.some(s => s.id === seccionActiva)) {
      setSeccionActiva(secciones[0].id)
    }
  }, [secciones, seccionActiva])
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState(null)

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
    setEliminando(true)
    setErrorEliminar(null)
    try {
      await onEliminar(confirmEliminar.id)
      setConfirmEliminar(null)
    } catch (e) {
      setErrorEliminar(e?.message || 'Error al eliminar el recurso')
    } finally {
      setEliminando(false)
    }
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

      <ConfirmDialog
        open={!!confirmEliminar}
        title="Eliminar recurso"
        message={<>¿Eliminar el recurso <strong>{confirmEliminar?.nombre}</strong>?<br /><span className="bib-text-muted">Esta acción no se puede deshacer.</span>{errorEliminar && <><br /><span className="bib-confirm-error">{errorEliminar}</span></>}</>}
        variant="danger"
        confirmText="Eliminar"
        loading={eliminando}
        onConfirm={handleConfirmEliminar}
        onCancel={() => { setConfirmEliminar(null); setErrorEliminar(null) }}
      />
    </div>
  )
}
