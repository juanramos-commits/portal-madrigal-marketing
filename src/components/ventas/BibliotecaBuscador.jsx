const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export default function BibliotecaBuscador({ busqueda, onBusquedaChange }) {
  return (
    <div className="bib-buscador" role="search">
      <div className="bib-buscador-icono" aria-hidden="true">
        <SearchIcon />
      </div>
      <input
        type="text"
        className="bib-buscador-input"
        placeholder="Buscar recursos..."
        aria-label="Buscar recursos en la biblioteca"
        value={busqueda}
        onChange={e => onBusquedaChange(e.target.value)}
      />
      {busqueda && (
        <button
          className="bib-buscador-clear"
          onClick={() => onBusquedaChange('')}
          aria-label="Limpiar búsqueda"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  )
}
