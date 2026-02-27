import { useState, useEffect } from 'react'

function formatMoneda(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v || 0)
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
)

export default function WalletSolicitarRetiro({
  saldoDisponible,
  datosFiscales,
  empresaFiscal,
  onConfirm,
  onCancel,
  onIrDatosFiscales,
}) {
  const [paso, setPaso] = useState(1)
  const [monto, setMonto] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const montoNum = Number(monto) || 0
  const sinSaldo = saldoDisponible <= 0

  // Fiscal data check
  const datosFiscalesCompletos = datosFiscales &&
    datosFiscales.nombre_fiscal &&
    datosFiscales.nif_cif &&
    datosFiscales.direccion &&
    datosFiscales.pais &&
    datosFiscales.cuenta_bancaria_iban

  // Invoice preview calculation
  const ivaPct = Number(datosFiscales?.iva_porcentaje) || 0
  const ivaIncluido = datosFiscales?.iva_incluido || false
  let baseImponible, ivaMonto, total

  if (ivaIncluido) {
    total = montoNum
    ivaMonto = Math.round(montoNum * ivaPct / (100 + ivaPct) * 100) / 100
    baseImponible = total - ivaMonto
  } else {
    baseImponible = montoNum
    ivaMonto = Math.round(montoNum * ivaPct / 100 * 100) / 100
    total = baseImponible + ivaMonto
  }

  const serieFactura = datosFiscales?.serie_factura || 'F'
  const nextNum = datosFiscales?.siguiente_numero_factura || 1
  const numeroFactura = `${serieFactura}-${String(nextNum).padStart(3, '0')}`

  const validarPaso1 = () => {
    if (sinSaldo) { setError('No tienes saldo disponible para retirar'); return false }
    if (montoNum <= 0) { setError('El monto debe ser mayor que 0'); return false }
    if (montoNum > saldoDisponible) { setError(`Saldo insuficiente. Disponible: ${formatMoneda(saldoDisponible)}`); return false }
    setError(null)
    return true
  }

  const avanzar = () => {
    if (paso === 1) {
      if (!validarPaso1()) return
      if (!datosFiscalesCompletos) { setPaso(2); return }
      setPaso(3)
    } else if (paso === 2) {
      if (!datosFiscalesCompletos) return
      setPaso(3)
    }
  }

  const retroceder = () => {
    setError(null)
    if (paso === 3 && !datosFiscalesCompletos) setPaso(2)
    else if (paso > 1) setPaso(paso - 1)
    else onCancel()
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(montoNum)
    } catch (err) {
      setError(err.message || 'Error al solicitar retiro')
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="wt-modal-overlay" onClick={onCancel} />
      <div className="wt-modal wt-modal-retiro">
        <div className="wt-modal-header">
          <h2>Solicitar retiro</h2>
          <div className="wt-steps-indicator">
            {[1, 2, 3].map(s => (
              <span key={s} className={`wt-step ${paso >= s ? 'active' : ''}`}>{s}</span>
            ))}
          </div>
          <button className="wt-modal-close" onClick={onCancel}><CloseIcon /></button>
        </div>

        <div className="wt-modal-body">
          {/* PASO 1: Importe */}
          {paso === 1 && (
            <div className="wt-paso">
              <h3>Importe a retirar</h3>

              {sinSaldo ? (
                <div className="wt-paso-bloqueado">
                  No tienes saldo disponible para retirar.
                </div>
              ) : (
                <>
                  <div className="wt-field">
                    <label>Monto (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={saldoDisponible}
                      value={monto}
                      onChange={e => { setMonto(e.target.value); setError(null) }}
                      placeholder="0,00"
                      autoFocus
                    />
                  </div>
                  <div className="wt-saldo-ref">
                    Saldo disponible: <strong>{formatMoneda(saldoDisponible)}</strong>
                  </div>
                  <button className="wt-btn-max" onClick={() => setMonto(String(saldoDisponible))}>
                    Retirar todo
                  </button>
                </>
              )}
            </div>
          )}

          {/* PASO 2: Verificación fiscal */}
          {paso === 2 && (
            <div className="wt-paso">
              <h3>Datos fiscales</h3>
              <div className="wt-paso-warning">
                Completa tus datos de facturación antes de solicitar un retiro.
              </div>
              <button className="wt-btn-primary" onClick={onIrDatosFiscales}>
                Ir a datos fiscales
              </button>
            </div>
          )}

          {/* PASO 3: Preview factura */}
          {paso === 3 && (
            <div className="wt-paso">
              <h3>Preview de factura</h3>
              <div className="wt-factura-preview">
                <div className="wt-fp-row">
                  <div className="wt-fp-col">
                    <span className="wt-fp-label">Emisor</span>
                    <strong>{datosFiscales?.nombre_fiscal}</strong>
                    <span>NIF: {datosFiscales?.nif_cif}</span>
                    <span>{datosFiscales?.direccion}</span>
                    <span>{[datosFiscales?.ciudad, datosFiscales?.codigo_postal].filter(Boolean).join(', ')}</span>
                    <span>{datosFiscales?.pais}</span>
                  </div>
                  <div className="wt-fp-col">
                    <span className="wt-fp-label">Receptor</span>
                    <strong>{empresaFiscal?.nombre_fiscal || 'Madrigal Marketing S.L.'}</strong>
                    <span>CIF: {empresaFiscal?.cif || '-'}</span>
                    <span>{empresaFiscal?.direccion || ''}</span>
                    <span>{[empresaFiscal?.ciudad, empresaFiscal?.codigo_postal].filter(Boolean).join(', ')}</span>
                    <span>{empresaFiscal?.pais || 'España'}</span>
                  </div>
                </div>

                <div className="wt-fp-concepto">
                  <span className="wt-fp-label">Concepto</span>
                  <span>{empresaFiscal?.concepto_factura || 'Servicios de intermediación comercial'}</span>
                </div>

                <div className="wt-fp-amounts">
                  <div className="wt-fp-amount-row">
                    <span>Base imponible</span>
                    <span className="wt-fp-mono">{formatMoneda(baseImponible)}</span>
                  </div>
                  <div className="wt-fp-amount-row">
                    <span>IVA ({ivaPct}%)</span>
                    <span className="wt-fp-mono">{formatMoneda(ivaMonto)}</span>
                  </div>
                  <div className="wt-fp-amount-row wt-fp-total">
                    <span>TOTAL</span>
                    <span className="wt-fp-mono">{formatMoneda(total)}</span>
                  </div>
                </div>

                <div className="wt-fp-footer">
                  <span>Serie: {numeroFactura}</span>
                  <span>IBAN: {datosFiscales?.cuenta_bancaria_iban || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {error && <div className="wt-error-general">{error}</div>}
        </div>

        <div className="wt-modal-actions">
          <button className="wt-btn-ghost" onClick={retroceder} disabled={submitting}>
            {paso === 1 ? 'Cancelar' : 'Atrás'}
          </button>
          {paso < 3 && !sinSaldo && (
            <button className="wt-btn-primary" onClick={avanzar} disabled={paso === 2 && !datosFiscalesCompletos}>
              Siguiente
            </button>
          )}
          {paso === 3 && (
            <button className="wt-btn-success" onClick={handleConfirm} disabled={submitting}>
              {submitting ? 'Solicitando...' : 'Confirmar solicitud'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
