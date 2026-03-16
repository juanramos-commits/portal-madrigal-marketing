import { useState, useCallback } from 'react';
import VariableHelp from './VariableHelp';

export default function SecuenciaPasoEditor({
  paso,
  onChange,
  onDelete,
  abTesting,
  orden,
}) {
  const [variante, setVariante] = useState('a');

  const currentAsunto =
    variante === 'b' && abTesting
      ? paso.asunto_b || ''
      : paso.asunto || '';

  const currentCuerpo =
    variante === 'b' && abTesting
      ? paso.cuerpo_b || ''
      : paso.cuerpo || '';

  const handleDelayChange = useCallback(
    (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 0) {
        onChange({ ...paso, delay_dias: val });
      }
    },
    [paso, onChange]
  );

  const handleAsuntoChange = useCallback(
    (e) => {
      const key = variante === 'b' && abTesting ? 'asunto_b' : 'asunto';
      onChange({ ...paso, [key]: e.target.value });
    },
    [paso, onChange, variante, abTesting]
  );

  const handleCuerpoChange = useCallback(
    (e) => {
      const key = variante === 'b' && abTesting ? 'cuerpo_b' : 'cuerpo';
      onChange({ ...paso, [key]: e.target.value });
    },
    [paso, onChange, variante, abTesting]
  );

  const handleInsertVariable = useCallback(
    (variable) => {
      const key = variante === 'b' && abTesting ? 'cuerpo_b' : 'cuerpo';
      const current = paso[key] || '';
      onChange({ ...paso, [key]: current + variable });
    },
    [paso, onChange, variante, abTesting]
  );

  return (
    <div className="ce-paso-editor">
      <div className="ce-paso-editor-header">
        <span className="ce-paso-editor-orden">Paso {orden}</span>
        <div className="ce-paso-editor-delay">
          <input
            type="number"
            className="ce-paso-editor-delay-input"
            value={paso.delay_dias ?? 0}
            onChange={handleDelayChange}
            min={0}
          />
          <span className="ce-paso-editor-delay-label">días</span>
        </div>
        <button
          type="button"
          className="ce-paso-editor-delete"
          onClick={onDelete}
          title="Eliminar paso"
        >
          ×
        </button>
      </div>

      {abTesting && (
        <div className="ce-paso-editor-tabs">
          <button
            type="button"
            className={`ce-paso-editor-tab${variante === 'a' ? ' ce-paso-editor-tab--active' : ''}`}
            onClick={() => setVariante('a')}
          >
            Variante A
          </button>
          <button
            type="button"
            className={`ce-paso-editor-tab${variante === 'b' ? ' ce-paso-editor-tab--active' : ''}`}
            onClick={() => setVariante('b')}
          >
            Variante B
          </button>
        </div>
      )}

      <div className="ce-paso-editor-body">
        <div className="ce-paso-editor-field">
          <label className="ce-paso-editor-label">Asunto</label>
          <input
            type="text"
            className="ce-paso-editor-input"
            value={currentAsunto}
            onChange={handleAsuntoChange}
            placeholder="Asunto del email..."
          />
        </div>

        <div className="ce-paso-editor-field">
          <label className="ce-paso-editor-label">Cuerpo</label>
          <textarea
            className="ce-paso-editor-textarea"
            value={currentCuerpo}
            onChange={handleCuerpoChange}
            placeholder="Escribe el cuerpo del email..."
            rows={8}
          />
          <div className="ce-paso-editor-char-count">
            {currentCuerpo.length} caracteres
          </div>
        </div>

        <VariableHelp onInsert={handleInsertVariable} />
      </div>
    </div>
  );
}
