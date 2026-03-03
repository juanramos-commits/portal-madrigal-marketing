import BibliotecaRecurso from './BibliotecaRecurso'

const ChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

export default function BibliotecaSecciones({
  secciones,
  recursos,
  seccionesAbiertas,
  onToggleSeccion,
  onCopiar,
  mostrarVisibilidad,
  buscando,
}) {
  if (secciones.length === 0) {
    return (
      <div className="bib-empty">
        <FolderIcon />
        <p>{buscando ? 'No se encontraron resultados para tu búsqueda' : 'No hay secciones en la biblioteca'}</p>
      </div>
    )
  }

  return (
    <div className="bib-secciones">
      {secciones.map(seccion => {
        const abierta = seccionesAbiertas.has(seccion.id)
        const recursosSeccion = recursos.filter(r => r.seccion_id === seccion.id)

        return (
          <div key={seccion.id} className={`bib-seccion${abierta ? ' abierta' : ''}`}>
            <button
              className="bib-seccion-header"
              onClick={() => onToggleSeccion(seccion.id)}
              aria-expanded={abierta}
              aria-controls={`bib-seccion-body-${seccion.id}`}
            >
              <div className="bib-seccion-titulo">
                <span className={`bib-seccion-chevron${abierta ? ' rotado' : ''}`} aria-hidden="true">
                  <ChevronDown />
                </span>
                <span className="bib-seccion-nombre">{seccion.nombre}</span>
                <span className="bib-seccion-count">{recursosSeccion.length}</span>
              </div>
              {seccion.descripcion && (
                <span className="bib-seccion-desc">{seccion.descripcion}</span>
              )}
            </button>
            {abierta && (
              <div className="bib-seccion-body" id={`bib-seccion-body-${seccion.id}`}>
                {recursosSeccion.length === 0 ? (
                  <div className="bib-seccion-vacia">Sin recursos en esta sección</div>
                ) : (
                  <div className="bib-recursos-list">
                    {recursosSeccion.map(recurso => (
                      <BibliotecaRecurso
                        key={recurso.id}
                        recurso={recurso}
                        onCopiar={onCopiar}
                        mostrarVisibilidad={mostrarVisibilidad}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
