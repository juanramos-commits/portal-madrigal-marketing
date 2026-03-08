import { useState } from 'react'

const TIPO_ICONOS = {
  enlace_pago: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  contrato: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  onboarding: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  otro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
}

const TIPO_LABELS = {
  enlace_pago: 'Enlace de pago',
  contrato: 'Contrato',
  video: 'Vídeo',
  onboarding: 'Onboarding',
  otro: 'Otro',
}

const ROL_BADGES = {
  setter: { label: 'Setter', className: 'bib-badge-setter' },
  closer: { label: 'Closer', className: 'bib-badge-closer' },
  director_ventas: { label: 'Director', className: 'bib-badge-director' },
  super_admin: { label: 'Admin', className: 'bib-badge-admin' },
}

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

export { TIPO_ICONOS, TIPO_LABELS, ROL_BADGES }

export default function BibliotecaRecurso({ recurso, onCopiar, mostrarVisibilidad }) {
  const [copiado, setCopiado] = useState(false)

  const handleCopiar = async () => {
    const ok = await onCopiar(recurso.url)
    if (ok) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  const tipo = recurso.tipo || 'otro'
  const icono = TIPO_ICONOS[tipo] || TIPO_ICONOS.otro

  return (
    <div className="bib-recurso">
      <div className="bib-recurso-icono">
        {icono}
      </div>
      <div className="bib-recurso-info">
        <div className="bib-recurso-nombre">{recurso.nombre}</div>
        {recurso.descripcion && (
          <div className="bib-recurso-desc">{recurso.descripcion}</div>
        )}
        <div className="bib-recurso-meta">
          <span className="bib-recurso-tipo">{TIPO_LABELS[tipo] || tipo}</span>
          {mostrarVisibilidad && recurso.visible_para && recurso.visible_para.length > 0 && (
            <div className="bib-recurso-badges">
              {recurso.visible_para.map(rol => {
                const badge = ROL_BADGES[rol]
                if (!badge) return null
                return (
                  <span key={rol} className={`bib-badge ${badge.className}`}>
                    {badge.label}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div className="bib-recurso-acciones">
        {recurso.url && (
          <>
            <button className="bib-btn-icon" onClick={handleCopiar} aria-label="Copiar valor">
              <CopyIcon />
              <span className="bib-copiado" role="status" aria-live="polite">
                {copiado ? '¡Copiado!' : ''}
              </span>
            </button>
            {/^https?:\/\//i.test(recurso.url) && (
              <a
                href={recurso.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bib-btn-icon"
                aria-label="Abrir enlace en nueva pestaña"
              >
                <ExternalLinkIcon />
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}
