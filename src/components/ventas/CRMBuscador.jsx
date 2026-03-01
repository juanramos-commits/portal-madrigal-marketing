import { Search } from 'lucide-react'

export default function CRMBuscador({ value, onChange }) {
  return (
    <div className="crm-search">
      <Search />
      <input
        type="text"
        placeholder="Buscar por nombre o teléfono..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
