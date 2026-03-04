import { useState, useEffect } from 'react'
import Checkbox from '../ui/Checkbox'
import Select from '../ui/Select'
import Modal from '../ui/Modal'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const GripIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aj-icon-nav" aria-hidden="true">
    <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aj-icon-back" aria-hidden="true">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
)

const TIPO_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'ghosting', label: 'Ghosting' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'venta', label: 'Venta' },
  { value: 'lost', label: 'Lost' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'cita_realizada', label: 'Cita realizada' },
]

const TIPOS_SISTEMA = ['venta', 'lost', 'devolucion']

function SortableEtapa({ etapa, onEditar, onEliminar }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etapa.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const esSistema = TIPOS_SISTEMA.includes(etapa.tipo)

  return (
    <div ref={setNodeRef} style={style} className="aj-etapa-row">
      <button className="aj-drag-handle" {...attributes} {...listeners}><GripIcon /></button>
      <span className="aj-etapa-color" style={{ background: etapa.color || '#9CA3AF' }} />
      <span className="aj-etapa-orden">{etapa.orden}.</span>
      <span className="aj-etapa-nombre">{etapa.nombre}</span>
      {etapa.tipo !== 'normal' && (
        <span className="aj-etapa-tipo-badge">{etapa.tipo}</span>
      )}
      {etapa.max_intentos && (
        <span className="aj-etapa-max">máx {etapa.max_intentos}</span>
      )}
      <div className="aj-etapa-actions">
        <button className="aj-btn-icon" onClick={() => onEditar(etapa)} aria-label="Editar etapa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aj-icon-sm" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        {!esSistema && (
          <button className="aj-btn-icon-danger" onClick={() => onEliminar(etapa)} aria-label="Eliminar etapa">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aj-icon-sm" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function AjustesPipelines({
  pipelines, etapas,
  onCargarPipelines, onCargarEtapas,
  onCrearEtapa, onEditarEtapa, onEliminarEtapa, onReordenarEtapas,
}) {
  const [pipelineActivo, setPipelineActivo] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', color: '#3B82F6', tipo: 'normal', max_intentos: null, es_final: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { onCargarPipelines() }, [])

  useEffect(() => {
    if (pipelines.length > 0) {
      const stillExists = pipelines.find(p => p.id === pipelineActivo)
      if (!stillExists) setPipelineActivo(pipelines[0].id)
    }
  }, [pipelines])

  useEffect(() => {
    if (pipelineActivo) onCargarEtapas(pipelineActivo)
  }, [pipelineActivo])

  const etapasPipeline = etapas
    .filter(e => e.pipeline_id === pipelineActivo)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))

  const abrirNueva = () => {
    setEditando(null)
    setForm({ nombre: '', color: '#3B82F6', tipo: 'normal', max_intentos: null, es_final: false })
    setError(null)
    setShowModal(true)
  }

  const abrirEditar = (etapa) => {
    setEditando(etapa)
    setForm({
      nombre: etapa.nombre,
      color: etapa.color || '#3B82F6',
      tipo: etapa.tipo || 'normal',
      max_intentos: etapa.max_intentos || null,
      es_final: etapa.es_final || false,
    })
    setError(null)
    setShowModal(true)
  }

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError(null)
    try {
      if (editando) {
        await onEditarEtapa(editando.id, {
          nombre: form.nombre,
          color: form.color,
          tipo: form.tipo,
          max_intentos: form.tipo === 'ghosting' ? (Number(form.max_intentos) || null) : null,
          es_final: form.es_final,
        })
      } else {
        await onCrearEtapa({
          pipeline_id: pipelineActivo,
          nombre: form.nombre,
          color: form.color,
          tipo: form.tipo,
          max_intentos: form.tipo === 'ghosting' ? (Number(form.max_intentos) || null) : null,
          es_final: form.es_final,
        })
      }
      setShowModal(false)
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async (etapa) => {
    setDeleteError(null)
    try {
      await onEliminarEtapa(etapa.id)
    } catch (e) {
      setDeleteError(e.message)
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = etapasPipeline.findIndex(e => e.id === active.id)
    const newIndex = etapasPipeline.findIndex(e => e.id === over.id)
    const nuevasIds = arrayMove(etapasPipeline.map(e => e.id), oldIndex, newIndex)
    onReordenarEtapas(pipelineActivo, nuevasIds)
  }

  return (
    <div className="aj-seccion">
      <h3>Pipelines y etapas</h3>

      <div className="aj-pipeline-tabs" role="tablist" aria-label="Pipelines">
        {pipelines.map(p => (
          <button
            key={p.id}
            className={`aj-pipeline-tab${pipelineActivo === p.id ? ' active' : ''}`}
            onClick={() => setPipelineActivo(p.id)}
            role="tab"
            aria-selected={pipelineActivo === p.id}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {deleteError && <div className="aj-error">{deleteError}</div>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={etapasPipeline.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div className="aj-etapas-list">
            {etapasPipeline.map(e => (
              <SortableEtapa key={e.id} etapa={e} onEditar={abrirEditar} onEliminar={handleEliminar} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button className="aj-btn-sm aj-mt" onClick={abrirNueva}>+ Nueva etapa</button>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editando ? 'Editar etapa' : 'Nueva etapa'}
        footer={
          <>
            <button className="aj-btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="aj-btn-primary" onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando...' : editando ? 'Guardar' : 'Crear etapa'}
            </button>
          </>
        }
      >
        <div className="aj-field">
          <label>Nombre *</label>
          <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
        </div>
        <div className="aj-form-row">
          <div className="aj-field">
            <label>Color</label>
            <div className="aj-color-picker">
              <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
              <span className="aj-color-preview" style={{ background: form.color }} />
              <span>{form.color}</span>
            </div>
          </div>
          <div className="aj-field">
            <label>Tipo</label>
            <Select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
              {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
        </div>
        {form.tipo === 'ghosting' && (
          <div className="aj-field">
            <label>Máximo intentos</label>
            <input type="number" min="1" value={form.max_intentos || ''} onChange={e => setForm(p => ({ ...p, max_intentos: e.target.value }))} placeholder="3" />
          </div>
        )}
        <Checkbox checked={form.es_final} onChange={v => setForm(p => ({ ...p, es_final: v }))} label="Es etapa final" />
        {error && <div className="aj-error">{error}</div>}
      </Modal>
    </div>
  )
}
