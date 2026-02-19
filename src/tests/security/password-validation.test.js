import { describe, test, expect } from 'vitest'
import { validarPassword } from '../../lib/passwordValidation'

describe('Validación de Contraseñas', () => {
  test('"abc" es inválida (muy corta)', () => {
    const result = validarPassword('abc')
    expect(result.valida).toBe(false)
    expect(result.errores).toContain('Mínimo 8 caracteres')
  })

  test('"abcdefgh" es inválida (sin mayúscula, número, especial)', () => {
    const result = validarPassword('abcdefgh')
    expect(result.valida).toBe(false)
    expect(result.errores).toContain('Al menos una mayúscula')
    expect(result.errores).toContain('Al menos un número')
    expect(result.errores).toContain('Al menos un carácter especial (!@#$%...)')
  })

  test('"Abcdefg1!" es válida', () => {
    const result = validarPassword('Abcdefg1!')
    expect(result.valida).toBe(true)
    expect(result.errores).toHaveLength(0)
  })

  test('"12345678" es inválida (sin letras ni especial)', () => {
    const result = validarPassword('12345678')
    expect(result.valida).toBe(false)
    expect(result.errores).toContain('Al menos una mayúscula')
    expect(result.errores).toContain('Al menos una minúscula')
    expect(result.errores).toContain('Al menos un carácter especial (!@#$%...)')
  })

  test('fortaleza: "Abc1!xy" (7 chars) es media', () => {
    const result = validarPassword('Abc1!xy')
    // score: >=8? No, >=12? No, upper+lower? Yes, number? Yes, special? Yes = 3 → media
    expect(result.fortaleza.nivel).toBe('media')
    expect(result.fortaleza.porcentaje).toBe(66)
  })

  test('fortaleza: "MyP@ssw0rd!2026" es fuerte', () => {
    const result = validarPassword('MyP@ssw0rd!2026')
    expect(result.fortaleza.nivel).toBe('fuerte')
    expect(result.fortaleza.porcentaje).toBe(100)
  })

  test('password vacío es inválida con todos los errores', () => {
    const result = validarPassword('')
    expect(result.valida).toBe(false)
    expect(result.errores.length).toBeGreaterThanOrEqual(4)
  })

  test('password solo mayúsculas + número + especial pero < 8 chars', () => {
    const result = validarPassword('AB1!')
    expect(result.valida).toBe(false)
    expect(result.errores).toContain('Mínimo 8 caracteres')
    expect(result.errores).toContain('Al menos una minúscula')
  })

  test('fortaleza débil para password corta simple', () => {
    const result = validarPassword('abc')
    expect(result.fortaleza.nivel).toBe('debil')
    expect(result.fortaleza.porcentaje).toBe(33)
  })

  test('password con todos los requisitos excepto especial', () => {
    const result = validarPassword('Abcdefg1')
    expect(result.valida).toBe(false)
    expect(result.errores).toContain('Al menos un carácter especial (!@#$%...)')
    expect(result.errores).toHaveLength(1)
  })
})
