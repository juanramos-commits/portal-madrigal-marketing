import { useState, useEffect, useCallback } from 'react'
import { getSettings, updateSetting, getSuppressions } from '../lib/coldOutreach'
import { supabase } from '../lib/supabase'

export function useOutreachSettings() {
  const [settings, setSettings] = useState({})
  const [warmupSchedule, setWarmupSchedule] = useState([])
  const [suppressionCount, setSuppressionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await getSettings()

    if (err) { setError(err.message); setLoading(false); return }
    // Convert array of { key, value } rows to a key-value map
    const map = {}
    ;(data || []).forEach(row => { map[row.key] = row.value })
    setSettings(map)

    // Load warmup schedule
    const { data: warmup } = await supabase
      .from('ventas_co_warmup_schedule')
      .select('*')
      .order('day')
    setWarmupSchedule(warmup || [])

    // Load suppression count
    const { count } = await supabase.from('ventas_co_suppressions').select('*', { count: 'exact', head: true })
    setSuppressionCount(count ?? 0)

    setLoading(false)
  }, [])

  const actualizar = useCallback(async (key, value) => {
    // Optimistic update
    setSettings(prev => ({ ...prev, [key]: value }))

    const { error: err } = await updateSetting(key, value)
    if (err) {
      // Revert on error
      cargar()
      return { error: err }
    }
    return {}
  }, [cargar])

  const actualizarWarmup = useCallback(async (index, maxSends) => {
    const row = warmupSchedule[index]
    if (!row) return

    // Optimistic update
    setWarmupSchedule(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], max_sends: maxSends }
      return updated
    })

    const { error: err } = await supabase
      .from('ventas_co_warmup_schedule')
      .update({ max_sends: maxSends })
      .eq('id', row.id)

    if (err) {
      cargar()
      return { error: err }
    }
    return {}
  }, [warmupSchedule, cargar])

  useEffect(() => { cargar() }, [cargar])

  return {
    settings, warmupSchedule, suppressionCount,
    loading, error,
    cargar, actualizar, actualizarWarmup,
  }
}
