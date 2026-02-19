import { validarPassword } from '../lib/passwordValidation'

const requisitos = [
  { test: (p) => p.length >= 8, label: 'Mínimo 8 caracteres' },
  { test: (p) => /[A-Z]/.test(p), label: 'Una letra mayúscula' },
  { test: (p) => /[a-z]/.test(p), label: 'Una letra minúscula' },
  { test: (p) => /[0-9]/.test(p), label: 'Un número' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'Un carácter especial' },
]

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null

  const { fortaleza } = validarPassword(password)
  const niveles = { debil: 'Débil', media: 'Media', fuerte: 'Fuerte' }

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{
        height: '4px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '2px',
        overflow: 'hidden',
        marginBottom: '8px'
      }}>
        <div style={{
          height: '100%',
          width: `${fortaleza.porcentaje}%`,
          background: fortaleza.color,
          borderRadius: '2px',
          transition: 'all 0.3s ease'
        }} />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <span style={{ fontSize: '12px', color: fortaleza.color, fontWeight: 500 }}>
          {niveles[fortaleza.nivel]}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {requisitos.map((req, i) => {
          const cumple = req.test(password)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <span style={{ color: cumple ? '#10b981' : 'var(--text-muted)', fontSize: '14px' }}>
                {cumple ? '\u2713' : '\u2717'}
              </span>
              <span style={{ color: cumple ? '#10b981' : 'var(--text-muted)' }}>
                {req.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
