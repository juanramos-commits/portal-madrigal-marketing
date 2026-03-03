import { Search, X } from 'lucide-react'

export default function CRMBuscador({ value, onChange, resultCount }) {
  return (
    <div className="crm-search" role="search">
      <Search aria-hidden="true" />
      <input
        type="text"
        placeholder="Buscar en todos los campos..."
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Buscar leads"
      />
      {value && resultCount !== null && resultCount !== undefined && (
        <span className="crm-search-count" role="status" aria-live="polite">
          {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
        </span>
      )}
      {value && (
        <button
          className="crm-search-clear"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
