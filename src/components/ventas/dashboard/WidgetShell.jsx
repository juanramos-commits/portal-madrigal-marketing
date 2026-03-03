import { GripVertical, X } from 'lucide-react'

export default function WidgetShell({ widgetDef, editMode, onRemove, loading, children }) {
  if (!widgetDef) return null

  const Icon = widgetDef.icon

  return (
    <div className={`db-widget${editMode ? ' db-widget--editing' : ''}`}>
      <div className="db-widget-header">
        <div className="db-widget-title">
          {editMode && <GripVertical size={14} className="db-widget-drag-handle" />}
          {Icon && <Icon size={14} />}
          {widgetDef.label}
        </div>
        {editMode && (
          <button className="db-widget-remove" onClick={onRemove} title="Quitar widget" aria-label={`Quitar ${widgetDef.label}`}>
            <X size={14} />
          </button>
        )}
      </div>
      <div className="db-widget-body">
        {loading ? (
          <div className="db-widget-skeleton" role="status" aria-label="Cargando datos">
            <div className="db-sk-block db-sk-lg" />
            <div className="db-sk-block db-sk-sm" />
          </div>
        ) : children}
      </div>
    </div>
  )
}
