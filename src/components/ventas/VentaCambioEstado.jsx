import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

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

function getOpcionesDisponibles(venta, permisos) {
  if (venta.es_devolucion) return permisos.puedeRevertir ? ['aprobada'] : []
  const all = TRANSICIONES[venta.estado] || []
  return all.filter(op => {
    if (op === 'aprobada') return permisos.puedeAprobar
    if (op === 'rechazada') return permisos.puedeRechazar
    if (op === 'devolucion') return permisos.puedeDevolucion
    if (op === 'pendiente') return permisos.puedeRevertir
    return false
  })
}

export default function VentaCambioEstado({ venta, onCambio, puedeAprobar, puedeRechazar, puedeDevolucion, puedeRevertir }) {
  const [abierto, setAbierto] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const btnRef = useRef(null)
  const opciones = getOpcionesDisponibles(venta, { puedeAprobar, puedeRechazar, puedeDevolucion, puedeRevertir })
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
    if (cambiando) return
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

  const handleCambio = async (e, opcion) => {
    e.stopPropagation()
    setAbierto(false)
    setCambiando(true)
    try {
      await onCambio(venta.id, opcion, venta)
    } catch {
      // Error handling is done by the parent (useVentas throws),
      // but we ensure the UI recovers from loading state
    } finally {
      setCambiando(false)
    }
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
        disabled={cambiando}
        aria-expanded={abierto}
        aria-haspopup="menu"
      >
        {cambiando ? <Loader2 size={12} className="vv-spin" /> : estadoLabels[estadoActual]}
        {!cambiando && <ChevronDown size={12} />}
      </button>
      {abierto && pos && (
        <div className="vv-estado-dropdown" role="menu" style={{ position: 'fixed', top: pos.top, left: pos.left }}>
          {opciones.map(opcion => (
            <button
              key={opcion}
              role="menuitem"
              className={`vv-estado-option vv-estado-opt-${opcion}`}
              onClick={(e) => handleCambio(e, opcion)}
            >
              Cambiar a {estadoLabels[opcion]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
