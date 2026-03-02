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
    <div className="aj-psm">
      <div className="aj-psm-track">
        <div
          className="aj-psm-bar"
          style={{ width: `${fortaleza.porcentaje}%`, background: fortaleza.color }}
        />
      </div>
      <div className={`aj-psm-label ${fortaleza.className}`}>
        {niveles[fortaleza.nivel]}
      </div>
      <div className="aj-psm-reqs">
        {requisitos.map((req, i) => {
          const cumple = req.test(password)
          return (
            <div key={i} className={`aj-psm-req ${cumple ? 'aj-psm-ok' : 'aj-psm-fail'}`}>
              <span className="aj-psm-req-icon">{cumple ? '\u2713' : '\u2717'}</span>
              <span>{req.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
