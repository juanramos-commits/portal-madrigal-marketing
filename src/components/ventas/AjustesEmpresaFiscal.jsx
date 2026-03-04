import { useState, useEffect } from 'react'

export default function AjustesEmpresaFiscal({
  empresaFiscal, onCargar, onGuardar,
}) {
  const [form, setForm] = useState({
    nombre_fiscal: '',
    cif: '',
    direccion: '',
    ciudad: '',
    codigo_postal: '',
    pais: '',
    concepto_factura: '',
  })
  const [saving, setSaving] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { onCargar() }, [])

  useEffect(() => {
    if (empresaFiscal) {
      setForm({
        nombre_fiscal: empresaFiscal.nombre_fiscal || '',
        cif: empresaFiscal.cif || '',
        direccion: empresaFiscal.direccion || '',
        ciudad: empresaFiscal.ciudad || '',
        codigo_postal: empresaFiscal.codigo_postal || '',
        pais: empresaFiscal.pais || '',
        concepto_factura: empresaFiscal.concepto_factura || '',
      })
    }
  }, [empresaFiscal?.id])

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setGuardado(false)
  }

  const handleGuardar = async () => {
    if (!form.nombre_fiscal.trim()) { setError('El nombre fiscal es obligatorio'); return }
    setSaving(true); setError(null)
    try {
      await onGuardar(form)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e) { setError(e.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="aj-seccion">
      <h3>Datos fiscales de la empresa</h3>
      <div className="aj-form">
        <div className="aj-form-row">
          <div className="aj-field">
            <label>Nombre fiscal *</label>
            <input type="text" value={form.nombre_fiscal} onChange={e => handleChange('nombre_fiscal', e.target.value)} placeholder="Madrigal Marketing S.L." />
          </div>
          <div className="aj-field">
            <label>CIF</label>
            <input type="text" value={form.cif} onChange={e => handleChange('cif', e.target.value)} />
          </div>
        </div>
        <div className="aj-field">
          <label>Dirección</label>
          <textarea value={form.direccion} onChange={e => handleChange('direccion', e.target.value)} rows={2} />
        </div>
        <div className="aj-form-row-3">
          <div className="aj-field">
            <label>Ciudad</label>
            <input type="text" value={form.ciudad} onChange={e => handleChange('ciudad', e.target.value)} />
          </div>
          <div className="aj-field">
            <label>Código postal</label>
            <input type="text" value={form.codigo_postal} onChange={e => handleChange('codigo_postal', e.target.value)} />
          </div>
          <div className="aj-field">
            <label>País</label>
            <input type="text" value={form.pais} onChange={e => handleChange('pais', e.target.value)} placeholder="España" />
          </div>
        </div>
        <div className="aj-field">
          <label>Concepto de factura</label>
          <input type="text" value={form.concepto_factura} onChange={e => handleChange('concepto_factura', e.target.value)} placeholder="Servicios de intermediación comercial" />
        </div>
        {error && <div className="aj-error">{error}</div>}
        <div className="aj-actions">
          <button className="aj-btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {guardado && <span className="aj-success">Datos guardados</span>}
        </div>
      </div>
    </div>
  )
}
