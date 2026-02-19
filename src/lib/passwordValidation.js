export function validarPassword(password) {
  const errores = []

  if (password.length < 8) errores.push('Mínimo 8 caracteres')
  if (!/[A-Z]/.test(password)) errores.push('Al menos una mayúscula')
  if (!/[a-z]/.test(password)) errores.push('Al menos una minúscula')
  if (!/[0-9]/.test(password)) errores.push('Al menos un número')
  if (!/[^A-Za-z0-9]/.test(password)) errores.push('Al menos un carácter especial (!@#$%...)')

  return {
    valida: errores.length === 0,
    errores,
    fortaleza: calcularFortaleza(password)
  }
}

function calcularFortaleza(password) {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { nivel: 'debil', color: '#ef4444', porcentaje: 33 }
  if (score <= 3) return { nivel: 'media', color: '#f59e0b', porcentaje: 66 }
  return { nivel: 'fuerte', color: '#10b981', porcentaje: 100 }
}
