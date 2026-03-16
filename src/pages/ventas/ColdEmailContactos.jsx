import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCEContactos } from '../../hooks/useCEContactos'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

const ESTADOS = ['todos', 'activo', 'respondido', 'rebotado', 'baja', 'no_contactar']
const PAGE_SIZE = 25

export default function ColdEmailContactos() {
  const { tienePermiso } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTag, setFiltroTag] = useState('')
  const [pagina, setPagina] = useState(1)
  const [showImportCSV, setShowImportCSV] = useState(false)
  const [showImportSheets, setShowImportSheets] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [sheetsUrl, setSheetsUrl] = useState('')
  const [importando, setImportando] = useState(false)

  const {
    contactos,
    total,
    tags,
    loading,
    error,
    importarCSV,
    importarSheets,
  } = useCEContactos({
    busqueda,
    estado: filtroEstado === 'todos' ? null : filtroEstado,
    tag: filtroTag || null,
    pagina,
    porPagina: PAGE_SIZE,
  })

  const totalPages = Math.ceil((total || 0) / PAGE_SIZE)

  const handleSearch = useCallback((e) => {
    setBusqueda(e.target.value)
    setPagina(1)
  }, [])

  const handleImportCSV = async () => {
    if (!csvFile) return
    setImportando(true)
    try {
      const result = await importarCSV(csvFile)
      addToast(`${result?.importados ?? 0} contactos importados`, 'success')
      setShowImportCSV(false)
      setCsvFile(null)
    } catch (err) {
      addToast(`Error al importar: ${err.message}`, 'error')
    } finally {
      setImportando(false)
    }
  }

  const handleImportSheets = async () => {
    if (!sheetsUrl.trim()) return
    setImportando(true)
    try {
      const result = await importarSheets(sheetsUrl.trim())
      addToast(`${result?.importados ?? 0} contactos importados`, 'success')
      setShowImportSheets(false)
      setSheetsUrl('')
    } catch (err) {
      addToast(`Error al importar: ${err.message}`, 'error')
    } finally {
      setImportando(false)
    }
  }

  if (!tienePermiso('cold_email.contactos.ver')) {
    return (
      <div className="ce-page">
        <div className="ce-error" role="alert">No tienes permiso para ver contactos.</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="ce-page">
        <div className="ce-loading" role="status">
          <div className="ce-spinner" aria-hidden="true" />
          <span>Cargando contactos...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ce-page">
        <div className="ce-error" role="alert">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="ce-page">
      <div className="ce-page-header">
        <h1 className="ce-page-title">Contactos</h1>
        <div className="ce-page-actions">
          {tienePermiso('cold_email.contactos.crear') && (
            <>
              <button className="ce-btn ce-btn-secondary" onClick={() => setShowImportCSV(true)}>
                Importar CSV
              </button>
              <button className="ce-btn ce-btn-secondary" onClick={() => setShowImportSheets(true)}>
                Importar Sheets
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="ce-filters">
        <input
          type="text"
          className="ce-search-input"
          placeholder="Buscar por nombre, email o empresa..."
          value={busqueda}
          onChange={handleSearch}
        />
        <div className="ce-filter-pills">
          {ESTADOS.map((e) => (
            <button
              key={e}
              className={`ce-pill ${filtroEstado === e ? 'ce-pill-active' : ''}`}
              onClick={() => { setFiltroEstado(e); setPagina(1) }}
            >
              {e === 'todos' ? 'Todos' : e.replace('_', ' ')}
            </button>
          ))}
        </div>
        {tags?.length > 0 && (
          <select
            className="ce-select"
            value={filtroTag}
            onChange={(e) => { setFiltroTag(e.target.value); setPagina(1) }}
          >
            <option value="">Todas las etiquetas</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {contactos?.length > 0 ? (
        <>
          <div className="ce-table-wrapper">
            <table className="ce-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Etiquetas</th>
                  <th>MX</th>
                  <th>Ultima actividad</th>
                </tr>
              </thead>
              <tbody>
                {contactos.map((c) => (
                  <tr
                    key={c.id}
                    className="ce-table-row-clickable"
                    onClick={() => navigate(`/cold-email/contactos/${c.id}`)}
                  >
                    <td className="ce-td-name">{c.nombre || '---'}</td>
                    <td>{c.email}</td>
                    <td>{c.empresa || '---'}</td>
                    <td>
                      <span className={`ce-badge ce-badge-${c.estado || 'activo'}`}>
                        {c.estado || 'activo'}
                      </span>
                    </td>
                    <td>
                      <div className="ce-tag-list">
                        {(c.etiquetas || []).slice(0, 3).map((t) => (
                          <span key={t} className="ce-tag">{t}</span>
                        ))}
                        {(c.etiquetas || []).length > 3 && (
                          <span className="ce-tag ce-tag-more">+{c.etiquetas.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {c.mx_valido === true && <span className="ce-badge ce-badge-ok">OK</span>}
                      {c.mx_valido === false && <span className="ce-badge ce-badge-fail">Fail</span>}
                      {c.mx_valido == null && <span className="ce-text-muted">---</span>}
                    </td>
                    <td className="ce-text-muted">
                      {c.ultima_actividad
                        ? new Date(c.ultima_actividad).toLocaleDateString('es-ES')
                        : '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="ce-pagination">
            <button
              className="ce-btn ce-btn-sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </button>
            <span className="ce-pagination-info">
              Pagina {pagina} de {totalPages} ({total} contactos)
            </span>
            <button
              className="ce-btn ce-btn-sm"
              disabled={pagina >= totalPages}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      ) : (
        <div className="ce-empty">
          <div className="ce-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <p>No se encontraron contactos.</p>
          {tienePermiso('cold_email.contactos.crear') && (
            <p className="ce-text-muted">Importa contactos con CSV o Google Sheets para comenzar.</p>
          )}
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportCSV && (
        <div className="ce-modal-overlay" onClick={() => setShowImportCSV(false)}>
          <div className="ce-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ce-modal-header">
              <h3>Importar CSV</h3>
              <button className="ce-modal-close" onClick={() => setShowImportCSV(false)}>&times;</button>
            </div>
            <div className="ce-modal-body">
              <p className="ce-text-muted">
                El CSV debe contener columnas: email (requerido), nombre, empresa, cargo, telefono, etiquetas.
              </p>
              <input
                type="file"
                accept=".csv"
                className="ce-file-input"
                onChange={(e) => setCsvFile(e.target.files[0] || null)}
              />
            </div>
            <div className="ce-modal-footer">
              <button className="ce-btn ce-btn-secondary" onClick={() => setShowImportCSV(false)}>
                Cancelar
              </button>
              <button
                className="ce-btn ce-btn-primary"
                disabled={!csvFile || importando}
                onClick={handleImportCSV}
              >
                {importando ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Sheets Modal */}
      {showImportSheets && (
        <div className="ce-modal-overlay" onClick={() => setShowImportSheets(false)}>
          <div className="ce-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ce-modal-header">
              <h3>Importar desde Google Sheets</h3>
              <button className="ce-modal-close" onClick={() => setShowImportSheets(false)}>&times;</button>
            </div>
            <div className="ce-modal-body">
              <p className="ce-text-muted">
                Pega la URL de la hoja de calculo. Debe tener permisos de acceso publico o compartida.
              </p>
              <input
                type="url"
                className="ce-input"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
              />
            </div>
            <div className="ce-modal-footer">
              <button className="ce-btn ce-btn-secondary" onClick={() => setShowImportSheets(false)}>
                Cancelar
              </button>
              <button
                className="ce-btn ce-btn-primary"
                disabled={!sheetsUrl.trim() || importando}
                onClick={handleImportSheets}
              >
                {importando ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
