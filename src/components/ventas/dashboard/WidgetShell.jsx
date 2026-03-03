import { memo, useCallback } from 'react'
import { GripVertical, X } from 'lucide-react'

export default memo(function WidgetShell({ widgetDef, editMode, widgetId, onRemove, loading, children }) {
  if (!widgetDef) return null

  const Icon = widgetDef.icon
  const handleRemove = useCallback(() => onRemove(widgetId), [onRemove, widgetId])

  return (
    <div className={`db-widget${editMode ? ' db-widget--editing' : ''}`}>
      <div className="db-widget-header">
        <div className="db-widget-title">
          {editMode && <GripVertical size={14} className="db-widget-drag-handle" title="Arrastra para mover" />}
          {Icon && <Icon size={14} />}
          {widgetDef.label}
        </div>
        {editMode && (
          <button type="button" className="db-widget-remove" onClick={handleRemove} title="Quitar widget" aria-label={`Quitar ${widgetDef.label}`}>
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
})
