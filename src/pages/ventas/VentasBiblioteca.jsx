import { useState } from 'react'
import { useBiblioteca } from '../../hooks/useBiblioteca'
import BibliotecaBuscador from '../../components/ventas/BibliotecaBuscador'
import BibliotecaSecciones from '../../components/ventas/BibliotecaSecciones'
import BibliotecaAdminSecciones from '../../components/ventas/BibliotecaAdminSecciones'
import BibliotecaAdminRecursos from '../../components/ventas/BibliotecaAdminRecursos'
import BibliotecaFormSeccion from '../../components/ventas/BibliotecaFormSeccion'
import BibliotecaFormRecurso from '../../components/ventas/BibliotecaFormRecurso'
import { SettingsIcon, CloseIcon } from '../../components/ventas/BibliotecaIcons'
import '../../styles/ventas-biblioteca.css'

export default function VentasBiblioteca() {
  const bib = useBiblioteca()
  const [formSeccion, setFormSeccion] = useState(null) // null = cerrado, {} = nueva, {seccion} = editar
  const [formRecurso, setFormRecurso] = useState(null) // null = cerrado, {seccionId} = nuevo, {recurso} = editar

  const seccionesMostradas = bib.seccionesFiltradas
  const recursosMostrados = bib.recursosFiltrados

  // Handlers secciones
  const handleNuevaSeccion = () => setFormSeccion({})
  const handleEditarSeccion = (seccion) => setFormSeccion({ seccion })
  const handleGuardarSeccion = async (datos) => {
    if (formSeccion?.seccion) {
      await bib.actualizarSeccion(formSeccion.seccion.id, datos)
    } else {
      await bib.crearSeccion(datos)
    }
  }

  // Handlers recursos
  const handleNuevoRecurso = (seccionId) => setFormRecurso({ seccionId })
  const handleEditarRecurso = (recurso) => setFormRecurso({ recurso })
  const handleGuardarRecurso = async (datos) => {
    if (formRecurso?.recurso) {
      await bib.actualizarRecurso(formRecurso.recurso.id, datos)
    } else {
      await bib.crearRecurso(datos)
    }
  }

  return (
    <div className="bib-page">
      {/* Header */}
      <div className="bib-header">
        <h1>Biblioteca</h1>
        <div className="bib-header-actions">
          {(bib.puedeGestionar || bib.puedeGestionarRecursos) && (
            <button
              className={`bib-btn-gestion${bib.modoGestion ? ' bib-btn-gestion-active' : ''}`}
              onClick={() => bib.setModoGestion(!bib.modoGestion)}
            >
              {bib.modoGestion ? <CloseIcon /> : <SettingsIcon />}
              {bib.modoGestion ? 'Salir de gestión' : 'Gestionar'}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {!bib.modoGestion && (
        <>
          <BibliotecaBuscador
            busqueda={bib.busqueda}
            onBusquedaChange={bib.setBusqueda}
          />

          {/* Expand/collapse controls */}
          {bib.secciones.length > 0 && (
            <div className="bib-expand-controls">
              <button className="bib-expand-btn" onClick={bib.expandirTodas}>
                Expandir todas
              </button>
              <button className="bib-expand-btn" onClick={bib.colapsarTodas}>
                Colapsar todas
              </button>
            </div>
          )}
        </>
      )}

      {bib.error && <div className="bib-error-msg">{bib.error}</div>}

      {/* Main content */}
      {bib.loading && bib.secciones.length === 0 ? (
        <div className="bib-skeleton-list" aria-busy="true" aria-label="Cargando biblioteca">
          {[0, 1, 2].map(i => (
            <div key={i} className="bib-skeleton-card" style={{ '--anim-delay': `${i * 100}ms` }}>
              <div className="bib-skeleton-title" />
              <div className="bib-skeleton-line" />
            </div>
          ))}
        </div>
      ) : bib.modoGestion ? (
        /* Admin mode */
        <div className="bib-admin-panel">
          {bib.puedeGestionar && (
            <BibliotecaAdminSecciones
              secciones={bib.secciones}
              recursos={bib.recursos}
              onNueva={handleNuevaSeccion}
              onEditar={handleEditarSeccion}
              onEliminar={bib.eliminarSeccion}
              onReordenar={bib.reordenarSecciones}
            />
          )}
          {bib.puedeGestionarRecursos && (
            <BibliotecaAdminRecursos
              secciones={bib.secciones}
              recursos={bib.recursos}
              onNuevo={handleNuevoRecurso}
              onEditar={handleEditarRecurso}
              onEliminar={bib.eliminarRecurso}
              onReordenar={bib.reordenarRecursos}
            />
          )}
        </div>
      ) : (
        /* Read mode */
        <BibliotecaSecciones
          secciones={seccionesMostradas}
          recursos={recursosMostrados}
          seccionesAbiertas={bib.seccionesAbiertas}
          onToggleSeccion={bib.toggleSeccion}
          onCopiar={bib.copiarAlPortapapeles}
          mostrarVisibilidad={bib.puedeGestionar}
          buscando={!!bib.busquedaDebounced.trim()}
        />
      )}

      {/* Form modals */}
      {formSeccion !== null && (
        <BibliotecaFormSeccion
          seccion={formSeccion.seccion || null}
          onGuardar={handleGuardarSeccion}
          onCerrar={() => setFormSeccion(null)}
        />
      )}

      {formRecurso !== null && (
        <BibliotecaFormRecurso
          recurso={formRecurso.recurso || null}
          secciones={bib.secciones}
          seccionIdInicial={formRecurso.seccionId || null}
          onGuardar={handleGuardarRecurso}
          onCerrar={() => setFormRecurso(null)}
        />
      )}
    </div>
  )
}
