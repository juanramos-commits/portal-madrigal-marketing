import { useState } from 'react'
import Toggle from '../ui/Toggle'
import Select from '../ui/Select'
import Modal from '../ui/Modal'

const BASE_URL = 'https://app.madrigalmarketing.es/reservar/'

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vc-icon-sm" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vc-icon-sm" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vc-icon-sm" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function CalendarioEnlaces({
  enlaces,
  setters,
  onCrear,
  onActualizar,
  onEliminar,
}) {
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [nombre, setNombre] = useState('')
  const [slug, setSlug] = useState('')
  const [setterId, setSetterId] = useState('')
  const [fuente, setFuente] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(null)

  const abrirNuevo = () => {
    setEditando(null)
    setNombre('')
    setSlug('')
    setSetterId('')
    setFuente('')
    setError(null)
    setShowModal(true)
  }

  const abrirEditar = (enlace) => {
    setEditando(enlace)
    setNombre(enlace.nombre || '')
    setSlug(enlace.slug || '')
    setSetterId(enlace.setter_id || '')
    setFuente(enlace.fuente || '')
    setError(null)
    setShowModal(true)
  }

  const handleNombreChange = (val) => {
    setNombre(val)
    if (!editando) setSlug(slugify(val))
  }

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!slug.trim()) { setError('El slug es obligatorio'); return }

    setSaving(true)
    setError(null)
    try {
      if (editando) {
        await onActualizar(editando.id, { nombre, slug, setter_id: setterId || null, fuente: fuente || null })
      } else {
        await onCrear({ nombre, slug, setter_id: setterId || null, fuente: fuente || null })
      }
      setShowModal(false)
    } catch (e) {
      setError(e.message || 'Error al guardar enlace')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActivo = async (enlace) => {
    try {
      await onActualizar(enlace.id, { activo: !enlace.activo })
    } catch (err) {
      console.warn('Error al cambiar estado del enlace:', err)
    }
  }

  const handleEliminar = async (id) => {
    try {
      await onEliminar(id)
    } catch (err) {
      console.warn('Error al eliminar enlace:', err)
    }
  }

  const copiarUrl = (slug) => {
    navigator.clipboard.writeText(BASE_URL + slug)
    setCopiado(slug)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <div className="vc-enlaces">
      <div className="vc-enlaces-header">
        <h3>Enlaces de agenda</h3>
        <button className="vc-btn-sm" onClick={abrirNuevo}>
          <PlusIcon /> Nuevo enlace
        </button>
      </div>

      {enlaces.length === 0 ? (
        <div className="vc-empty">No hay enlaces de agenda configurados</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="vc-desktop-only">
            <div className="vc-table-wrap">
              <table className="vc-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Slug</th>
                    <th>Setter</th>
                    <th>Fuente</th>
                    <th>Estado</th>
                    <th>URL</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {enlaces.map(e => (
                    <tr key={e.id}>
                      <td className="vc-cell-bold">{e.nombre}</td>
                      <td className="vc-cell-slug">{e.slug}</td>
                      <td>{e.setter?.nombre || e.setter?.email || 'Sin setter'}</td>
                      <td>{e.fuente || '-'}</td>
                      <td>
                        <Toggle checked={e.activo} onChange={() => handleToggleActivo(e)} />
                      </td>
                      <td>
                        <button className="vc-btn-copy" onClick={() => copiarUrl(e.slug)}>
                          <CopyIcon /> {copiado === e.slug ? '¡Copiado!' : 'Copiar'}
                        </button>
                      </td>
                      <td>
                        <div className="vc-actions-cell">
                          <button className="vc-btn-sm" onClick={() => abrirEditar(e)}>Editar</button>
                          <button className="vc-btn-icon-danger" onClick={() => handleEliminar(e.id)}><TrashIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="vc-mobile-only">
            {enlaces.map(e => (
              <div key={e.id} className="vc-enlace-card">
                <div className="vc-enlace-card-top">
                  <span className="vc-cell-bold">{e.nombre}</span>
                  <Toggle checked={e.activo} onChange={() => handleToggleActivo(e)} />
                </div>
                <div className="vc-enlace-card-meta">
                  <span>/{e.slug}</span>
                  {e.setter && <span>{e.setter.nombre || e.setter.email}</span>}
                  {e.fuente && <span>{e.fuente}</span>}
                </div>
                <div className="vc-enlace-card-actions">
                  <button className="vc-btn-copy" onClick={() => copiarUrl(e.slug)}>
                    <CopyIcon /> {copiado === e.slug ? '¡Copiado!' : 'Copiar URL'}
                  </button>
                  <button className="vc-btn-sm" onClick={() => abrirEditar(e)}>Editar</button>
                  <button className="vc-btn-icon-danger" onClick={() => handleEliminar(e.id)}><TrashIcon /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editando ? 'Editar enlace' : 'Nuevo enlace'}
        size="sm"
        footer={
          <>
            <button className="vc-btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
            <button className="vc-btn-primary" onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear enlace'}
            </button>
          </>
        }
      >
        <div className="vc-field">
          <label>Nombre *</label>
          <input type="text" value={nombre} onChange={e => handleNombreChange(e.target.value)} placeholder="Ej: Enlace Setter Mireia" aria-label="Nombre del enlace" />
        </div>
        <div className="vc-field">
          <label>Slug *</label>
          <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="enlace-setter-mireia" aria-label="Slug del enlace" />
          <span className="vc-field-hint">{BASE_URL}{slug || '...'}</span>
        </div>
        <div className="vc-field">
          <label>Setter vinculado</label>
          <Select value={setterId} onChange={e => setSetterId(e.target.value)}>
            <option value="">Ninguno</option>
            {setters?.map(s => (
              <option key={s.id} value={s.id}>{s.nombre || s.email}</option>
            ))}
          </Select>
        </div>
        <div className="vc-field">
          <label>Fuente</label>
          <input type="text" value={fuente} onChange={e => setFuente(e.target.value)} placeholder="Ej: Instagram, Email Marketing..." aria-label="Fuente del enlace" />
        </div>
        {error && <div className="vc-error-msg">{error}</div>}
      </Modal>
    </div>
  )
}
