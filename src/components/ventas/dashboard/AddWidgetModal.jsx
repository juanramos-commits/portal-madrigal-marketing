import { useState, useMemo } from 'react'
import Modal from '../../ui/Modal'
import { WIDGET_CATALOG, WIDGET_CATEGORIES, getWidgetsForRole } from '../../../config/widgetCatalog'

export default function AddWidgetModal({ open, onClose, onAdd, rol, layout }) {
  const [tab, setTab] = useState('kpis')

  const usedTypes = useMemo(() => {
    if (!layout) return new Set()
    return new Set(layout.map(item => item.type))
  }, [layout])

  const availableWidgets = useMemo(() => {
    const forRole = getWidgetsForRole(rol || 'admin')
    return Object.values(forRole).filter(w => !usedTypes.has(w.type))
  }, [rol, usedTypes])

  const filtered = availableWidgets.filter(w => w.category === tab)

  return (
    <Modal open={open} onClose={onClose} title="Añadir widget" size="md">
      <div className="db-addw">
        <div className="db-addw-tabs">
          {WIDGET_CATEGORIES.map(cat => {
            const count = availableWidgets.filter(w => w.category === cat.key).length
            return (
              <button
                key={cat.key}
                className={`db-addw-tab${tab === cat.key ? ' db-addw-tab--active' : ''}`}
                onClick={() => setTab(cat.key)}
              >
                <cat.icon size={14} />
                {cat.label}
                {count > 0 && <span className="db-addw-tab-count">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="db-addw-list">
          {filtered.length === 0 ? (
            <div className="db-addw-empty">
              Todos los widgets de esta categoría ya están agregados
            </div>
          ) : (
            filtered.map(w => {
              const Icon = w.icon
              return (
                <button key={w.type} className="db-addw-item" onClick={() => onAdd(w.type)}>
                  <div className="db-addw-item-icon">
                    {Icon && <Icon size={18} />}
                  </div>
                  <div className="db-addw-item-info">
                    <span className="db-addw-item-label">{w.label}</span>
                    <span className="db-addw-item-size">
                      {w.defaultSize.w}x{w.defaultSize.h}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
