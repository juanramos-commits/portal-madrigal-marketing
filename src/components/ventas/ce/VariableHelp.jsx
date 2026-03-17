import { memo, useCallback } from 'react';

const VARIABLES = [
  { key: 'nombre', label: '{{nombre}}' },
  { key: 'empresa', label: '{{empresa}}' },
  { key: 'cargo', label: '{{cargo}}' },
  { key: 'email', label: '{{email}}' },
  { key: 'dominio_empresa', label: '{{dominio_empresa}}' },
  { key: 'categoria', label: '{{categoria}}' },
  { key: 'zona', label: '{{zona}}' },
];

function VariableHelp({ onInsert }) {
  const handleClick = useCallback(
    (variable) => {
      if (onInsert) onInsert(variable);
    },
    [onInsert]
  );

  return (
    <div className="ce-variable-help">
      <span className="ce-variable-help-label">Variables:</span>
      <div className="ce-variable-help-pills">
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            className="ce-variable-pill"
            onClick={() => handleClick(v.label)}
            title={`Insertar ${v.label}`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(VariableHelp);
