import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Select from '../ui/Select'

export default function CRMFiltros({
  filtros,
  onFiltrosChange,
  onCerrar,
  esAdminODirector,
  setters = [],
  closers = [],
  categorias = [],
  etapas = [],
  fuentes = [],
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCerrar])

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleChange = (key, value) => {
    onFiltrosChange({ ...filtros, [key]: value })
  }

  const limpiar = () => {
    onFiltrosChange({})
    onCerrar()
  }

  const aplicar = () => {
    onCerrar()
  }

  return createPortal(
    <>
      <div className="crm-filters-overlay" onClick={onCerrar} aria-hidden="true" />
      <div className="crm-filters-panel" role="dialog" aria-modal="true" aria-label="Filtros">
        <div className="crm-filters-header">
          <h2>Filtros</h2>
          <button className="crm-modal-close" onClick={onCerrar} aria-label="Cerrar filtros">
            <X />
          </button>
        </div>

        <div className="crm-filters-body">
          {esAdminODirector && (
            <>
              <div className="crm-field">
                <label>Setter asignado</label>
                <Select
                  value={filtros.setter_id || ''}
                  onChange={e => handleChange('setter_id', e.target.value || null)}
                >
                  <option value="">Todos los setters</option>
                  {setters.map(s => (
                    <option key={s.usuario_id} value={s.usuario_id}>
                      {s.usuario?.nombre || s.usuario?.email}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="crm-field">
                <label>Closer asignado</label>
                <Select
                  value={filtros.closer_id || ''}
                  onChange={e => handleChange('closer_id', e.target.value || null)}
                >
                  <option value="">Todos los closers</option>
                  {closers.map(c => (
                    <option key={c.usuario_id} value={c.usuario_id}>
                      {c.usuario?.nombre || c.usuario?.email}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}

          <div className="crm-field">
            <label>Categoría</label>
            <Select
              value={filtros.categoria_id || ''}
              onChange={e => handleChange('categoria_id', e.target.value || null)}
            >
              <option value="">Todas las categorías</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          </div>

          <div className="crm-field">
            <label>Fuente</label>
            <Select
              value={filtros.fuente || ''}
              onChange={e => handleChange('fuente', e.target.value || null)}
            >
              <option value="">Todas las fuentes</option>
              {fuentes.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>
          </div>

          <div className="crm-field">
            <label>Etapa</label>
            <Select
              value={(filtros.etapa_ids && filtros.etapa_ids[0]) || ''}
              onChange={e => handleChange('etapa_ids', e.target.value ? [e.target.value] : null)}
            >
              <option value="">Todas las etapas</option>
              {etapas.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </Select>
          </div>

          <div className="crm-field">
            <label>Fecha desde</label>
            <input
              type="date"
              value={filtros.fecha_desde || ''}
              onChange={e => handleChange('fecha_desde', e.target.value || null)}
            />
          </div>

          <div className="crm-field">
            <label>Fecha hasta</label>
            <input
              type="date"
              value={filtros.fecha_hasta || ''}
              onChange={e => handleChange('fecha_hasta', e.target.value || null)}
            />
          </div>
        </div>

        <div className="crm-filters-footer">
          <button className="ui-btn ui-btn--secondary ui-btn--md" onClick={limpiar}>Limpiar</button>
          <button className="ui-btn ui-btn--primary ui-btn--md" onClick={aplicar}>Aplicar filtros</button>
        </div>
      </div>
    </>,
    document.body
  )
}
