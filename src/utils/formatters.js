export function formatMoneda(valor) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(valor || 0)
}

export function formatFecha(fecha) {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export function tieneDatosBancariosCompletos(df) {
  if (!df?.titular_cuenta) return false
  const tipo = df.tipo_cuenta || 'iban'
  switch (tipo) {
    case 'iban': return !!df.cuenta_bancaria_iban
    case 'us': return !!df.routing_number && !!df.account_number
    case 'uk': return !!df.sort_code && !!df.account_number
    case 'other': return !!df.swift_bic && !!df.account_number
    default: return false
  }
}

export function formatDatosBancarios(df) {
  if (!df) return '-'
  const tipo = df.tipo_cuenta || 'iban'
  switch (tipo) {
    case 'iban':
      return `IBAN: ${df.cuenta_bancaria_iban || '-'}${df.swift_bic ? ` · SWIFT: ${df.swift_bic}` : ''}`
    case 'us':
      return `Routing: ${df.routing_number || '-'} · Account: ${df.account_number || '-'}${df.swift_bic ? ` · SWIFT: ${df.swift_bic}` : ''}`
    case 'uk':
      return `Sort Code: ${df.sort_code || '-'} · Account: ${df.account_number || '-'}${df.swift_bic ? ` · SWIFT: ${df.swift_bic}` : ''}`
    case 'other':
      return `SWIFT: ${df.swift_bic || '-'} · Account: ${df.account_number || '-'}`
    default:
      return '-'
  }
}
