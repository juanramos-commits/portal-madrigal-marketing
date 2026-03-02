import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Checkbox from '../ui/Checkbox'
import Modal from '../ui/Modal'
import Select from '../ui/Select'

const ROL_LABELS = { setter: 'Setter', closer: 'Closer', director_ventas: 'Director' }
const ALL_ROLES = ['setter', 'closer', 'director_ventas']

export default function AjustesEquipo({
  equipo, onCargar, onAsignarRol, onEditarRoles, onDesactivar,
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRoles, setSelectedRoles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { onCargar() }, [])

  const cargarUsuarios = async () => {
    const existingIds = equipo.map(m => m.usuario_id)
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, email')
      .eq('activo', true)
      .order('nombre')
    setUsuarios((data || []).filter(u => !existingIds.includes(u.id)))
  }

  const handleOpenAdd = () => {
    cargarUsuarios()
    setSelectedUser('')
    setSelectedRoles([])
    setError(null)
    setShowAdd(true)
  }

  const handleOpenEdit = (miembro) => {
    setShowEdit(miembro)
    setSelectedRoles(miembro.roles.filter(r => r.activo).map(r => r.rol))
    setError(null)
  }

  const toggleRol = (rol) => {
    setSelectedRoles(prev =>
      prev.includes(rol) ? prev.filter(r => r !== rol) : [...prev, rol]
    )
  }

  const handleAddSave = async () => {
    if (!selectedUser) { setError('Selecciona un usuario'); return }
    if (selectedRoles.length === 0) { setError('Selecciona al menos un rol'); return }
    setSaving(true); setError(null)
    try {
      await onAsignarRol(selectedUser, selectedRoles)
      setShowAdd(false)
    } catch (e) { setError(e.message || 'Error al asignar') }
    finally { setSaving(false) }
  }

  const handleEditSave = async () => {
    if (!showEdit) return
    setSaving(true); setError(null)
    try {
      await onEditarRoles(showEdit.usuario_id, selectedRoles)
      setShowEdit(null)
    } catch (e) { setError(e.message || 'Error al editar') }
    finally { setSaving(false) }
  }

  const handleToggleActivo = async (miembro) => {
    try {
      await onDesactivar(miembro.usuario_id, !miembro.activo)
    } catch (e) {
      setError(e.message || 'Error al cambiar estado')
    }
  }

  return (
    <div className="aj-seccion">
      <div className="aj-seccion-header">
        <h3>Equipo comercial</h3>
        <button className="aj-btn-sm" onClick={handleOpenAdd}>+ Añadir</button>
      </div>

      {error && !showAdd && !showEdit && <div className="aj-error">{error}</div>}

      {equipo.length === 0 ? (
        <div className="aj-empty">No hay miembros en el equipo</div>
      ) : (
        <div className="aj-cards-list">
          {equipo.map(m => (
            <div key={m.usuario_id} className="aj-card">
              <div className="aj-card-top">
                <div>
                  <span className="aj-card-title">{m.usuario?.nombre || 'Sin nombre'}</span>
                  <span className="aj-card-subtitle">{m.usuario?.email}</span>
                </div>
                <span className={`aj-status-badge ${m.activo ? 'aj-status-active' : 'aj-status-inactive'}`}>
                  {m.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="aj-card-roles">
                {m.roles.filter(r => r.activo).map(r => (
                  <span key={r.id} className={`aj-role-badge aj-role-${r.rol}`}>
                    {ROL_LABELS[r.rol] || r.rol}
                  </span>
                ))}
              </div>
              <div className="aj-card-actions">
                <button className="aj-btn-sm" onClick={() => handleOpenEdit(m)}>Editar roles</button>
                <button
                  className={`aj-btn-sm ${m.activo ? 'aj-btn-warning' : ''}`}
                  onClick={() => handleToggleActivo(m)}
                >
                  {m.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Añadir miembro"
        footer={
          <>
            <button className="aj-btn-ghost" onClick={() => setShowAdd(false)}>Cancelar</button>
            <button className="aj-btn-primary" onClick={handleAddSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Añadir'}
            </button>
          </>
        }
      >
        <div className="aj-field">
          <label>Usuario</label>
          <Select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            <option value="">Seleccionar usuario</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nombre || u.email}</option>
            ))}
          </Select>
        </div>
        <div className="aj-field">
          <label>Roles</label>
          <div className="aj-roles-checks">
            {ALL_ROLES.map(r => (
              <Checkbox key={r} checked={selectedRoles.includes(r)} onChange={() => toggleRol(r)} label={ROL_LABELS[r]} />
            ))}
          </div>
        </div>
        {error && <div className="aj-error">{error}</div>}
      </Modal>

      <Modal
        open={!!showEdit}
        onClose={() => setShowEdit(null)}
        title="Editar roles"
        size="sm"
        footer={
          <>
            <button className="aj-btn-ghost" onClick={() => setShowEdit(null)}>Cancelar</button>
            <button className="aj-btn-primary" onClick={handleEditSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <p><strong>{showEdit?.usuario?.nombre || showEdit?.usuario?.email}</strong></p>
        <div className="aj-roles-checks">
          {ALL_ROLES.map(r => (
            <Checkbox key={r} checked={selectedRoles.includes(r)} onChange={() => toggleRol(r)} label={ROL_LABELS[r]} />
          ))}
        </div>
        {error && <div className="aj-error">{error}</div>}
      </Modal>
    </div>
  )
}
