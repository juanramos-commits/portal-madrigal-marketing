import { useState, useEffect } from 'react'
import Toggle from '../ui/Toggle'

function validarDatosBancarios(form) {
  const tipo = form.tipo_cuenta || 'iban'
  if (!form.titular_cuenta?.trim()) return { titular_cuenta: 'Obligatorio' }

  switch (tipo) {
    case 'iban':
      if (!form.cuenta_bancaria_iban?.trim() || form.cuenta_bancaria_iban.trim().length < 15)
        return { cuenta_bancaria_iban: 'IBAN inválido (mínimo 15 caracteres)' }
      break
    case 'us':
      if (!form.routing_number?.trim() || form.routing_number.replace(/\D/g, '').length !== 9)
        return { routing_number: 'Debe tener 9 dígitos' }
      if (!form.account_number?.trim())
        return { account_number: 'Obligatorio' }
      break
    case 'uk':
      if (!form.sort_code?.trim() || form.sort_code.replace(/\D/g, '').length !== 6)
        return { sort_code: 'Debe tener 6 dígitos' }
      if (!form.account_number?.trim() || form.account_number.replace(/\D/g, '').length !== 8)
        return { account_number: 'Debe tener 8 dígitos' }
      break
    case 'other':
      if (!form.swift_bic?.trim())
        return { swift_bic: 'Obligatorio' }
      if (!form.account_number?.trim())
        return { account_number: 'Obligatorio' }
      break
  }
  return null
}

