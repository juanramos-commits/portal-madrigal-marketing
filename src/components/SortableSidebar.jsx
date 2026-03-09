import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import NotificacionesBadge from './ventas/NotificacionesBadge'
import { preloadRoute } from '../config/routePreloads'

const restrictToVerticalAxis = ({ transform }) => ({
  ...transform,
  x: 0,
})

function SortableMenuItem({ item, isActive, onNavigate, GripIcon }) {
  const [isHovered, setIsHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = item.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`nav-item ${isActive ? 'active' : ''}`}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}
      >
        <div
          onClick={() => onNavigate(item.href)}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }}
        >
          <Icon />
          <span className="nav-label">{item.name}</span>
        </div>
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            opacity: isHovered ? 0.6 : 0,
            transition: 'opacity 0.2s',
            padding: '4px'
          }}
        >
          <GripIcon />
        </div>
      </div>
    </div>
  )
}

function SortableDocMenuItem({ item, isActive, onClick, GripIcon, ChevronIcon }) {
  const [isHovered, setIsHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = item.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`nav-item ${isActive ? 'active' : ''}`}
        style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}
      >
        <div
          onClick={onClick}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }}
        >
          <Icon />
          <span className="nav-label">{item.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            onClick={onClick}
            style={{ transform: item.isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', cursor: 'pointer' }}
          >
            <ChevronIcon />
          </div>
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              opacity: isHovered ? 0.6 : 0,
              transition: 'opacity 0.2s',
              padding: '4px'
            }}
          >
            <GripIcon />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SortableSidebar({
  visibleSections,
  ventasMenuOpen,
  setVentasMenuOpen,
  porOrganizarMenuOpen,
  setPorOrganizarMenuOpen,
  isActive,
  handleNavigate,
  handleDragEnd,
  notifContador,
  Icons,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
      <SortableContext items={visibleSections.map(item => item.id)} strategy={verticalListSortingStrategy}>
        {visibleSections.map((item) => {
          if (item.type === 'submenu') {
            const isOpen = item.id === 'ventas' ? ventasMenuOpen
              : item.id === 'por-organizar' ? porOrganizarMenuOpen
              : false
            const toggleOpen = item.id === 'ventas' ? () => setVentasMenuOpen(!ventasMenuOpen)
              : item.id === 'por-organizar' ? () => setPorOrganizarMenuOpen(!porOrganizarMenuOpen)
              : () => {}

            return (
              <div key={item.id}>
                <SortableDocMenuItem
                  item={{ ...item, isOpen }}
                  isActive={false}
                  onClick={toggleOpen}
                  GripIcon={Icons.GripVertical}
                  ChevronIcon={Icons.ChevronDown}
                />
                {isOpen && item.children && (
                  <div style={{ paddingLeft: '32px', marginTop: '2px' }}>
                    {item.children.map(child => (
                      <Link
                        key={child.href}
                        to={child.href}
                        onMouseEnter={() => preloadRoute(child.href)}
                        className={`nav-item ${isActive(child.href) ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                      >
                        <child.icon />
                        <span className="nav-label" style={{ flex: 1 }}>{child.name}</span>
                        {child.href === '/ventas/notificaciones' && <NotificacionesBadge contador={notifContador} />}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <SortableMenuItem
              key={item.id}
              item={item}
              isActive={isActive(item.href)}
              onNavigate={handleNavigate}
              GripIcon={Icons.GripVertical}
            />
          )
        })}
      </SortableContext>
    </DndContext>
  )
}
