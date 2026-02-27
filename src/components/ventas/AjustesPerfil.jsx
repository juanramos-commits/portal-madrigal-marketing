import { useState, useEffect, useRef } from 'react'
import PasswordStrengthMeter from '../PasswordStrengthMeter'

export default function AjustesPerfil({
  perfil,
  rolesComerciales,
  onGuardarPerfil,
  onCambiarContrasena,
  onSubirFoto,
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
    <div className="aj-seccion">
      <h3>Mi perfil</h3>

      <div className="aj-perfil-avatar-row">
        <div className="aj-avatar" onClick={handleFotoClick}>
          {perfil?.foto_url ? (
            <img src={perfil.foto_url} alt="Avatar" />
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
          {guardado && <span className="aj-success">Perfil guardado</span>}
        </div>
      </div>

      <div className="aj-separator" />

      <h4>Cambiar contraseña</h4>
      <div className="aj-form">
        <div className="aj-field">
          <label>Nueva contraseña</label>
          <input
            type="password"
            value={nuevaPass}
            onChange={e => { setNuevaPass(e.target.value); setPassGuardada(false) }}
            placeholder="Mínimo 8 caracteres"
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
          />
        </div>

        {passError && <div className="aj-error">{passError}</div>}

        <div className="aj-actions">
          <button className="aj-btn-primary" onClick={handleCambiarPass} disabled={savingPass}>
            {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
          {passGuardada && <span className="aj-success">Contraseña cambiada</span>}
        </div>
      </div>
    </div>
  )
}
