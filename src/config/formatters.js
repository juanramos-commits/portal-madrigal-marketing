const currencyFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCurrency(v) {
  return currencyFmt.format(Number(v) || 0)
}

export function formatPercent(v) {
  return `${Number(v).toFixed(1)}%`
}
