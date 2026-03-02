import { useState } from 'react'
import { Settings, RotateCcw, Save, Plus, X } from 'lucide-react'
import DashboardFiltroFecha from '../DashboardFiltroFecha'
import AddWidgetModal from './AddWidgetModal'

export default function DashboardToolbar({
  nombre,
  periodo, onPeriodoChange, fechaInicio, fechaFin, onFechaPersonalizada,
  editMode, setEditMode,
  onSave, onReset, onAddWidget,
  rol, layout,
}) {
  const [showAdd, setShowAdd] = useState(false)

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
        <DashboardFiltroFecha
          periodo={periodo}
          onPeriodoChange={onPeriodoChange}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          onFechaPersonalizada={onFechaPersonalizada}
        />

        {editMode ? (
          <div className="db-toolbar-actions">
            <button className="db-toolbar-btn db-toolbar-btn--add" onClick={() => setShowAdd(true)} title="Anadir widget">
              <Plus size={15} />
              <span>Anadir</span>
            </button>
            <button className="db-toolbar-btn db-toolbar-btn--reset" onClick={onReset} title="Restaurar por defecto">
              <RotateCcw size={14} />
            </button>
            <button className="db-toolbar-btn db-toolbar-btn--save" onClick={onSave} title="Guardar layout">
              <Save size={14} />
              <span>Guardar</span>
            </button>
            <button className="db-toolbar-btn db-toolbar-btn--cancel" onClick={() => setEditMode(false)} title="Cancelar">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button className="db-toolbar-btn db-toolbar-btn--edit" onClick={() => setEditMode(true)} title="Editar dashboard">
            <Settings size={14} />
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
