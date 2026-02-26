import { useState, useEffect } from 'react'

export default function WalletDatosFiscales({ datosFiscales, onGuardar }) {
  const [form, setForm] = useState({
    nombre_fiscal: '',
    nif_cif: '',
    direccion: '',
    ciudad: '',
    codigo_postal: '',
    pais: '',
    serie_factura: 'F',
    iva_porcentaje: 0,
    iva_incluido: false,
    cuenta_bancaria_iban: '',
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
        serie_factura: datosFiscales.serie_factura || 'F',
        iva_porcentaje: datosFiscales.iva_porcentaje ?? 0,
        iva_incluido: datosFiscales.iva_incluido || false,
        cuenta_bancaria_iban: datosFiscales.cuenta_bancaria_iban || '',
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
    if (!form.cuenta_bancaria_iban.trim()) e.cuenta_bancaria_iban = 'Obligatorio para retiros'
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
    } catch (_) {
      setErrores({ _general: 'Error al guardar datos' })
    } finally {
      setSaving(false)
    }
  }

  const siguienteNumero = datosFiscales?.siguiente_numero_factura || 1

  return (
    <form className="wt-datos-fiscales" onSubmit={handleSubmit}>
      <div className="wt-df-grid">
        <div className="wt-field">
          <label>Nombre o raz\u00f3n social *</label>
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
          <label>Direcci\u00f3n *</label>
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
          <label>C\u00f3digo postal</label>
          <input
            type="text"
            value={form.codigo_postal}
            onChange={e => handleChange('codigo_postal', e.target.value)}
          />
        </div>

        <div className="wt-field">
          <label>Pa\u00eds *</label>
          <input
            type="text"
            value={form.pais}
            onChange={e => handleChange('pais', e.target.value)}
            placeholder="Espa\u00f1a"
          />
          {errores.pais && <span className="wt-field-error">{errores.pais}</span>}
        </div>

        <div className="wt-field">
          <label>IBAN *</label>
          <input
            type="text"
            value={form.cuenta_bancaria_iban}
            onChange={e => handleChange('cuenta_bancaria_iban', e.target.value)}
            placeholder="ES00 0000 0000 0000 0000"
          />
          {errores.cuenta_bancaria_iban && <span className="wt-field-error">{errores.cuenta_bancaria_iban}</span>}
        </div>
      </div>

      <div className="wt-df-separator" />

      <h4 className="wt-df-section-title">Facturaci\u00f3n</h4>
      <div className="wt-df-grid">
        <div className="wt-field">
          <label>Serie de facturaci\u00f3n</label>
          <input
            type="text"
            value={form.serie_factura}
            onChange={e => handleChange('serie_factura', e.target.value)}
            placeholder="F"
          />
        </div>

        <div className="wt-field">
          <label>Siguiente n\u00famero de factura</label>
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
          <label
            className="wt-toggle-label"
            onClick={() => handleChange('iva_incluido', !form.iva_incluido)}
          >
            <span className={`wt-toggle ${form.iva_incluido ? 'active' : ''}`}>
              <span className="wt-toggle-knob" />
            </span>
            <span>\u00bfIVA incluido en comisi\u00f3n?</span>
          </label>
          <span className="wt-field-hint">
            {form.iva_incluido
              ? 'El IVA sale del monto de la comisi\u00f3n'
              : 'El IVA se a\u00f1ade encima del monto de la comisi\u00f3n'}
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
