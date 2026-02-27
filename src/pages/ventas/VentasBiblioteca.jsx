import { useState } from 'react'
import { useBiblioteca } from '../../hooks/useBiblioteca'
import BibliotecaBuscador from '../../components/ventas/BibliotecaBuscador'
import BibliotecaSecciones from '../../components/ventas/BibliotecaSecciones'
import BibliotecaAdminSecciones from '../../components/ventas/BibliotecaAdminSecciones'
import BibliotecaAdminRecursos from '../../components/ventas/BibliotecaAdminRecursos'
import BibliotecaFormSeccion from '../../components/ventas/BibliotecaFormSeccion'
import BibliotecaFormRecurso from '../../components/ventas/BibliotecaFormRecurso'
import '../../styles/ventas-biblioteca.css'

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

export default function VentasBiblioteca() {
  const bib = useBiblioteca()
  const [formSeccion, setFormSeccion] = useState(null) // null = cerrado, {} = nueva, {seccion} = editar
  const [formRecurso, setFormRecurso] = useState(null) // null = cerrado, {seccionId} = nuevo, {recurso} = editar

  const seccionesMostradas = bib.seccionesFiltradas()
  const recursosMostrados = bib.recursosFiltrados()

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
          {bib.puedeGestionar && (
            <label className="bib-toggle-gestion">
              <SettingsIcon />
              <span>Gestionar</span>
              <div
                className={`bib-toggle-switch${bib.modoGestion ? ' active' : ''}`}
                onClick={() => bib.setModoGestion(!bib.modoGestion)}
              >
                <span className="bib-toggle-switch-knob" />
              </div>
            </label>
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
      {bib.loading ? (
        <div className="bib-loading">Cargando biblioteca...</div>
      ) : bib.modoGestion ? (
        /* Admin mode */
        <div className="bib-admin-panel">
          <BibliotecaAdminSecciones
            secciones={bib.secciones}
            recursos={bib.recursos}
            onNueva={handleNuevaSeccion}
            onEditar={handleEditarSeccion}
            onEliminar={bib.eliminarSeccion}
            onReordenar={bib.reordenarSecciones}
          />
          <BibliotecaAdminRecursos
            secciones={bib.secciones}
            recursos={bib.recursos}
            onNuevo={handleNuevoRecurso}
            onEditar={handleEditarRecurso}
            onEliminar={bib.eliminarRecurso}
            onReordenar={bib.reordenarRecursos}
          />
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
