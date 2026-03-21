import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, CheckCircle, AlertCircle, X, Users } from 'lucide-react'
import '../../styles/agentes-ia.css'

export default function AsignarLeadsCRMModal({ open, onClose, agenteId }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [assigning, setAssigning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    cargarLeads()
  }, [open])

  const cargarLeads = async () => {
    setLoading(true)
    setError(null)
    try {
      // Get IDs already linked to ia_leads
      const { data: linked } = await supabase
        .from('ia_leads')
        .select('crm_lead_id')
        .not('crm_lead_id', 'is', null)
      const linkedIds = new Set((linked || []).map(l => l.crm_lead_id))

      // Fetch CRM leads with etapa info
      const { data, error: err } = await supabase
        .from('ventas_leads')
        .select('id, nombre, telefono, email, etapa_actual_id')
        .order('created_at', { ascending: false })
        .limit(500)

      if (err) throw err

      // Filter out already linked leads
      const available = (data || []).filter(l => !linkedIds.has(l.id))
      setLeads(available)
    } catch (err) {
      setError('Error cargando leads: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!busqueda.trim()) return leads
    const term = busqueda.toLowerCase()
    return leads.filter(l =>
      (l.nombre || '').toLowerCase().includes(term) ||
      (l.telefono || '').includes(term) ||
      (l.email || '').toLowerCase().includes(term) ||
      (l.email || '').toLowerCase().includes(term)
    )
  }, [leads, busqueda])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(l => l.id)))
    }
  }

  const handleAsignar = async () => {
    if (selected.size === 0) return
    setAssigning(true)
    setError(null)

    let assigned = 0
    let errors = 0
    const errorMessages = []

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData?.session
      if (!session?.access_token) {
        throw new Error('Sesion expirada, recarga la pagina')
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL no configurado')
      }

      const selectedLeads = leads.filter(l => selected.has(l.id))

      for (const lead of selectedLeads) {
        try {
          // 1. Create ia_lead entry
          const { data: iaLead, error: insertErr } = await supabase
            .from('ia_leads')
            .insert({
              telefono: lead.telefono,
              nombre: lead.nombre || null,
              email: lead.email || null,
              crm_lead_id: lead.id,
              origen: 'crm',
            })
            .select('id')
            .single()

          if (insertErr) {
            throw new Error(insertErr.message)
          }

          // 2. Call outbound primer mensaje edge function
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
          const res = await fetch(
            `${supabaseUrl}/functions/v1/ia-outbound-primer-mensaje`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey,
              },
              body: JSON.stringify({
                agente_id: agenteId,
                lead_id: iaLead?.id,
                telefono: lead.telefono,
                nombre: lead.nombre,
              }),
            }
          )

          const data = await res.json()
          if (!res.ok || data.error) {
            throw new Error(data.error || 'Error enviando primer mensaje')
          }

          assigned++
        } catch (err) {
          errors++
          errorMessages.push(`${lead.nombre || lead.telefono}: ${err.message}`)
        }
      }

      setResult({ assigned, errors, errorMessages })
    } catch (err) {
      setError(err.message)
    } finally {
      setAssigning(false)
    }
  }

  const handleClose = () => {
    setLeads([])
    setSelected(new Set())
    setBusqueda('')
    setResult(null)
    setError(null)
    onClose()
  }

  if (!open) return null

  return (
    <div className="ia-modal-overlay" onClick={handleClose}>
      <div className="ia-modal ia-modal-wide ia-modal-crm" onClick={e => e.stopPropagation()}>
        <div className="ia-modal-header">
          <h2>Asignar leads del CRM</h2>
          <button className="ia-modal-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="ia-import-result">
            <CheckCircle size={40} style={{ color: '#10b981' }} />
            <h3>Asignacion completada</h3>
            <div className="ia-import-result-stats">
              <div className="ia-import-result-stat">
                <span className="ia-import-result-value" style={{ color: '#10b981' }}>{result.assigned}</span>
                <span className="ia-import-result-label">Asignados</span>
              </div>
              <div className="ia-import-result-stat">
                <span className="ia-import-result-value" style={{ color: '#ef4444' }}>{result.errors}</span>
                <span className="ia-import-result-label">Errores</span>
              </div>
            </div>
            {result.errorMessages.length > 0 && (
              <div className="ia-crm-errors-list">
                {result.errorMessages.map((msg, i) => (
                  <div key={i} className="ia-crm-error-item">
                    <AlertCircle size={12} />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="ia-btn ia-btn-primary" onClick={handleClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="ia-crm-search">
              <Search size={14} />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, telefono, email..."
              />
            </div>

            {error && (
              <div className="ia-import-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div className="ia-loading" style={{ padding: 40 }}>
                <div className="ia-spinner" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="ia-crm-empty">
                <Users size={32} strokeWidth={1} />
                <p>No hay leads disponibles para asignar</p>
              </div>
            ) : (
              <div className="ia-crm-table-wrap">
                <table className="ia-crm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          checked={selected.size === filtered.length && filtered.length > 0}
                          onChange={toggleAll}
                        />
                      </th>
                      <th>Nombre</th>
                      <th>Telefono</th>
                      <th>Email</th>
                      <th>Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 100).map(lead => (
                      <tr
                        key={lead.id}
                        className={selected.has(lead.id) ? 'selected' : ''}
                        onClick={() => toggleSelect(lead.id)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                          />
                        </td>
                        <td>{lead.nombre || '-'}</td>
                        <td className="ia-crm-phone">{lead.telefono || '-'}</td>
                        <td>{lead.email || '-'}</td>
                        <td>{lead.etapa_actual_id ? 'Asignada' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 100 && (
                  <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                    Mostrando 100 de {filtered.length} leads. Usa el buscador para filtrar.
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="ia-modal-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginRight: 'auto' }}>
                {selected.size} lead{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
              </span>
              <button type="button" className="ia-btn ia-btn-secondary" onClick={handleClose} style={{ minWidth: 100 }}>
                Cancelar
              </button>
              <button
                type="button"
                className="ia-btn ia-btn-primary"
                onClick={handleAsignar}
                disabled={selected.size === 0 || assigning}
                style={{ minWidth: 100 }}
              >
                <Users size={14} />
                {assigning ? 'Asignando...' : `Asignar ${selected.size}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
