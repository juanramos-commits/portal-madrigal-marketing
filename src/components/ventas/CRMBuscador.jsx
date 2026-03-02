import { Search, X } from 'lucide-react'

export default function CRMBuscador({ value, onChange, resultCount }) {
  return (
    <div className="crm-search" style={{ position: 'relative' }}>
      <Search />
      <input
        type="text"
        placeholder="Buscar en todos los campos..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: 'var(--text-secondary, #6b7280)', display: 'flex', alignItems: 'center',
          }}
          title="Limpiar búsqueda"
        >
          <X size={16} />
        </button>
      )}
      {value && resultCount !== null && resultCount !== undefined && (
        <span
          style={{
            position: 'absolute', right: value ? 32 : 8, top: '50%', transform: 'translateY(-50%)',
            fontSize: 11, color: 'var(--text-secondary, #6b7280)', whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
        </span>
      )}
    </div>
  )
}
