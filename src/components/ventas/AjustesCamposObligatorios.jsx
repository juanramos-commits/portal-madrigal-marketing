import { useEffect } from 'react'

const CAMPO_LABELS = {
  estado_reunion: 'Estado de la reunión',
  enlace_grabacion: 'Enlace de grabación',
  notas_closer: 'Notas del closer',
}

export default function AjustesCamposObligatorios({
  camposObligatorios, onCargar, onToggle,
}) {
  useEffect(() => { onCargar() }, [])

  return (
    <div className="aj-seccion">
      <h3>Campos obligatorios para closers</h3>
      <p className="aj-desc">Configura qué campos son obligatorios al cerrar una reunión.</p>

      {camposObligatorios.length === 0 ? (
        <div className="aj-empty">No hay campos configurados</div>
      ) : (
        <div className="aj-campos-list">
          {camposObligatorios.map(c => (
            <div key={c.id} className="aj-campo-row">
              <span className="aj-campo-nombre">{CAMPO_LABELS[c.campo] || c.campo}</span>
              <button
                className={`aj-toggle${c.es_obligatorio ? ' active' : ''}`}
                onClick={() => onToggle(c.id, !c.es_obligatorio)}
              >
                <span className="aj-toggle-knob" />
                <span className="aj-toggle-text">
                  {c.es_obligatorio ? 'Obligatorio' : 'Opcional'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
