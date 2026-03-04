import { useState, useEffect } from 'react'
import Select from '../ui/Select'

const ROL_LABELS = { setter: 'Setter', closer: 'Closer', director_ventas: 'Director ventas' }

export default function AjustesComisiones({
  comisionesConfig, equipo,
  onCargar, onCargarEquipo, onGuardar, onAsignarBonus,
}) {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  // Bonus manual
  const [bonusUsuario, setBonusUsuario] = useState('')
  const [bonusMonto, setBonusMonto] = useState('')
  const [bonusConcepto, setBonusConcepto] = useState('')
  const [bonusSaving, setBonusSaving] = useState(false)
  const [bonusOk, setBonusOk] = useState(false)
  const [bonusError, setBonusError] = useState(null)

  useEffect(() => {
    Promise.all([onCargar(), onCargarEquipo?.()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setConfigs(comisionesConfig.map(c => ({ ...c })))
  }, [comisionesConfig])

  const handleChange = (idx, field, value) => {
    setConfigs(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
    setGuardado(false)
  }

  const handleGuardar = async () => {
    setSaving(true); setError(null)
    try {
      await onGuardar(configs.map(c => ({
        id: c.id,
        comision_fija: Number(c.comision_fija) || 0,
        bonus_pago_unico: Number(c.bonus_pago_unico) || 0,
      })))
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) { setError(e.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const handleAsignarBonus = async () => {
    if (!bonusUsuario) { setBonusError('Selecciona un usuario'); return }
    if (!bonusMonto || Number(bonusMonto) <= 0) { setBonusError('Introduce un importe válido'); return }
    setBonusSaving(true); setBonusError(null)
    try {
      await onAsignarBonus({
        usuario_id: bonusUsuario,
        monto: Number(bonusMonto),
        concepto: bonusConcepto || 'Bonus manual',
      })
      setBonusOk(true)
      setBonusMonto('')
      setBonusConcepto('')
      setTimeout(() => setBonusOk(false), 3000)
    } catch (e) { setBonusError(e.message || 'Error al asignar bonus') }
    finally { setBonusSaving(false) }
  }

  const miembrosActivos = equipo
    .filter(m => m.roles.some(r => r.activo))

  return (
    <div className="aj-seccion">
      <h3>Configuración de comisiones</h3>

      {loading ? (
        <div className="aj-empty">Cargando configuración...</div>
      ) : configs.length === 0 ? (
        <div className="aj-empty">No hay configuración de comisiones. Contacta con soporte.</div>
      ) : (
        <>
          <div className="aj-comisiones-table">
            <div className="aj-com-header">
              <span>Rol</span>
              <span>Comisión fija (€)</span>
              <span>Bonus pago único (€)</span>
            </div>
            {configs.map((c, i) => (
              <div key={c.id} className="aj-com-row">
                <span className="aj-com-rol">{ROL_LABELS[c.rol] || c.rol}</span>
                <input
                  type="number" min="0" step="0.01"
                  value={c.comision_fija}
                  onChange={e => handleChange(i, 'comision_fija', e.target.value)}
                />
                <input
                  type="number" min="0" step="0.01"
                  value={c.bonus_pago_unico}
                  onChange={e => handleChange(i, 'bonus_pago_unico', e.target.value)}
                />
              </div>
            ))}
          </div>

          {error && <div className="aj-error">{error}</div>}

          <div className="aj-actions">
            <button className="aj-btn-primary" onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar comisiones'}
            </button>
            {guardado && <span className="aj-success">Comisiones guardadas</span>}
          </div>

          <p className="aj-hint">El bonus se aplica solo en ventas con pago único. Las comisiones se generan al aprobar la venta y son retirables 48h después.</p>
        </>
      )}

      <div className="aj-separator" />

      <h4>Bonus manual</h4>
      <div className="aj-form">
        <div className="aj-field">
          <label>Usuario</label>
          <Select value={bonusUsuario} onChange={e => setBonusUsuario(e.target.value)}>
            <option value="">Seleccionar usuario</option>
            {miembrosActivos.map(m => (
              <option key={m.usuario_id} value={m.usuario_id}>
                {m.usuario?.nombre || m.usuario?.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="aj-form-row">
          <div className="aj-field">
            <label>Importe (€)</label>
            <input type="number" min="0" step="0.01" value={bonusMonto} onChange={e => setBonusMonto(e.target.value)} />
          </div>
          <div className="aj-field">
            <label>Concepto</label>
            <input type="text" value={bonusConcepto} onChange={e => setBonusConcepto(e.target.value)} placeholder="Bonus manual" />
          </div>
        </div>
        {bonusError && <div className="aj-error">{bonusError}</div>}
        <div className="aj-actions">
          <button className="aj-btn-primary" onClick={handleAsignarBonus} disabled={bonusSaving}>
            {bonusSaving ? 'Asignando...' : 'Asignar bonus'}
          </button>
          {bonusOk && <span className="aj-success">Bonus asignado</span>}
        </div>
      </div>
    </div>
  )
}
