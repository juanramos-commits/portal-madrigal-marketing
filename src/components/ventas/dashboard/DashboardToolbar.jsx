import { useState } from 'react'
import { Settings, RotateCcw, Save, Plus, X } from 'lucide-react'
import DashboardFiltroFecha from '../DashboardFiltroFecha'
import AddWidgetModal from './AddWidgetModal'

export default function DashboardToolbar({
  periodo, onPeriodoChange, fechaInicio, fechaFin, onFechaPersonalizada,
  usuarioFiltro, onUsuarioFiltroChange, miembrosEquipo,
  editMode, setEditMode,
  onSave, onReset, onAddWidget,
  isSaving,
  rol, layout,
}) {
  const [showAdd, setShowAdd] = useState(false)
  const showUserFilter = (rol === 'admin' || rol === 'director_ventas') && miembrosEquipo?.length > 0

  const handleAdd = (type) => {
    onAddWidget(type)
    setShowAdd(false)
  }

  const handleReset = () => {
    if (window.confirm('¿Restablecer el layout por defecto? Se perderán los cambios actuales.')) {
      onReset()
    }
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
            <button type="button" className="db-toolbar-btn" onClick={handleReset} disabled={isSaving} aria-busy={isSaving} aria-label="Resetear layout">
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
        ) : (
          <button type="button" className="db-toolbar-btn db-toolbar-btn--edit" onClick={() => setEditMode(true)} aria-label="Editar dashboard">
            <Settings size={14} />
            <span>Editar</span>
          </button>
        )}

      <AddWidgetModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
        rol={rol}
        layout={layout}
      />
    </div>
  )
}
