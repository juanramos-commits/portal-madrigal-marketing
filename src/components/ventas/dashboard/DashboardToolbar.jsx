import { useState } from 'react'
import { Settings, RotateCcw, Save, Plus, X } from 'lucide-react'
import DashboardFiltroFecha from '../DashboardFiltroFecha'
import AddWidgetModal from './AddWidgetModal'
import ConfirmDialog from '../../ui/ConfirmDialog'

export default function DashboardToolbar({
  periodo, onPeriodoChange, fechaInicio, fechaFin, onFechaPersonalizada,
  usuarioFiltro, onUsuarioFiltroChange, miembrosEquipo,
  editMode, setEditMode,
  onSave, onReset, onAddWidget,
  isSaving,
  rol, layout,
  puedePersonalizar, puedeVerEquipo,
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const showUserFilter = puedeVerEquipo && miembrosEquipo?.length > 0

  const handleAdd = (type) => {
    onAddWidget(type)
    setShowAdd(false)
  }

  return (
    <div className="db-toolbar">
      <div className="db-toolbar-filters">
          <DashboardFiltroFecha
            periodo={periodo}
            onPeriodoChange={onPeriodoChange}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            onFechaPersonalizada={onFechaPersonalizada}
          />
          {showUserFilter && (
            <select
              className="db-select-periodo db-select-usuario"
              value={usuarioFiltro}
              onChange={e => onUsuarioFiltroChange(e.target.value)}
              aria-label="Filtrar por miembro del equipo"
            >
              <option value="">Todo el equipo</option>
              {miembrosEquipo.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          )}
        </div>

        {editMode ? (
          <div className="db-toolbar-actions">
            <button type="button" className="db-toolbar-btn db-toolbar-btn--add" onClick={() => setShowAdd(true)} aria-label="Añadir widget">
              <Plus size={14} />
              <span>Añadir</span>
            </button>
            <button type="button" className="db-toolbar-btn" onClick={() => setShowResetConfirm(true)} disabled={isSaving} aria-busy={isSaving} aria-label="Resetear layout">
              <RotateCcw size={14} />
              <span>Resetear</span>
            </button>
            <button type="button" className="db-toolbar-btn db-toolbar-btn--save" onClick={onSave} disabled={isSaving} aria-busy={isSaving} aria-label="Guardar layout">
              <Save size={14} />
              <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
            </button>
            <button type="button" className="db-toolbar-btn db-toolbar-btn--cancel" onClick={() => setEditMode(false)} aria-label="Cancelar edición">
              <X size={14} />
              <span>Cancelar</span>
            </button>
          </div>
        ) : puedePersonalizar ? (
          <button type="button" className="db-toolbar-btn db-toolbar-btn--edit" onClick={() => setEditMode(true)} aria-label="Editar dashboard">
            <Settings size={14} />
            <span>Editar</span>
          </button>
        ) : null}

      <AddWidgetModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
        rol={rol}
        layout={layout}
        puedeVerEquipo={puedeVerEquipo}
      />
      <ConfirmDialog
        open={showResetConfirm}
        title="Restablecer layout"
        message="¿Restablecer el layout por defecto? Se perderán los cambios actuales."
        variant="danger"
        confirmText="Restablecer"
        onConfirm={() => { setShowResetConfirm(false); onReset() }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
