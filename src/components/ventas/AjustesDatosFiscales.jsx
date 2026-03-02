import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import WalletDatosFiscales from './WalletDatosFiscales'

export default function AjustesDatosFiscales() {
  const { user } = useAuth()
  const [datosFiscales, setDatosFiscales] = useState(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('ventas_datos_fiscales')
      .select('*')
      .eq('usuario_id', user.id)
      .maybeSingle()
    setDatosFiscales(data || {
      usuario_id: user.id,
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
    setLoading(false)
  }, [user?.id])

  useEffect(() => { cargar() }, [cargar])

  const handleGuardar = async (datos) => {
    if (datosFiscales?.id) {
      const { error } = await supabase
        .from('ventas_datos_fiscales')
        .update({ ...datos, updated_at: new Date().toISOString() })
        .eq('id', datosFiscales.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('ventas_datos_fiscales')
        .insert({ ...datos, usuario_id: user.id })
      if (error) throw error
    }
    await cargar()
  }

  if (loading) return <div className="aj-loading">Cargando...</div>

  return (
    <div className="aj-seccion">
      <h3>Datos de facturación</h3>
      <WalletDatosFiscales
        datosFiscales={datosFiscales}
        onGuardar={handleGuardar}
      />
    </div>
  )
}
