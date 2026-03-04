import { useState, useMemo, useCallback } from 'react'
import Modal from '../../ui/Modal'
import { WIDGET_CATALOG, WIDGET_CATEGORIES, getWidgetsForRole } from '../../../config/widgetCatalog'

export default function AddWidgetModal({ open, onClose, onAdd, rol, layout, puedeVerEquipo }) {
  const [tab, setTab] = useState('kpis')

  const handleTabKeyDown = useCallback((e) => {
    const keys = WIDGET_CATEGORIES.map(c => c.key)
    const idx = keys.indexOf(tab)
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next = (idx + 1) % keys.length }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); next = (idx - 1 + keys.length) % keys.length }
    else if (e.key === 'Home') { e.preventDefault(); next = 0 }
    else if (e.key === 'End') { e.preventDefault(); next = keys.length - 1 }
    else return
    setTab(keys[next])
    document.getElementById(`db-addw-tab-${keys[next]}`)?.focus()
  }, [tab])

  const usedTypes = useMemo(() => {
    if (!layout) return new Set()
    return new Set(layout.map(item => item.type))
  }, [layout])

  const availableWidgets = useMemo(() => {
    const forRole = getWidgetsForRole(rol || 'admin')
    return Object.values(forRole).filter(w => {
      if (usedTypes.has(w.type)) return false
      if (w.category === 'team' && !puedeVerEquipo) return false
      return true
    })
  }, [rol, usedTypes, puedeVerEquipo])

  const filtered = availableWidgets.filter(w => w.category === tab)

  return (
    <Modal open={open} onClose={onClose} title="Añadir widget" size="md">
      <div className="db-addw">
        <div className="db-addw-tabs" role="tablist" aria-label="Categorías de widgets" onKeyDown={handleTabKeyDown}>
          {WIDGET_CATEGORIES.map(cat => {
            const isActive = tab === cat.key
            const count = availableWidgets.filter(w => w.category === cat.key).length
            return (
              <button
                key={cat.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="db-addw-panel"
                id={`db-addw-tab-${cat.key}`}
                tabIndex={isActive ? 0 : -1}
                className={`db-addw-tab${isActive ? ' db-addw-tab--active' : ''}`}
                onClick={() => setTab(cat.key)}
              >
                <cat.icon size={14} />
                {cat.label}
                {count > 0 && <span className="db-addw-tab-count">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="db-addw-list" id="db-addw-panel" role="tabpanel" aria-labelledby={`db-addw-tab-${tab}`}>
          {filtered.length === 0 ? (
            <div className="db-addw-empty">
              Todos los widgets de esta categoría ya están agregados
            </div>
          ) : (
            filtered.map(w => {
              const Icon = w.icon
              return (
                <button key={w.type} type="button" className="db-addw-item" onClick={() => onAdd(w.type)} aria-label={`Añadir ${w.label}`}>
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
