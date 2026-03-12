import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react'
import '../../styles/agentes-ia.css'

function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

export default function ImportarLeadsModal({ open, onClose, agenteId }) {
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  if (!open) return null

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return

    setFile(f)
    setResult(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const text = evt.target.result
        const data = parseCSV(text)

        // Validate headers
        const required = ['telefono']
        const missing = required.filter(h => !data.headers.includes(h))
        if (missing.length > 0) {
          setError(`Faltan columnas requeridas: ${missing.join(', ')}. Esperado: telefono,nombre,email,servicio`)
          setParsed(null)
          return
        }

        setParsed(data)
      } catch (err) {
        setError('Error al parsear el archivo: ' + err.message)
        setParsed(null)
      }
    }
    reader.readAsText(f)
  }

  const handleImportar = async () => {
    if (!parsed || !agenteId) return
    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData?.session
      if (!session?.access_token) {
        throw new Error('Sesion expirada, recarga la pagina')
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL no configurado')
      }

      const res = await fetch(
        `${supabaseUrl}/functions/v1/ia-importar-leads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            agente_id: agenteId,
            leads: parsed.rows,
          }),
        }
      )

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error importando leads')
      }

      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setParsed(null)
    setResult(null)
    setError(null)
    onClose()
  }

  const previewRows = parsed ? parsed.rows.slice(0, 5) : []

  return (
    <div className="ia-modal-overlay" onClick={handleClose}>
      <div className="ia-modal ia-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="ia-modal-header">
          <h2>Importar leads</h2>
          <button className="ia-modal-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="ia-import-result">
            <CheckCircle size={40} style={{ color: '#10b981' }} />
            <h3>Importacion completada</h3>
            <div className="ia-import-result-stats">
              <div className="ia-import-result-stat">
                <span className="ia-import-result-value" style={{ color: '#10b981' }}>{result.imported || 0}</span>
                <span className="ia-import-result-label">Importados</span>
              </div>
              <div className="ia-import-result-stat">
                <span className="ia-import-result-value" style={{ color: '#f59e0b' }}>{result.skipped || 0}</span>
                <span className="ia-import-result-label">Omitidos</span>
              </div>
              <div className="ia-import-result-stat">
                <span className="ia-import-result-value" style={{ color: '#ef4444' }}>{result.errors || 0}</span>
                <span className="ia-import-result-label">Errores</span>
              </div>
            </div>
            <button className="ia-btn ia-btn-primary" onClick={handleClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {/* File input */}
            <div className="ia-import-dropzone" onClick={() => inputRef.current?.click()}>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <Upload size={32} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
              <p>{file ? file.name : 'Selecciona un archivo CSV o XLSX'}</p>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Formato: telefono,nombre,email,servicio
              </span>
            </div>

            {error && (
              <div className="ia-import-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Preview table */}
            {parsed && previewRows.length > 0 && (
              <div className="ia-import-preview">
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Vista previa ({parsed.rows.length} filas totales, mostrando {previewRows.length})
                </p>
                <div className="ia-table-wrapper">
                  <table className="ia-table">
                    <thead>
                      <tr>
                        {parsed.headers.map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i}>
                          {parsed.headers.map(h => (
                            <td key={h}>{row[h] || ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="ia-modal-actions">
              <button type="button" className="ia-btn ia-btn-secondary" onClick={handleClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="ia-btn ia-btn-primary"
                onClick={handleImportar}
                disabled={!parsed || importing}
              >
                <FileText size={14} />
                {importing ? 'Importando...' : `Importar ${parsed ? parsed.rows.length : 0} leads`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
