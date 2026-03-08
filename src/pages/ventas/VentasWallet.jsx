import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { useWallet } from '../../hooks/useWallet'
import { useAuth } from '../../contexts/AuthContext'
import WalletResumen from '../../components/ventas/WalletResumen'
import '../../styles/ventas-wallet.css'

const WalletComisiones = lazy(() => import('../../components/ventas/WalletComisiones'))
const WalletRetiros = lazy(() => import('../../components/ventas/WalletRetiros'))
const WalletSolicitarRetiro = lazy(() => import('../../components/ventas/WalletSolicitarRetiro'))
const WalletDatosFiscales = lazy(() => import('../../components/ventas/WalletDatosFiscales'))
const WalletFacturas = lazy(() => import('../../components/ventas/WalletFacturas'))
const WalletAdminRetiros = lazy(() => import('../../components/ventas/WalletAdminRetiros'))
const WalletAdminFacturas = lazy(() => import('../../components/ventas/WalletAdminFacturas'))

const tabsBase = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'comisiones', label: 'Comisiones' },
  { key: 'retiros', label: 'Retiros' },
  { key: 'facturas', label: 'Facturas' },
  { key: 'datos_fiscales', label: 'Datos fiscales' },
]

const tabsAdmin = [
  { key: 'admin_retiros', label: 'Retiros pendientes' },
  { key: 'admin_facturas', label: 'Todas las facturas' },
]

