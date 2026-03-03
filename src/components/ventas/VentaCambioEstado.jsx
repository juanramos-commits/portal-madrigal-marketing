import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

const TRANSICIONES = {
  pendiente: ['aprobada', 'rechazada'],
  aprobada: ['rechazada', 'devolucion'],
  rechazada: ['pendiente'],
}

const estadoLabels = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  devolucion: 'Devolución',
}

function getOpcionesDisponibles(venta) {
  if (venta.es_devolucion) return ['aprobada']
  return TRANSICIONES[venta.estado] || []
}

export default function VentaCambioEstado({ venta, onCambio }) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const btnRef = useRef(null)
  const opciones = getOpcionesDisponibles(venta)
  const estadoActual = venta.es_devolucion ? 'devolucion' : venta.estado

  useEffect(() => {
    if (!abierto) return
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [abierto])

  const toggleOpen = (e) => {
    e.stopPropagation()
    if (!abierto && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const dropdownHeight = opciones.length * 36 + 8 // approx height
      const spaceBelow = window.innerHeight - rect.bottom - 4
      const openAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight
      setPos({
        top: openAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
      })
    }
    setAbierto(!abierto)
  }

  if (opciones.length === 0) {
    return <span className={`vv-badge vv-badge-${estadoActual}`}>{estadoLabels[estadoActual]}</span>
  }

  return (
    <div className="vv-estado-selector" ref={ref}>
      <button
        ref={btnRef}
        className={`vv-badge vv-badge-${estadoActual} vv-estado-editable`}
        onClick={toggleOpen}
      >
        {estadoLabels[estadoActual]}
        <ChevronDown size={12} />
      </button>
      {abierto && pos && (
        <div className="vv-estado-dropdown" style={{ position: 'fixed', top: pos.top, left: pos.left }}>
          {opciones.map(opcion => (
            <button
              key={opcion}
              className={`vv-estado-option vv-estado-opt-${opcion}`}
              onClick={(e) => {
                e.stopPropagation()
                setAbierto(false)
                onCambio(venta.id, opcion, venta)
              }}
            >
              Cambiar a {estadoLabels[opcion]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
