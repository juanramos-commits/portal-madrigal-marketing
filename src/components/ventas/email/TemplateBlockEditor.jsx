import { useCallback } from 'react'
import BlockRenderer from './BlockRenderer'

const DEFAULT_AVAILABLE = [
  { type: 'header', label: 'Encabezado', icon: 'H', group: 'Contenido' },
  { type: 'text', label: 'Texto', icon: '¶', group: 'Contenido' },
  { type: 'cta', label: 'Botón CTA', icon: '▶', group: 'Contenido' },
  { type: 'image', label: 'Imagen', icon: '🖼', group: 'Media' },
  { type: 'divider', label: 'Separador', icon: '—', group: 'Estructura' },
  { type: 'footer', label: 'Pie de email', icon: '⌄', group: 'Estructura' },
]

function getDefaultContent(type) {
  switch (type) {
    case 'header': return 'Título del email'
    case 'text': return 'Escribe tu contenido aquí...'
    case 'cta': return 'Ver más'
    case 'image': return 'https://via.placeholder.com/600x200'
    case 'divider': return ''
    case 'footer': return 'Tu empresa · Dirección · Desuscribirse'
    default: return ''
  }
}

export default function TemplateBlockEditor({ blocks = [], onChange, availableBlocks }) {
  const catalog = availableBlocks || DEFAULT_AVAILABLE

  const groups = catalog.reduce((acc, b) => {
    const g = b.group || 'General'
    if (!acc[g]) acc[g] = []
    acc[g].push(b)
    return acc
  }, {})

  const addBlock = useCallback((type) => {
    onChange([...blocks, { type, content: getDefaultContent(type), styles: {}, url: '' }])
  }, [blocks, onChange])

  const updateBlock = useCallback((idx, field, value) => {
    const next = blocks.map((b, i) => i === idx ? { ...b, [field]: value } : b)
    onChange(next)
  }, [blocks, onChange])

  const removeBlock = useCallback((idx) => {
    onChange(blocks.filter((_, i) => i !== idx))
  }, [blocks, onChange])

  const moveBlock = useCallback((idx, dir) => {
    const target = idx + dir
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    const temp = next[idx]
    next[idx] = next[target]
    next[target] = temp
    onChange(next)
  }, [blocks, onChange])

  return (
    <div className="ve-block-editor">
      {/* Sidebar */}
      <div className="ve-block-sidebar">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <h4>{group}</h4>
            {items.map(item => (
              <button
                key={item.type}
                className="ve-block-item"
                onClick={() => addBlock(item.type)}
              >
                <span className="ve-block-item-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="ve-block-canvas">
        {blocks.length === 0 && (
          <div className="ve-empty">
            <p>Añade bloques desde el panel izquierdo</p>
          </div>
        )}
        {blocks.map((block, idx) => (
          <div key={idx} className="ve-block-card">
            <div className="ve-block-card-header">
              <span className="ve-block-card-type">{block.type}</span>
              <div className="ve-block-actions">
                <button
                  className="ve-btn ve-btn--icon ve-btn--sm"
                  onClick={() => moveBlock(idx, -1)}
                  disabled={idx === 0}
                  title="Subir"
                >
                  ↑
                </button>
                <button
                  className="ve-btn ve-btn--icon ve-btn--sm"
                  onClick={() => moveBlock(idx, 1)}
                  disabled={idx === blocks.length - 1}
                  title="Bajar"
                >
                  ↓
                </button>
                <button
                  className="ve-btn ve-btn--icon ve-btn--sm"
                  onClick={() => removeBlock(idx)}
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>
            </div>

            {block.type === 'divider' ? (
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 'var(--space-sm) 0' }} />
            ) : block.type === 'image' ? null : (
              <textarea
                className="ve-block-content"
                value={block.content}
                onChange={e => updateBlock(idx, 'content', e.target.value)}
                rows={block.type === 'text' ? 3 : 1}
                style={{ width: '100%', resize: 'vertical' }}
              />
            )}

            {block.type === 'cta' && (
              <input
                className="ve-input"
                placeholder="URL del botón"
                value={block.url || ''}
                onChange={e => updateBlock(idx, 'url', e.target.value)}
                style={{ marginTop: 'var(--space-xs)' }}
              />
            )}

            {block.type === 'image' && (
              <input
                className="ve-input"
                placeholder="URL de la imagen"
                value={block.content || ''}
                onChange={e => updateBlock(idx, 'content', e.target.value)}
                style={{ marginTop: 'var(--space-xs)' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="ve-block-preview">
        <h4 style={{
          fontSize: 'var(--font-xs)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 'var(--space-sm)',
        }}>
          Vista previa
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          {blocks.map((block, idx) => (
            <BlockRenderer key={idx} block={block} />
          ))}
        </div>
      </div>
    </div>
  )
}