export default function VentasWallet() {
  const w = useWallet()
  const { tienePermiso } = useAuth()
  const [tab, setTab] = useState('resumen')
  const [showRetiroModal, setShowRetiroModal] = useState(false)

  const tabs = tienePermiso('ventas.wallet.ver_todos') ? [...tabsBase, ...tabsAdmin] : tabsBase

  const tabsRef = useRef(null)
  const [tabsOverflow, setTabsOverflow] = useState(false)
  const checkOverflow = useCallback(() => {
    const el = tabsRef.current
    if (el) setTabsOverflow(el.scrollWidth > el.clientWidth + 2)
  }, [])
  useEffect(() => {
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [checkOverflow])

  const handleSolicitarRetiro = async (monto) => {
    await w.solicitarRetiro(monto)
    setShowRetiroModal(false)
  }

  const handleAprobarRetiro = async (retiroId) => {
    await w.aprobarRetiro(retiroId)
  }

  const handleRechazarRetiro = async (retiroId, motivo) => {
    await w.rechazarRetiro(retiroId, motivo)
  }

  const handleGuardarDatosFiscales = async (datos) => {
    await w.guardarDatosFiscales(datos)
    w.cargarDatosFiscales()
  }

  const handleIrDatosFiscales = () => {
    setTab('datos_fiscales')
    setShowRetiroModal(false)
  }

  return (
    <div className="wt-page">
      <div className="wt-header">
        <h1>Wallet</h1>
        {tienePermiso('ventas.wallet.solicitar_retiro') && (
          <button
            className="wt-btn-retiro"
            onClick={() => setShowRetiroModal(true)}
            disabled={!(w.saldoDisponible > 0 && (!w.esCloser || w.closerAlDia))}
          >
            Solicitar retiro
          </button>
        )}
      </div>

      <div className={`wt-tabs-wrap${tabsOverflow ? ' has-overflow' : ''}`}>
        <div className="wt-tabs" role="tablist" aria-label="Secciones de wallet" ref={tabsRef}>
          {tabs.map(t => {
            const count = t.key === 'admin_retiros' ? w.contadoresRetiros?.pendiente : null
            return (
              <button
                key={t.key}
                className={`wt-tab${tab === t.key ? ' active' : ''}`}
                onClick={() => setTab(t.key)}
                role="tab"
                aria-selected={tab === t.key}
              >
                {t.label}
                {count > 0 && <span className="wt-tab-badge">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {w.error && (
        <div className="wt-error-general" role="alert">{w.error}</div>
      )}

      {w.loading && !w.wallet ? (
        <div className="wt-loading" role="status">Cargando wallet...</div>
      ) : <Suspense fallback={<div className="wt-loading">Cargando...</div>}>

      {tab === 'resumen' && (
        <WalletResumen
          wallet={w.wallet}
          saldoDisponible={w.saldoDisponible}
          esCloser={w.esCloser}
          closerAlDia={w.closerAlDia}
          citasPendientes={w.citasPendientes}
          loading={w.loading}
          onSolicitarRetiro={() => setShowRetiroModal(true)}
        />
      )}

      {tab === 'comisiones' && (
        <WalletComisiones
          comisiones={w.comisiones}
          total={w.comisionesTotal}
          filtroTipo={w.comisionesFiltroTipo}
          onFiltroTipoChange={v => { w.setComisionesFiltroTipo(v); w.setComisionesPagina(0) }}
          filtroDesde={w.comisionesFiltroDesde}
          onFiltroDesdeChange={v => { w.setComisionesFiltroDesde(v); w.setComisionesPagina(0) }}
          filtroHasta={w.comisionesFiltroHasta}
          onFiltroHastaChange={v => { w.setComisionesFiltroHasta(v); w.setComisionesPagina(0) }}
          usuarioId={w.comisionesUsuarioId}
          onUsuarioIdChange={v => { w.setComisionesUsuarioId(v); w.setComisionesPagina(0) }}
          miembros={tienePermiso('ventas.wallet.ver_todos') ? w.miembros : []}
          esAdmin={tienePermiso('ventas.wallet.ver_todos')}
          pagina={w.comisionesPagina}
          onPageChange={w.setComisionesPagina}
          loading={w.loading}
          pageSize={w.comisionesPageSize}
          busqueda={w.comisionesBusqueda}
          onBusquedaChange={v => { w.setComisionesBusqueda(v); w.setComisionesPagina(0) }}
          onExportCSV={w.exportarComisionesCSV}
        />
      )}

      {tab === 'retiros' && (
        <WalletRetiros
          retiros={w.retiros}
          total={w.retirosTotal}
          pagina={w.retirosPagina}
          onPageChange={w.setRetirosPagina}
          pageSize={w.retirosPageSize}
          loading={w.loading}
          busqueda={w.retirosBusqueda}
          onBusquedaChange={v => { w.setRetirosBusqueda(v); w.setRetirosPagina(0) }}
        />
      )}

      {tab === 'facturas' && (
        <WalletFacturas
          facturas={w.facturas}
          total={w.facturasTotal}
          pagina={w.facturasPagina}
          onPageChange={w.setFacturasPagina}
          pageSize={w.facturasPageSize}
          loading={w.loading}
          datosFiscales={w.datosFiscales}
          busqueda={w.facturasBusqueda}
          onBusquedaChange={v => { w.setFacturasBusqueda(v); w.setFacturasPagina(0) }}
        />
      )}

      {tab === 'datos_fiscales' && (
        <WalletDatosFiscales
          datosFiscales={w.datosFiscales}
          onGuardar={handleGuardarDatosFiscales}
        />
      )}

      {tab === 'admin_retiros' && tienePermiso('ventas.wallet.aprobar_retiros') && (
        <WalletAdminRetiros
          retiros={w.todosRetiros}
          filtro={w.todosRetirosFiltro}
          onFiltroChange={w.setTodosRetirosFiltro}
          contadores={w.contadoresRetiros}
          onAprobar={handleAprobarRetiro}
          onRechazar={handleRechazarRetiro}
          loading={w.loading}
          busqueda={w.adminRetirosBusqueda}
          onBusquedaChange={w.setAdminRetirosBusqueda}
        />
      )}

      {tab === 'admin_facturas' && tienePermiso('ventas.wallet.ver_todos') && (
        <WalletAdminFacturas
          facturas={w.todasFacturas}
          filtroUsuario={w.todasFacturasFiltroUsuario}
          onFiltroUsuarioChange={w.setTodasFacturasFiltroUsuario}
          miembros={w.miembros}
          loading={w.loading}
          busqueda={w.adminFacturasBusqueda}
          onBusquedaChange={w.setAdminFacturasBusqueda}
        />
      )}

      </Suspense>}

      {showRetiroModal && (
        <WalletSolicitarRetiro
          saldoDisponible={w.saldoDisponible}
          datosFiscales={w.datosFiscales}
          empresaFiscal={w.empresaFiscal}
          onConfirm={handleSolicitarRetiro}
          onCancel={() => setShowRetiroModal(false)}
          onIrDatosFiscales={handleIrDatosFiscales}
        />
      )}
    </div>
  )
}
