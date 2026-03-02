import { useState } from 'react'
import { useWallet } from '../../hooks/useWallet'
import WalletResumen from '../../components/ventas/WalletResumen'
import WalletComisiones from '../../components/ventas/WalletComisiones'
import WalletRetiros from '../../components/ventas/WalletRetiros'
import WalletSolicitarRetiro from '../../components/ventas/WalletSolicitarRetiro'
import WalletDatosFiscales from '../../components/ventas/WalletDatosFiscales'
import WalletFacturas from '../../components/ventas/WalletFacturas'
import WalletAdminRetiros from '../../components/ventas/WalletAdminRetiros'
import WalletAdminFacturas from '../../components/ventas/WalletAdminFacturas'
import '../../styles/ventas-wallet.css'

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
  const [tab, setTab] = useState('resumen')
  const [showRetiroModal, setShowRetiroModal] = useState(false)

  const tabs = w.esAdmin ? [...tabsBase, ...tabsAdmin] : tabsBase

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
      </div>

      <div className="wt-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`wt-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {w.error && (
        <div className="wt-error-general">{w.error}</div>
      )}

      {tab === 'resumen' && (
        <WalletResumen
          wallet={w.wallet}
          saldoDisponible={w.saldoDisponible}
          esCloser={w.esCloser}
          closerAlDia={w.closerAlDia}
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
          miembros={w.esAdmin ? w.miembros : []}
          esAdmin={w.esAdmin}
          pagina={w.comisionesPagina}
          onPageChange={w.setComisionesPagina}
          loading={w.loading}
          pageSize={w.comisionesPageSize}
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
        />
      )}

      {tab === 'datos_fiscales' && (
        <WalletDatosFiscales
          datosFiscales={w.datosFiscales}
          onGuardar={handleGuardarDatosFiscales}
        />
      )}

      {tab === 'admin_retiros' && w.esAdmin && (
        <WalletAdminRetiros
          retiros={w.todosRetiros}
          filtro={w.todosRetirosFiltro}
          onFiltroChange={w.setTodosRetirosFiltro}
          contadores={w.contadoresRetiros}
          onAprobar={handleAprobarRetiro}
          onRechazar={handleRechazarRetiro}
          loading={w.loading}
        />
      )}

      {tab === 'admin_facturas' && w.esAdmin && (
        <WalletAdminFacturas
          facturas={w.todasFacturas}
          filtroUsuario={w.todasFacturasFiltroUsuario}
          onFiltroUsuarioChange={w.setTodasFacturasFiltroUsuario}
          miembros={w.miembros}
          loading={w.loading}
        />
      )}

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
