import { memo, useState, useMemo, useCallback } from 'react';
import EstadoBadge from './EstadoBadge';

const ContactoRow = memo(function ContactoRow({
  contacto,
  selected,
  onClick,
  compact,
}) {
  const rowClass = `ce-contactos-row${selected ? ' ce-contactos-row--selected' : ''}`;

  return (
    <tr className={rowClass} onClick={() => onClick(contacto)}>
      <td className="ce-contactos-cell ce-contactos-cell--check">
        <input
          type="checkbox"
          checked={selected}
          readOnly
          className="ce-contactos-checkbox"
        />
      </td>
      <td className="ce-contactos-cell">{contacto.nombre || '—'}</td>
      <td className="ce-contactos-cell">{contacto.email || '—'}</td>
      {!compact && (
        <td className="ce-contactos-cell">{contacto.empresa || '—'}</td>
      )}
      <td className="ce-contactos-cell">
        <EstadoBadge estado={contacto.estado} tipo="contacto" />
      </td>
      {!compact && (
        <>
          <td className="ce-contactos-cell">
            {contacto.etiquetas?.length > 0 ? (
              <div className="ce-contactos-tags">
                {contacto.etiquetas.map((et) => (
                  <span key={et} className="ce-contactos-tag">
                    {et}
                  </span>
                ))}
              </div>
            ) : (
              '—'
            )}
          </td>
          <td className="ce-contactos-cell ce-contactos-cell--mx">
            {contacto.mx_valido != null ? (
              <span
                className={`ce-mx-indicator ${contacto.mx_valido ? 'ce-mx-indicator--ok' : 'ce-mx-indicator--fail'}`}
              >
                {contacto.mx_valido ? 'OK' : 'Fail'}
              </span>
            ) : (
              '—'
            )}
          </td>
        </>
      )}
    </tr>
  );
});

function ContactosTabla({
  contactos = [],
  loading,
  onSelect,
  selectedId,
  compact,
}) {
  const [sortKey, setSortKey] = useState('nombre');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = useCallback(
    (key) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  const sorted = useMemo(() => {
    const copy = [...contactos];
    copy.sort((a, b) => {
      const va = (a[sortKey] || '').toString().toLowerCase();
      const vb = (b[sortKey] || '').toString().toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [contactos, sortKey, sortDir]);

  const sortIndicator = (key) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  if (loading) {
    return (
      <div className="ce-contactos-loading">Cargando contactos...</div>
    );
  }

  if (contactos.length === 0) {
    return (
      <div className="ce-contactos-empty">No hay contactos para mostrar.</div>
    );
  }

  return (
    <div className="ce-contactos-tabla-wrapper">
      <table className="ce-contactos-tabla">
        <thead>
          <tr>
            <th className="ce-contactos-th ce-contactos-th--check" />
            <th
              className="ce-contactos-th"
              onClick={() => handleSort('nombre')}
            >
              Nombre{sortIndicator('nombre')}
            </th>
            <th
              className="ce-contactos-th"
              onClick={() => handleSort('email')}
            >
              Email{sortIndicator('email')}
            </th>
            {!compact && (
              <th
                className="ce-contactos-th"
                onClick={() => handleSort('empresa')}
              >
                Empresa{sortIndicator('empresa')}
              </th>
            )}
            <th
              className="ce-contactos-th"
              onClick={() => handleSort('estado')}
            >
              Estado{sortIndicator('estado')}
            </th>
            {!compact && (
              <>
                <th className="ce-contactos-th">Etiquetas</th>
                <th className="ce-contactos-th">MX</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <ContactoRow
              key={c.id || c.email}
              contacto={c}
              selected={selectedId === (c.id || c.email)}
              onClick={onSelect}
              compact={compact}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(ContactosTabla);
