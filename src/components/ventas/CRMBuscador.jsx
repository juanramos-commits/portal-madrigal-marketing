const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
)

export default function CRMBuscador({ value, onChange }) {
  return (
    <div className="crm-search">
      <SearchIcon />
      <input
        type="text"
        placeholder="Buscar por nombre o teléfono..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
