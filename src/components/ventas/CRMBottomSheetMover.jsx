import { useEffect, useRef, useCallback } from 'react'
import { X, Check } from 'lucide-react'

export default function CRMBottomSheetMover({
  lead,
  etapaActual,
  etapas,
  onMover,
  onCerrar,
}) {
  const sheetRef = useRef(null)

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCerrar])

  const handleSelectEtapa = useCallback((etapaDestinoId) => {
    if (etapaDestinoId === etapaActual.id) return
    onCerrar()
    requestAnimationFrame(() => {
      onMover(lead.id, etapaActual.id, etapaDestinoId)
    })
  }, [lead.id, etapaActual.id, onMover, onCerrar])

  const sortedEtapas = [...etapas].sort((a, b) => a.orden - b.orden)

  return (
    <>
      <div className="crm-sheet-overlay" onClick={onCerrar} />
      <div className="crm-sheet" ref={sheetRef} role="dialog" aria-modal="true">
        <div className="crm-sheet-handle" />

        <div className="crm-sheet-header">
          <div className="crm-sheet-header-left">
            <h3 className="crm-sheet-title">Mover lead</h3>
            <span className="crm-sheet-lead-name">{lead.nombre}</span>
          </div>
          <button className="crm-modal-close" onClick={onCerrar} aria-label="Cerrar">
            <X />
          </button>
        </div>

        <div className="crm-sheet-body">
          {sortedEtapas.map(etapa => {
            const isCurrent = etapa.id === etapaActual.id
            return (
              <button
                key={etapa.id}
                className={`crm-sheet-stage${isCurrent ? ' current' : ''}`}
                onClick={() => handleSelectEtapa(etapa.id)}
                disabled={isCurrent}
              >
                <span
                  className="crm-sheet-stage-dot"
                  style={{ background: etapa.color || 'var(--text-muted)' }}
                />
                <span className="crm-sheet-stage-name">{etapa.nombre}</span>
                {isCurrent && (
                  <span className="crm-sheet-stage-current">
                    <Check size={14} />
                    Actual
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
