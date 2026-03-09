import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useOutreachLists } from '../../hooks/useOutreachLists'
import '../../styles/ventas-email.css'

const SOURCE_COLORS = {
  manual: 've-badge--gray',
  import: 've-badge--blue',
  scraper: 've-badge--yellow',
  api: 've-badge--green',
}

const EMPTY_FORM = { name: '', description: '', source: 'manual', tags: '' }

export default function OutreachLists() {
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { lists, loading, cargar, crear } = useOutreachLists()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!tienePermiso('ventas.outreach.listas.ver')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para ver esta sección.</div>
      </div>
    )
  }

  const handleCreate = async () => {
    try {
      const tags = form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
      await crear({ ...form, tags })
      showToast('Lista creada correctamente', 'success')
      setShowModal(false)
      setForm(EMPTY_FORM)
      cargar()
    } catch (err) {
      showToast(err.message || 'Error al crear lista', 'error')
    }
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>Listas Outreach</h1>
        {tienePermiso('ventas.outreach.listas.crear') && (
          <button className="ve-btn ve-btn--primary" onClick={() => setShowModal(true)}>
            Nueva Lista
          </button>
        )}
      </div>

      {loading ? (
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando listas...</span>
        </div>
      ) : lists.length === 0 ? (
        <div className="ve-empty">No hay listas creadas.</div>
      ) : (
        <div className="ve-kpi-grid">
          {lists.map((list) => (
            <div
              key={list.id}
              className="ve-kpi-card ve-table-row--clickable"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/ventas/outreach/listas/${list.id}`)}
            >
              <span className="ve-kpi-label">{list.name}</span>
              {list.description && (
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{list.description}</span>
              )}
              <span className="ve-kpi-value">{list.total_contacts ?? 0} contactos</span>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <span className={`ve-badge ${SOURCE_COLORS[list.source] || 've-badge--gray'}`}>
                  {list.source || 'manual'}
                </span>
                {(list.tags ?? []).map((tag) => (
                  <span key={tag} className="ve-badge ve-badge--gray">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="ve-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ve-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nueva Lista</h2>
            <div className="ve-form-group">
              <label className="ve-label">Nombre</label>
              <input
                type="text"
                className="ve-input"
                placeholder="Mi lista de prospectos"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="ve-form-group">
              <label className="ve-label">Descripción</label>
              <textarea
                className="ve-input"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="ve-form-group">
              <label className="ve-label">Fuente</label>
              <select
                className="ve-select"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                <option value="manual">Manual</option>
                <option value="import">Importación</option>
                <option value="scraper">Scraper</option>
                <option value="api">API</option>
              </select>
            </div>
            <div className="ve-form-group">
              <label className="ve-label">Tags (separados por coma)</label>
              <input
                type="text"
                className="ve-input"
                placeholder="b2b, tech, spain"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div className="ve-modal-actions">
              <button className="ve-btn" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="ve-btn ve-btn--primary" onClick={handleCreate}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
