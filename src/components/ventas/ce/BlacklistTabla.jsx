import { useState, useCallback, memo } from 'react';

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const BlacklistRow = memo(function BlacklistRow({ item, onDelete }) {
  return (
    <tr className="ce-blacklist-row">
      <td className="ce-blacklist-cell">
        <span className={`ce-blacklist-tipo ce-blacklist-tipo--${item.tipo}`}>
          {item.tipo}
        </span>
      </td>
      <td className="ce-blacklist-cell">{item.valor}</td>
      <td className="ce-blacklist-cell">{item.motivo || '—'}</td>
      <td className="ce-blacklist-cell">{formatDate(item.created_at)}</td>
      <td className="ce-blacklist-cell ce-blacklist-cell--actions">
        <button
          type="button"
          className="ce-btn ce-btn--small ce-btn--danger"
          onClick={() => onDelete(item.id)}
          title="Eliminar"
        >
          ×
        </button>
      </td>
    </tr>
  );
});

function BlacklistTabla({ items = [], onAdd, onDelete, loading }) {
  const [tipo, setTipo] = useState('dominio');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');

  const handleAdd = useCallback(
    (e) => {
      e.preventDefault();
      if (!valor.trim()) return;
      onAdd(tipo, valor.trim(), motivo.trim());
      setValor('');
      setMotivo('');
    },
    [tipo, valor, motivo, onAdd]
  );

  return (
    <div className="ce-blacklist">
      <form className="ce-blacklist-add" onSubmit={handleAdd}>
        <select
          className="ce-blacklist-select"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="dominio">Dominio</option>
          <option value="email">Email</option>
        </select>
        <input
          type="text"
          className="ce-blacklist-input"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={tipo === 'dominio' ? 'ejemplo.com' : 'user@ejemplo.com'}
          required
        />
        <input
          type="text"
          className="ce-blacklist-input ce-blacklist-input--motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
        />
        <button
          type="submit"
          className="ce-btn ce-btn--primary ce-btn--small"
          disabled={loading}
        >
          Agregar
        </button>
      </form>

      {loading && (
        <div className="ce-blacklist-loading">Cargando...</div>
      )}

      {!loading && items.length === 0 && (
        <div className="ce-blacklist-empty">
          La blacklist está vacía.
        </div>
      )}

      {items.length > 0 && (
        <div className="ce-blacklist-table-wrapper">
          <table className="ce-blacklist-table">
            <thead>
              <tr>
                <th className="ce-blacklist-th">Tipo</th>
                <th className="ce-blacklist-th">Valor</th>
                <th className="ce-blacklist-th">Motivo</th>
                <th className="ce-blacklist-th">Fecha</th>
                <th className="ce-blacklist-th" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <BlacklistRow
                  key={item.id}
                  item={item}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default memo(BlacklistTabla);
