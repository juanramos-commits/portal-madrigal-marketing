import { useState, useCallback, useRef } from 'react';

const KNOWN_COLUMNS = ['email', 'nombre', 'empresa', 'cargo', 'telefono'];

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(separator).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(separator).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    if (vals.length === headers.length && vals.some((v) => v)) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = vals[idx] || '';
      });
      rows.push(row);
    }
  }

  return { headers, rows };
}

function autoDetectMapping(headers) {
  const mapping = {};
  for (const col of KNOWN_COLUMNS) {
    const match = headers.find(
      (h) => h.toLowerCase().replace(/[^a-z]/g, '') === col
    );
    if (match) mapping[col] = match;
  }

  if (!mapping.email) {
    const emailHeader = headers.find((h) =>
      /e[-_]?mail|correo/i.test(h)
    );
    if (emailHeader) mapping.email = emailHeader;
  }
  if (!mapping.nombre) {
    const nameHeader = headers.find((h) =>
      /name|nombre|contacto/i.test(h)
    );
    if (nameHeader) mapping.nombre = nameHeader;
  }
  if (!mapping.empresa) {
    const companyHeader = headers.find((h) =>
      /company|empresa|negocio|organizacion/i.test(h)
    );
    if (companyHeader) mapping.empresa = companyHeader;
  }

  return mapping;
}

function applyMapping(rows, mapping) {
  return rows.map((row) => {
    const mapped = {};
    for (const [targetCol, sourceCol] of Object.entries(mapping)) {
      mapped[targetCol] = row[sourceCol] || '';
    }
    return mapped;
  });
}

function downloadTemplate() {
  const header = KNOWN_COLUMNS.join(',');
  const example = 'juan@ejemplo.com,Juan Garcia,Acme Corp,Director,+34600000000';
  const blob = new Blob([header + '\n' + example + '\n'], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_contactos.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportarCSVModal({ open, onClose, onImport }) {
  if (!open) return null;

  const fileRef = useRef(null);
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState('');

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const result = parseCSV(evt.target.result);
        if (result.rows.length === 0) {
          setError('El archivo CSV está vacío o no se pudo leer.');
          setParsed(null);
          return;
        }
        setParsed(result);
        setMapping(autoDetectMapping(result.headers));
      } catch {
        setError('Error al leer el archivo CSV.');
        setParsed(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleMappingChange = useCallback(
    (targetCol, sourceCol) => {
      setMapping((prev) => ({
        ...prev,
        [targetCol]: sourceCol || undefined,
      }));
    },
    []
  );

  const handleImport = useCallback(() => {
    if (!parsed) return;
    const mapped = applyMapping(parsed.rows, mapping);
    onImport(mapped);
  }, [parsed, mapping, onImport]);

  const handleClose = useCallback(() => {
    setParsed(null);
    setMapping({});
    setError('');
    onClose();
  }, [onClose]);

  const previewRows = parsed ? parsed.rows.slice(0, 5) : [];
  const hasEmail = Boolean(mapping.email);

  return (
    <div className="ce-modal-overlay" onClick={handleClose}>
      <div
        className="ce-modal ce-modal--importar-csv"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ce-modal-header">
          <h3 className="ce-modal-title">Importar contactos desde CSV</h3>
          <button
            type="button"
            className="ce-modal-close"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        <div className="ce-modal-body">
          <div className="ce-csv-upload">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="ce-csv-file-input"
              onChange={handleFile}
            />
            <button
              type="button"
              className="ce-btn ce-btn--link ce-btn-sm"
              onClick={downloadTemplate}
            >
              Descargar plantilla CSV
            </button>
          </div>

          {error && <div className="ce-csv-error">{error}</div>}

          {parsed && (
            <>
              <div className="ce-csv-count">
                {parsed.rows.length} contactos encontrados
              </div>

              <div className="ce-csv-mapping">
                <h4 className="ce-csv-mapping-title">Mapeo de columnas</h4>
                {KNOWN_COLUMNS.map((col) => (
                  <div key={col} className="ce-csv-mapping-row">
                    <label className="ce-csv-mapping-label">{col}</label>
                    <select
                      className="ce-csv-mapping-select"
                      value={mapping[col] || ''}
                      onChange={(e) =>
                        handleMappingChange(col, e.target.value)
                      }
                    >
                      <option value="">— No mapear —</option>
                      {parsed.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {previewRows.length > 0 && (
                <div className="ce-csv-preview">
                  <h4 className="ce-csv-preview-title">
                    Vista previa (primeras {previewRows.length} filas)
                  </h4>
                  <div className="ce-csv-preview-table-wrapper">
                    <table className="ce-csv-preview-table">
                      <thead>
                        <tr>
                          {parsed.headers.map((h) => (
                            <th key={h} className="ce-csv-preview-th">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {parsed.headers.map((h) => (
                              <td key={h} className="ce-csv-preview-td">
                                {row[h] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!hasEmail && (
                <div className="ce-csv-warning">
                  No se detectó columna de email. Mapea al menos la columna
                  email para importar.
                </div>
              )}
            </>
          )}
        </div>

        <div className="ce-modal-footer">
          <button
            type="button"
            className="ce-btn ce-btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="ce-btn ce-btn--primary"
            onClick={handleImport}
            disabled={!parsed || !hasEmail}
          >
            Importar
          </button>
        </div>
      </div>
    </div>
  );
}
