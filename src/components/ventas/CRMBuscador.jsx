import { Search, X } from 'lucide-react'

export default function CRMBuscador({ value, onChange, resultCount }) {
  return (
    <div className="crm-search">
      <Search />
      <input
        type="text"
        placeholder="Buscar en todos los campos..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && resultCount !== null && resultCount !== undefined && (
        <span className="crm-search-count">
          {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
        </span>
      )}
      {value && (
        <button
          className="crm-search-clear"
          onClick={() => onChange('')}
          title="Limpiar búsqueda"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
