import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

const METODOS_PAGO = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'sequra', label: 'SeQura' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'otro', label: 'Otro' },
]

const EMPTY_FILTROS = {
  setter_id: '', closer_id: '', paquete_id: '', metodo_pago: '',
  es_pago_unico: '', importe_min: '', importe_max: '', fecha_desde: '', fecha_hasta: '',
}

export default function VentasFiltros({
  filtros,
  onAplicar,
  onCerrar,
  setters = [],
  closers = [],
  paquetes = [],
}) {
  const [local, setLocal] = useState({ ...filtros })
  const panelRef = useRef(null)
  useFocusTrap(panelRef)

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCerrar])

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const handleChange = (key, value) => {
    setLocal(prev => ({ ...prev, [key]: value }))
  }

  const handleAplicar = () => {
    onAplicar(local)
    onCerrar()
  }

  const handleLimpiar = () => {
    onAplicar({ ...EMPTY_FILTROS })
    onCerrar()
  }

  return createPortal(
    <>
      <div className="vv-filters-overlay" onClick={onCerrar} aria-hidden="true" />
      <div className="vv-filters-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Filtros">
        <div className="vv-filters-header">
          <h2>Filtros</h2>
          <button className="vv-filters-close" onClick={onCerrar}>
            <X size={18} />
          </button>
        </div>

        <div className="vv-filters-body">
          <div className="vv-filter-field">
            <label>Setter asignado</label>
            <select value={local.setter_id} onChange={e => handleChange('setter_id', e.target.value)}>
              <option value="">Todos los setters</option>
              {setters.map(s => (
                <option key={s.usuario_id} value={s.usuario_id}>
                  {s.usuario?.nombre || s.usuario?.email}
                </option>
              ))}
            </select>
          </div>

          <div className="vv-filter-field">
            <label>Closer asignado</label>
            <select value={local.closer_id} onChange={e => handleChange('closer_id', e.target.value)}>
              <option value="">Todos los closers</option>
              {closers.map(c => (
                <option key={c.usuario_id} value={c.usuario_id}>
                  {c.usuario?.nombre || c.usuario?.email}
                </option>
              ))}
            </select>
          </div>

          <div className="vv-filter-field">
            <label>Paquete / Producto</label>
            <select value={local.paquete_id} onChange={e => handleChange('paquete_id', e.target.value)}>
              <option value="">Todos los paquetes</option>
              {paquetes.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="vv-filter-field">
            <label>Método de pago</label>
            <select value={local.metodo_pago} onChange={e => handleChange('metodo_pago', e.target.value)}>
              <option value="">Todos</option>
              {METODOS_PAGO.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="vv-filter-field">
            <label>Pago único</label>
            <select value={local.es_pago_unico} onChange={e => handleChange('es_pago_unico', e.target.value)}>
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="vv-filter-row">
            <div className="vv-filter-field">
              <label>Importe mínimo</label>
              <input
                type="number"
                placeholder="0"
                value={local.importe_min}
                onChange={e => handleChange('importe_min', e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="vv-filter-field">
              <label>Importe máximo</label>
              <input
                type="number"
                placeholder="Sin límite"
                value={local.importe_max}
                onChange={e => handleChange('importe_max', e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="vv-filter-row">
            <div className="vv-filter-field">
              <label>Fecha desde</label>
              <input
                type="date"
                value={local.fecha_desde}
                onChange={e => handleChange('fecha_desde', e.target.value)}
              />
            </div>
            <div className="vv-filter-field">
              <label>Fecha hasta</label>
              <input
                type="date"
                value={local.fecha_hasta}
                onChange={e => handleChange('fecha_hasta', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="vv-filters-footer">
          <button className="vv-btn-ghost" onClick={handleLimpiar}>Limpiar</button>
          <button className="vv-btn-primary" onClick={handleAplicar}>Aplicar filtros</button>
        </div>
      </div>
    </>,
    document.body
  )
}
