import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Toggle from '../ui/Toggle'
import Select from '../ui/Select'
import Modal from '../ui/Modal'

export default function VentaPopupCierre({ lead, onConfirm, onCancel }) {
  const [paquetes, setPaquetes] = useState([])
  const [loadingPaquetes, setLoadingPaquetes] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)

  const [form, setForm] = useState({
    fecha_venta: new Date().toISOString().split('T')[0],
    paquete_id: '',
    importe: '',
    metodo_pago: '',
    es_pago_unico: false,
  })

  useEffect(() => {
    const cargar = async () => {
      setLoadingPaquetes(true)
      const { data } = await supabase
        .from('ventas_paquetes')
        .select('*')
        .eq('activo', true)
        .order('orden')
      setPaquetes(data || [])
      setLoadingPaquetes(false)
    }
    cargar()
  }, [])

  const handlePaqueteChange = (paqueteId) => {
    const paquete = paquetes.find(p => p.id === paqueteId)
    setForm(prev => ({
      ...prev,
      paquete_id: paqueteId,
      importe: paquete ? String(paquete.precio) : prev.importe,
    }))
    setErrores(prev => ({ ...prev, paquete_id: null }))
  }

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrores(prev => ({ ...prev, [key]: null }))
  }

  const validar = () => {
    const e = {}
    if (!form.fecha_venta) e.fecha_venta = 'La fecha es obligatoria'
    if (!form.paquete_id) e.paquete_id = 'Selecciona un paquete'
    if (!form.importe || Number(form.importe) <= 0) e.importe = 'El importe debe ser mayor que 0'
    if (!form.metodo_pago) e.metodo_pago = 'Selecciona el método de pago'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!validar()) return

    setSubmitting(true)
    setErrorGeneral(null)

    try {
      const paquete = paquetes.find(p => p.id === form.paquete_id)
      await onConfirm({
        lead_id: lead.id,
        lead_nombre: lead.nombre,
        closer_id: lead.closer?.id || lead.closer_asignado_id || null,
        setter_id: lead.setter?.id || lead.setter_asignado_id || null,
        paquete_id: form.paquete_id,
        paquete_nombre: paquete?.nombre,
        fecha_venta: form.fecha_venta,
        importe: Number(form.importe),
        metodo_pago: form.metodo_pago,
        es_pago_unico: form.es_pago_unico,
      })
    } catch (err) {
      setErrorGeneral(err.message || 'Error al registrar la venta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title="Registrar venta"
      footer={
        <>
          <button type="button" className="ui-btn ui-btn--secondary ui-btn--md" onClick={onCancel} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" form="venta-cierre-form" className="ui-btn ui-btn--primary ui-btn--md" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrar venta'}
          </button>
        </>
      }
    >
      <form id="venta-cierre-form" className="vv-form" onSubmit={handleSubmit}>
        {/* Lead name */}
        <div className="vv-field">
          <label>Lead</label>
          <div className="vv-field-readonly">{lead.nombre}</div>
        </div>

        {/* Setter / Closer info */}
        <div className="vv-field-row">
          <div className="vv-field">
            <label>Setter</label>
            <div className="vv-field-readonly">
              {lead.setter?.nombre || lead.setter?.email || 'Sin asignar'}
            </div>
          </div>
          <div className="vv-field">
            <label>Closer</label>
            <div className="vv-field-readonly">
              {lead.closer?.nombre || lead.closer?.email || 'Sin asignar'}
            </div>
          </div>
        </div>

        {/* Date */}
        <div className="vv-field">
          <label>Fecha de la venta</label>
          <input
            type="date"
            value={form.fecha_venta}
            onChange={e => handleChange('fecha_venta', e.target.value)}
          />
          {errores.fecha_venta && <span className="vv-field-error">{errores.fecha_venta}</span>}
        </div>

        {/* Package */}
        <div className="vv-field">
          <label>Producto / Paquete</label>
          {loadingPaquetes ? (
            <div className="vv-field-readonly">Cargando paquetes...</div>
          ) : (
            <Select
              value={form.paquete_id}
              onChange={e => handlePaqueteChange(e.target.value)}
            >
              <option value="">Seleccionar paquete</option>
              {paquetes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {Number(p.precio).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                </option>
              ))}
            </Select>
          )}
          {errores.paquete_id && <span className="vv-field-error">{errores.paquete_id}</span>}
        </div>

        {/* Amount */}
        <div className="vv-field">
          <label>Importe total (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.importe}
            onChange={e => handleChange('importe', e.target.value)}
            placeholder="0,00"
          />
          {errores.importe && <span className="vv-field-error">{errores.importe}</span>}
        </div>

        {/* Payment method */}
        <div className="vv-field">
          <label>Método de pago</label>
          <Select
            value={form.metodo_pago}
            onChange={e => handleChange('metodo_pago', e.target.value)}
          >
            <option value="">Seleccionar método</option>
            <option value="stripe">Stripe</option>
            <option value="sequra">SeQura</option>
            <option value="transferencia">Transferencia</option>
          </Select>
          {errores.metodo_pago && <span className="vv-field-error">{errores.metodo_pago}</span>}
        </div>

        {/* Single payment toggle */}
        <div className="vv-field vv-field-toggle">
          <Toggle checked={form.es_pago_unico} onChange={v => handleChange('es_pago_unico', v)} label="¿Es pago único?" />
        </div>

        {errorGeneral && <div className="vv-error-general">{errorGeneral}</div>}
      </form>
    </Modal>
  )
}
