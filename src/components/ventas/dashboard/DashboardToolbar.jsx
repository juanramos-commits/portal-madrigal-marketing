import { useState } from 'react'
import { Settings, RotateCcw, Save, Plus, X } from 'lucide-react'
import DashboardFiltroFecha from '../DashboardFiltroFecha'
import AddWidgetModal from './AddWidgetModal'

export default function DashboardToolbar({
  nombre,
  periodo, onPeriodoChange, fechaInicio, fechaFin, onFechaPersonalizada,
  usuarioFiltro, onUsuarioFiltroChange, miembrosEquipo,
  editMode, setEditMode,
  onSave, onReset, onAddWidget,
  rol, layout,
}) {
  const [showAdd, setShowAdd] = useState(false)
  const showUserFilter = (rol === 'admin' || rol === 'director_ventas') && miembrosEquipo?.length > 0

  const handleAdd = (type) => {
    onAddWidget(type)
    setShowAdd(false)
  }

  return (
    <div className="db-toolbar">
      <div className="db-toolbar-left">
        <h1 className="db-toolbar-greeting">
          {nombre ? `Hola, ${nombre}` : 'Dashboard'}
        </h1>
      </div>

      <div className="db-toolbar-right">
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
            <button className="db-toolbar-btn db-toolbar-btn--add" onClick={() => setShowAdd(true)}>
              <Plus size={14} />
              <span>Añadir</span>
            </button>
            <button className="db-toolbar-btn" onClick={onReset} title="Restaurar layout por defecto">
              <RotateCcw size={14} />
              <span>Resetear</span>
            </button>
            <button className="db-toolbar-btn db-toolbar-btn--save" onClick={onSave}>
              <Save size={14} />
              <span>Guardar</span>
            </button>
            <button className="db-toolbar-btn db-toolbar-btn--cancel" onClick={() => setEditMode(false)}>
              <X size={14} />
              <span>Cancelar</span>
            </button>
          </div>
        ) : (
          <button className="db-toolbar-btn db-toolbar-btn--edit" onClick={() => setEditMode(true)}>
            <Settings size={14} />
            <span>Editar</span>
          </button>
        )}
      </div>

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
