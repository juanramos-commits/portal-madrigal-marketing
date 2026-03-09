export default function BlockRenderer({ block }) {
  if (!block) return null

  switch (block.type) {
    case 'header':
      return (
        <div style={{ textAlign: 'center', padding: 'var(--space-md) 0' }}>
          <h2 style={{
            fontSize: 'var(--font-xl)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--text)',
            margin: 0,
          }}>
            {block.content}
          </h2>
        </div>
      )

    case 'text':
      return (
        <p style={{
          fontSize: 'var(--font-base)',
          color: 'var(--text)',
          lineHeight: 'var(--leading-relaxed)',
          margin: 'var(--space-sm) 0',
          whiteSpace: 'pre-wrap',
        }}>
          {block.content}
        </p>
      )

    case 'cta':
      return (
        <div style={{ textAlign: 'center', padding: 'var(--space-md) 0' }}>
          <a
            href={block.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: 'var(--space-sm) var(--space-lg)',
              background: '#2ee59d',
              color: '#000',
              fontWeight: 600,
              fontSize: 'var(--font-sm)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
            }}
          >
            {block.content || 'Click aquí'}
          </a>
        </div>
      )

    case 'image':
      return (
        <div style={{ textAlign: 'center', padding: 'var(--space-sm) 0' }}>
          <img
            src={block.content}
            alt=""
            style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)', display: 'block', margin: '0 auto' }}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      )

    case 'divider':
      return (
        <hr style={{
          border: 'none',
          borderTop: '1px solid var(--border)',
          margin: 'var(--space-md) 0',
        }} />
      )

    case 'footer':
      return (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-md) 0',
          fontSize: 'var(--font-xs)',
          color: 'var(--text-muted)',
          lineHeight: 'var(--leading-normal)',
        }}>
          {block.content}
        </div>
      )

    default:
      return (
        <div style={{ padding: 'var(--space-sm)', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
          Bloque desconocido: {block.type}
        </div>
      )
  }
}
