import { useState, useEffect, useRef } from 'react'
import PasswordStrengthMeter from '../PasswordStrengthMeter'

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const MonitorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
)

const temaOpciones = [
  { key: 'dark', label: 'Oscuro', icon: <MoonIcon /> },
  { key: 'light', label: 'Claro', icon: <SunIcon /> },
  { key: 'system', label: 'Sistema', icon: <MonitorIcon /> },
]

export default function AjustesPerfil({
  perfil,
  rolesComerciales,
  onGuardarPerfil,
  onCambiarContrasena,
  onSubirFoto,
  tema,
  onSetTema,
}) {
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  const [nuevaPass, setNuevaPass] = useState('')
  const [confirmarPass, setConfirmarPass] = useState('')
  const [savingPass, setSavingPass] = useState(false)
  const [passGuardada, setPassGuardada] = useState(false)
  const [passError, setPassError] = useState(null)

  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (perfil) {
      setNombre(perfil.nombre || '')
    }
  }, [perfil])

  const misRoles = rolesComerciales
    .filter(r => r.usuario_id === perfil?.id && r.activo)
    .map(r => r.rol)

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError(null)
    try {
      await onGuardarPerfil({ nombre: nombre.trim() })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleCambiarPass = async () => {
    if (!nuevaPass) { setPassError('Introduce una nueva contraseña'); return }
    if (nuevaPass.length < 8) { setPassError('La contraseña debe tener al menos 8 caracteres'); return }
    if (nuevaPass !== confirmarPass) { setPassError('Las contraseñas no coinciden'); return }
    setSavingPass(true)
    setPassError(null)
    try {
      await onCambiarContrasena(nuevaPass)
      setPassGuardada(true)
      setNuevaPass('')
      setConfirmarPass('')
      setTimeout(() => setPassGuardada(false), 3000)
    } catch (e) {
      setPassError(e.message || 'Error al cambiar contraseña')
    } finally {
      setSavingPass(false)
    }
  }

  const handleFotoClick = () => {
    fileRef.current?.click()
  }

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG o WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no puede superar 2MB.')
      return
    }

    setSubiendoFoto(true)
    setError(null)
    try {
      await onSubirFoto(file)
    } catch (e) {
      setError(e.message || 'Error al subir foto')
    } finally {
      setSubiendoFoto(false)
    }
  }

  const getInitial = () => (perfil?.nombre || perfil?.email || 'U')[0].toUpperCase()

  const ROL_LABELS = {
    setter: 'Setter',
    closer: 'Closer',
    director_ventas: 'Director',
    super_admin: 'Super Admin',
  }

  return (
    <div className="aj-perfil">
      {/* ── Card: Datos personales ── */}
      <div className="aj-card">
        <div className="aj-card-section-title">Datos personales</div>

        <div className="aj-perfil-avatar-row">
          <div className="aj-avatar" onClick={handleFotoClick}>
            {perfil?.avatar_url ? (
              <img src={perfil.avatar_url} alt="Avatar" />
            ) : (
              <span>{getInitial()}</span>
            )}
            <div className="aj-avatar-overlay">
              {subiendoFoto ? '...' : 'Cambiar'}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFotoChange}
          />
          <div className="aj-perfil-avatar-info">
            <div className="aj-perfil-nombre-preview">{perfil?.nombre || 'Sin nombre'}</div>
            <div className="aj-perfil-email-preview">{perfil?.email}</div>
            {misRoles.length > 0 && (
              <div className="aj-perfil-roles">
                {misRoles.map(r => (
                  <span key={r} className={`aj-role-badge aj-role-${r}`}>
                    {ROL_LABELS[r] || r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="aj-card-divider" />

        <div className="aj-form">
          <div className="aj-field">
            <label>Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setGuardado(false) }}
              placeholder="Tu nombre"
            />
          </div>

          <div className="aj-field">
            <label>Email</label>
            <input
              type="email"
              value={perfil?.email || ''}
              readOnly
              className="aj-input-readonly"
            />
            <span className="aj-field-hint">El email no se puede cambiar</span>
          </div>

          {error && <div className="aj-error">{error}</div>}

          <div className="aj-actions">
            <button className="aj-btn-primary" onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </button>
            {guardado && <span className="aj-guardado-msg">Guardado</span>}
          </div>
        </div>
      </div>

      {/* ── Card: Apariencia ── */}
      <div className="aj-card">
        <div className="aj-card-section-title">Apariencia</div>
        <p className="aj-field-hint" style={{ marginTop: 0, marginBottom: '1rem' }}>
          Elige el modo de visualización de la aplicación.
        </p>
        <div className="aj-tema-opciones">
          {temaOpciones.map(opt => (
            <button
              key={opt.key}
              className={`aj-tema-opcion${tema === opt.key ? ' active' : ''}`}
              onClick={() => onSetTema(opt.key)}
            >
              <div className="aj-tema-opcion-icon">{opt.icon}</div>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Card: Cambiar contraseña ── */}
      <div className="aj-card">
        <div className="aj-card-section-title">Cambiar contraseña</div>
        <input type="text" name="fake-user" autoComplete="username" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden', pointerEvents: 'none' }} tabIndex={-1} />
        <input type="password" name="fake-pass" autoComplete="current-password" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden', pointerEvents: 'none' }} tabIndex={-1} />

        <div className="aj-form">
          <div className="aj-field">
            <label>Nueva contraseña</label>
            <input
              type="password"
              value={nuevaPass}
              onChange={e => { setNuevaPass(e.target.value); setPassGuardada(false) }}
              placeholder="Mínimo 8 caracteres"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
            />
            <PasswordStrengthMeter password={nuevaPass} />
          </div>

          <div className="aj-field">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              value={confirmarPass}
              onChange={e => setConfirmarPass(e.target.value)}
              placeholder="Repite la contraseña"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>

          {passError && <div className="aj-error">{passError}</div>}

          <div className="aj-actions">
            <button className="aj-btn-primary" onClick={handleCambiarPass} disabled={savingPass}>
              {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
            {passGuardada && <span className="aj-guardado-msg">Contraseña cambiada</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
