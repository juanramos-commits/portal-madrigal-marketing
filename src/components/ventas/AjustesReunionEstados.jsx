import { useState, useEffect } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const GripIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
  </svg>
)

function SortableEstado({ estado, onEditar, onEliminar }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: estado.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="aj-etapa-row">
      <button className="aj-drag-handle" {...attributes} {...listeners}><GripIcon /></button>
      <span className="aj-etapa-color" style={{ background: estado.color || '#9CA3AF' }} />
      <span className="aj-etapa-nombre" style={{ flex: 1 }}>{estado.nombre}</span>
      <span className="aj-estado-grab">
        {estado.es_obligatorio_grabacion ? 'Grabación obligatoria ✓' : ''}
      </span>
      <div className="aj-etapa-actions">
        <button className="aj-btn-icon" onClick={() => onEditar(estado)} title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button className="aj-btn-icon-danger" onClick={() => onEliminar(estado)} title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  )
}

export default function AjustesReunionEstados({
  reunionEstados, onCargar, onCrear, onEditar, onEliminar, onReordenar,
}) {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', color: '#22C55E', es_obligatorio_grabacion: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { onCargar() }, [])

  const abrirNuevo = () => { setEditando(null); setForm({ nombre: '', color: '#22C55E', es_obligatorio_grabacion: false }); setError(null); setShowModal(true) }
  const abrirEditar = (e) => { setEditando(e); setForm({ nombre: e.nombre, color: e.color || '#22C55E', es_obligatorio_grabacion: e.es_obligatorio_grabacion || false }); setError(null); setShowModal(true) }

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    try {
      if (editando) { await onEditar(editando.id, form) }
      else { await onCrear(form) }
      setShowModal(false)
    } catch (e) { setError(e.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const handleEliminar = async () => {
    if (!confirmDelete) return
    try { await onEliminar(confirmDelete.id) } catch (_) {}
    setConfirmDelete(null)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = reunionEstados.findIndex(e => e.id === active.id)
    const newIndex = reunionEstados.findIndex(e => e.id === over.id)
    onReordenar(arrayMove(reunionEstados.map(e => e.id), oldIndex, newIndex))
  }

  return (
    <div className="aj-seccion">
      <div className="aj-seccion-header">
        <h3>Estados de reunión</h3>
        <button className="aj-btn-sm" onClick={abrirNuevo}>+ Nuevo estado</button>
      </div>

      {reunionEstados.length === 0 ? (
        <div className="aj-empty">No hay estados configurados</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={reunionEstados.map(e => e.id)} strategy={verticalListSortingStrategy}>
            <div className="aj-etapas-list">
              {reunionEstados.map(e => (
                <SortableEstado key={e.id} estado={e} onEditar={abrirEditar} onEliminar={setConfirmDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showModal && (
        <>
          <div className="aj-modal-overlay" onClick={() => setShowModal(false)} />
          <div className="aj-modal aj-modal-sm">
            <div className="aj-modal-header">
              <h2>{editando ? 'Editar estado' : 'Nuevo estado'}</h2>
              <button className="aj-modal-close" onClick={() => setShowModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="aj-modal-body">
              <div className="aj-field"><label>Nombre *</label><input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="aj-field">
                <label>Color</label>
                <div className="aj-color-picker">
                  <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
                  <span className="aj-color-preview" style={{ background: form.color }} />
                  <span>{form.color}</span>
                </div>
              </div>
              <label className="aj-check-label">
                <input type="checkbox" checked={form.es_obligatorio_grabacion} onChange={e => setForm(p => ({ ...p, es_obligatorio_grabacion: e.target.checked }))} />
                <span>Grabación obligatoria</span>
              </label>
              {error && <div className="aj-error">{error}</div>}
            </div>
            <div className="aj-modal-actions">
              <button className="aj-btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="aj-btn-primary" onClick={handleGuardar} disabled={saving}>{saving ? 'Guardando...' : editando ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <>
          <div className="aj-modal-overlay" onClick={() => setConfirmDelete(null)} />
          <div className="aj-modal aj-modal-sm">
            <div className="aj-modal-header"><h2>Eliminar estado</h2></div>
            <div className="aj-modal-body"><p>¿Eliminar <strong>{confirmDelete.nombre}</strong>?</p></div>
            <div className="aj-modal-actions">
              <button className="aj-btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="aj-btn-danger" onClick={handleEliminar}>Eliminar</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