export default function WalletDatosFiscales({ datosFiscales, onGuardar }) {
  const [form, setForm] = useState({
    nombre_fiscal: '',
    nif_cif: '',
    direccion: '',
    ciudad: '',
    codigo_postal: '',
    pais: '',
    tipo_cuenta: 'iban',
    cuenta_bancaria_iban: '',
    swift_bic: '',
    routing_number: '',
    account_number: '',
    sort_code: '',
    titular_cuenta: '',
    serie_factura: 'F',
    iva_porcentaje: 0,
    iva_incluido: false,
  })
  const [errores, setErrores] = useState({})
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    if (datosFiscales) {
      setForm({
        nombre_fiscal: datosFiscales.nombre_fiscal || '',
        nif_cif: datosFiscales.nif_cif || '',
        direccion: datosFiscales.direccion || '',
        ciudad: datosFiscales.ciudad || '',
        codigo_postal: datosFiscales.codigo_postal || '',
        pais: datosFiscales.pais || '',
        tipo_cuenta: datosFiscales.tipo_cuenta || 'iban',
        cuenta_bancaria_iban: datosFiscales.cuenta_bancaria_iban || '',
        swift_bic: datosFiscales.swift_bic || '',
        routing_number: datosFiscales.routing_number || '',
        account_number: datosFiscales.account_number || '',
        sort_code: datosFiscales.sort_code || '',
        titular_cuenta: datosFiscales.titular_cuenta || '',
        serie_factura: datosFiscales.serie_factura || 'F',
        iva_porcentaje: datosFiscales.iva_porcentaje ?? 0,
        iva_incluido: datosFiscales.iva_incluido || false,
      })
    }
  }, [datosFiscales])

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrores(prev => ({ ...prev, [key]: null }))
    setGuardado(false)
  }

  const validar = () => {
    const e = {}
    if (!form.nombre_fiscal.trim()) e.nombre_fiscal = 'Obligatorio'
    if (!form.nif_cif.trim()) e.nif_cif = 'Obligatorio'
    if (!form.direccion.trim()) e.direccion = 'Obligatorio'
    if (!form.pais.trim()) e.pais = 'Obligatorio'

    const errorBancario = validarDatosBancarios(form)
    if (errorBancario) Object.assign(e, errorBancario)

    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validar()) return

    setSaving(true)
    try {
      await onGuardar({
        ...datosFiscales,
        ...form,
        iva_porcentaje: Number(form.iva_porcentaje) || 0,
      })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (err) {
      console.warn('Error al guardar datos fiscales:', err)
      setErrores({ _general: 'Error al guardar datos' })
    } finally {
      setSaving(false)
    }
  }

  const siguienteNumero = datosFiscales?.siguiente_numero_factura || 1
  const tipoCuenta = form.tipo_cuenta || 'iban'

  return (
    <form className="wt-datos-fiscales" onSubmit={handleSubmit}>
      <div className="wt-df-grid">
        <div className="wt-field">
          <label>Nombre o razón social *</label>
          <input
            type="text"
            value={form.nombre_fiscal}
            onChange={e => handleChange('nombre_fiscal', e.target.value)}
          />
          {errores.nombre_fiscal && <span className="wt-field-error">{errores.nombre_fiscal}</span>}
        </div>

        <div className="wt-field">
          <label>NIF/CIF/Tax ID *</label>
          <input
            type="text"
            value={form.nif_cif}
            onChange={e => handleChange('nif_cif', e.target.value)}
          />
          {errores.nif_cif && <span className="wt-field-error">{errores.nif_cif}</span>}
        </div>

        <div className="wt-field wt-field-full">
          <label>Dirección *</label>
          <textarea
            value={form.direccion}
            onChange={e => handleChange('direccion', e.target.value)}
            rows={2}
          />
          {errores.direccion && <span className="wt-field-error">{errores.direccion}</span>}
        </div>

        <div className="wt-field">
          <label>Ciudad</label>
          <input
            type="text"
            value={form.ciudad}
            onChange={e => handleChange('ciudad', e.target.value)}
          />
        </div>

        <div className="wt-field">
          <label>Código postal</label>
          <input
            type="text"
            value={form.codigo_postal}
            onChange={e => handleChange('codigo_postal', e.target.value)}
          />
        </div>

        <div className="wt-field">
          <label>País *</label>
          <input
            type="text"
            value={form.pais}
            onChange={e => handleChange('pais', e.target.value)}
            placeholder="España"
          />
          {errores.pais && <span className="wt-field-error">{errores.pais}</span>}
        </div>
      </div>

      <div className="wt-df-separator" />

      <h4 className="wt-df-section-title">Datos bancarios</h4>
      <div className="wt-df-grid">
        <div className="wt-field">
          <label>Titular de la cuenta *</label>
          <input
            type="text"
            value={form.titular_cuenta}
            onChange={e => handleChange('titular_cuenta', e.target.value)}
            placeholder="Nombre completo del titular"
          />
          {errores.titular_cuenta && <span className="wt-field-error">{errores.titular_cuenta}</span>}
        </div>

        <div className="wt-field">
          <label>Tipo de cuenta *</label>
          <select
            value={tipoCuenta}
            onChange={e => handleChange('tipo_cuenta', e.target.value)}
          >
            <option value="iban">IBAN (Europa y otros)</option>
            <option value="us">Cuenta EEUU (Routing + Account)</option>
            <option value="uk">Cuenta UK (Sort Code + Account)</option>
            <option value="other">Otra (SWIFT + Account)</option>
          </select>
        </div>

        {/* IBAN fields */}
        {tipoCuenta === 'iban' && (
          <>
            <div className="wt-field wt-field-full">
              <label>IBAN *</label>
              <input
                type="text"
                value={form.cuenta_bancaria_iban}
                onChange={e => handleChange('cuenta_bancaria_iban', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ES0000000000000000000000"
                maxLength={34}
              />
              <span className="wt-field-hint">Sin espacios. De 15 a 34 caracteres según el país.</span>
              {errores.cuenta_bancaria_iban && <span className="wt-field-error">{errores.cuenta_bancaria_iban}</span>}
            </div>
            <div className="wt-field">
              <label>SWIFT/BIC</label>
              <input
                type="text"
                value={form.swift_bic}
                onChange={e => handleChange('swift_bic', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="BSCHESMMXXX"
                maxLength={11}
              />
              <span className="wt-field-hint">Opcional. 8 u 11 caracteres.</span>
            </div>
          </>
        )}

        {/* US fields */}
        {tipoCuenta === 'us' && (
          <>
            <div className="wt-field">
              <label>Routing Number (ABA) *</label>
              <input
                type="text"
                value={form.routing_number}
                onChange={e => handleChange('routing_number', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="021000021"
                maxLength={9}
              />
              <span className="wt-field-hint">9 dígitos</span>
              {errores.routing_number && <span className="wt-field-error">{errores.routing_number}</span>}
            </div>
            <div className="wt-field">
              <label>Account Number *</label>
              <input
                type="text"
                value={form.account_number}
                onChange={e => handleChange('account_number', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="123456789012"
                maxLength={17}
              />
              {errores.account_number && <span className="wt-field-error">{errores.account_number}</span>}
            </div>
            <div className="wt-field">
              <label>SWIFT/BIC</label>
              <input
                type="text"
                value={form.swift_bic}
                onChange={e => handleChange('swift_bic', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="CHASUS33"
                maxLength={11}
              />
              <span className="wt-field-hint">Opcional para transferencias internacionales</span>
            </div>
          </>
        )}

        {/* UK fields */}
        {tipoCuenta === 'uk' && (
          <>
            <div className="wt-field">
              <label>Sort Code *</label>
              <input
                type="text"
                value={form.sort_code}
                onChange={e => handleChange('sort_code', e.target.value.replace(/[^0-9-]/g, ''))}
                placeholder="12-34-56"
                maxLength={8}
              />
              <span className="wt-field-hint">6 dígitos (con o sin guiones)</span>
              {errores.sort_code && <span className="wt-field-error">{errores.sort_code}</span>}
            </div>
            <div className="wt-field">
              <label>Account Number *</label>
              <input
                type="text"
                value={form.account_number}
                onChange={e => handleChange('account_number', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="12345678"
                maxLength={8}
              />
              <span className="wt-field-hint">8 dígitos</span>
              {errores.account_number && <span className="wt-field-error">{errores.account_number}</span>}
            </div>
            <div className="wt-field">
              <label>SWIFT/BIC</label>
              <input
                type="text"
                value={form.swift_bic}
                onChange={e => handleChange('swift_bic', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="BUKBGB22"
                maxLength={11}
              />
            </div>
          </>
        )}

        {/* Other fields */}
        {tipoCuenta === 'other' && (
          <>
            <div className="wt-field">
              <label>SWIFT/BIC *</label>
              <input
                type="text"
                value={form.swift_bic}
                onChange={e => handleChange('swift_bic', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="BSCHESMMXXX"
                maxLength={11}
              />
              {errores.swift_bic && <span className="wt-field-error">{errores.swift_bic}</span>}
            </div>
            <div className="wt-field">
              <label>Account Number *</label>
              <input
                type="text"
                value={form.account_number}
                onChange={e => handleChange('account_number', e.target.value)}
                placeholder="Número de cuenta"
                maxLength={34}
              />
              {errores.account_number && <span className="wt-field-error">{errores.account_number}</span>}
            </div>
          </>
        )}
      </div>

      <div className="wt-df-separator" />

      <h4 className="wt-df-section-title">Facturación</h4>
      <div className="wt-df-grid">
        <div className="wt-field">
          <label>Serie de facturación</label>
          <input
            type="text"
            value={form.serie_factura}
            onChange={e => handleChange('serie_factura', e.target.value)}
            placeholder="F"
          />
        </div>

        <div className="wt-field">
          <label>Siguiente número de factura</label>
          <input type="text" value={siguienteNumero} readOnly className="wt-input-readonly" />
        </div>

        <div className="wt-field">
          <label>Porcentaje IVA/Impuesto (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.iva_porcentaje}
            onChange={e => handleChange('iva_porcentaje', e.target.value)}
          />
        </div>

        <div className="wt-field wt-field-toggle-wrap">
          <Toggle checked={form.iva_incluido} onChange={v => handleChange('iva_incluido', v)} label="¿IVA incluido en comisión?" />
          <span className="wt-field-hint">
            {form.iva_incluido
              ? 'El IVA sale del importe de la comisión'
              : 'El IVA se añade encima del importe de la comisión'}
          </span>
        </div>
      </div>

      {errores._general && <div className="wt-error-general">{errores._general}</div>}

      <div className="wt-df-actions">
        <button type="submit" className="wt-btn-primary" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {guardado && <span className="wt-success-msg">Datos guardados correctamente</span>}
      </div>
    </form>
  )
}
