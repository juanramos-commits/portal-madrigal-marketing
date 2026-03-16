import { memo, useCallback } from 'react';

const CLASIFICACIONES = [
  { key: 'interesado', label: 'Interesado', colorClass: 'ce-clasif--interesado' },
  { key: 'no_ahora', label: 'No ahora', colorClass: 'ce-clasif--no-ahora' },
  { key: 'baja', label: 'Baja', colorClass: 'ce-clasif--baja' },
  { key: 'negativo', label: 'Negativo', colorClass: 'ce-clasif--negativo' },
  { key: 'irrelevante', label: 'Irrelevante', colorClass: 'ce-clasif--irrelevante' },
];

function RespuestaClasificacion({ clasificacionActual, onChange, loading }) {
  const handleClick = useCallback(
    (key) => {
      if (!loading && onChange) onChange(key);
    },
    [loading, onChange]
  );

  return (
    <div className="ce-clasificacion">
      {CLASIFICACIONES.map((c) => {
        const isActive = clasificacionActual === c.key;
        const btnClass = `ce-clasificacion-btn ${c.colorClass}${isActive ? ' ce-clasificacion-btn--active' : ''}`;

        return (
          <button
            key={c.key}
            type="button"
            className={btnClass}
            onClick={() => handleClick(c.key)}
            disabled={loading}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export default memo(RespuestaClasificacion);
