import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useToast } from '../../contexts/ToastContext'

function formatPrecio(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

export default function AjustesPaquetes({
  paquetes, onCargar, onCrear, onEditar, onEliminar,
}) {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const { showToast } = useToast()

  useEffect(() => { onCargar() }, [])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', descripcion: '', precio: '' })
    setError(null)
    setShowModal(true)
  }

  const abrirEditar = (p) => {
    setEditando(p)
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', precio: p.precio || '' })
    setError(null)
    setShowModal(true)
  }

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.precio || Number(form.precio) <= 0) { setError('El precio debe ser mayor a 0'); return }
    setSaving(true)
    setError(null)
    try {
      if (editando) {
        await onEditar(editando.id, { nombre: form.nombre, descripcion: form.descripcion || null, precio: Number(form.precio) })
      } else {
        await onCrear({ nombre: form.nombre, descripcion: form.descripcion || null, precio: Number(form.precio) })
      }
      setShowModal(false)
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async () => {
    if (!confirmDelete) return
    try {
      await onEliminar(confirmDelete.id)
    } catch (err) {
      showToast('Error al eliminar paquete', 'error')
    }
    setConfirmDelete(null)
  }

  return (
    <div className="aj-seccion">
      <div className="aj-seccion-header">
        <h3>Paquetes y servicios</h3>
        <button className="aj-btn-sm" onClick={abrirNuevo}>+ Nuevo paquete</button>
      </div>

      {paquetes.length === 0 ? (
        <div className="aj-empty">No hay paquetes creados</div>
      ) : (
        <div className="aj-cards-list">
          {paquetes.map(p => (
            <div key={p.id} className="aj-card">
              <div className="aj-card-top">
                <span className="aj-card-title">{p.nombre}</span>
                <span className="aj-card-precio">{formatPrecio(p.precio)}</span>
              </div>
              {p.descripcion && <p className="aj-card-desc">{p.descripcion}</p>}
              <div className="aj-card-actions">
                <button className="aj-btn-sm" onClick={() => abrirEditar(p)}>Editar</button>
                <button className="aj-btn-icon-danger" onClick={() => setConfirmDelete(p)} aria-label="Eliminar paquete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="aj-icon-sm" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editando ? 'Editar paquete' : 'Nuevo paquete'}
        footer={
          <>
            <button className="aj-btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="aj-btn-primary" onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando...' : editando ? 'Guardar' : 'Crear paquete'}
            </button>
          </>
        }
      >
        <div className="aj-field">
          <label>Nombre *</label>
          <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
        </div>
        <div className="aj-field">
          <label>Descripción</label>
          <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={2} />
        </div>
        <div className="aj-field">
          <label>Precio (€) *</label>
          <input type="number" min="0" step="0.01" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} />
        </div>
        {error && <div className="aj-error">{error}</div>}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar paquete"
        message={<>¿Eliminar <strong>{confirmDelete?.nombre}</strong>? Las ventas existentes no se verán afectadas.</>}
        variant="danger"
        confirmText="Eliminar"
        onConfirm={handleEliminar}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
