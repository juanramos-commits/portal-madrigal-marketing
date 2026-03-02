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
  const ref = useRef(null)
  const opciones = getOpcionesDisponibles(venta)
  const estadoActual = venta.es_devolucion ? 'devolucion' : venta.estado

  useEffect(() => {
    if (!abierto) return
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [abierto])

  if (opciones.length === 0) {
    return <span className={`vv-badge vv-badge-${estadoActual}`}>{estadoLabels[estadoActual]}</span>
  }

  return (
    <div className="vv-estado-selector" ref={ref}>
      <button
        className={`vv-badge vv-badge-${estadoActual} vv-estado-editable`}
        onClick={(e) => { e.stopPropagation(); setAbierto(!abierto) }}
      >
        {estadoLabels[estadoActual]}
        <ChevronDown size={12} />
      </button>
      {abierto && (
        <div className="vv-estado-dropdown">
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
