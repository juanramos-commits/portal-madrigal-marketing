import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function AjustesCuentaBancaria() {
  const { user } = useAuth()
  const [iban, setIban] = useState('')
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)
  const [dfId, setDfId] = useState(null)

  const cargar = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ventas_datos_fiscales')
      .select('id, cuenta_bancaria_iban')
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (data) {
      setIban(data.cuenta_bancaria_iban || '')
      setDfId(data.id)
    }
  }, [user?.id])

  useEffect(() => { cargar() }, [cargar])

  const formatIban = (val) => {
    const clean = val.replace(/\s/g, '').toUpperCase()
    return clean.replace(/(.{4})/g, '$1 ').trim()
  }

  const handleGuardar = async () => {
    setSaving(true)
    setError(null)
    try {
      if (dfId) {
        const { error: err } = await supabase
          .from('ventas_datos_fiscales')
          .update({ cuenta_bancaria_iban: iban.replace(/\s/g, ''), updated_at: new Date().toISOString() })
          .eq('id', dfId)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('ventas_datos_fiscales')
          .insert({ usuario_id: user.id, cuenta_bancaria_iban: iban.replace(/\s/g, '') })
        if (err) throw err
      }
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="aj-seccion">
      <h3>Cuenta bancaria</h3>
      <div className="aj-form">
        <div className="aj-field">
          <label>IBAN</label>
          <input
            type="text"
            value={formatIban(iban)}
            onChange={e => { setIban(e.target.value.replace(/\s/g, '')); setGuardado(false) }}
            placeholder="ES00 0000 0000 0000 0000 0000"
            maxLength={42}
          />
          <span className="aj-field-hint">Tu cuenta para recibir retiros de comisiones</span>
        </div>

        {error && <div className="aj-error">{error}</div>}

        <div className="aj-actions">
          <button className="aj-btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {guardado && <span className="aj-success">IBAN guardado</span>}
        </div>
      </div>
    </div>
  )
}
