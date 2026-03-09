import { useState, useEffect, useCallback } from 'react'

const CATEGORIES = [
  { key: 'marketing', label: 'Marketing y promociones' },
  { key: 'producto', label: 'Actualizaciones de producto' },
  { key: 'facturacion', label: 'Facturación y pagos' },
  { key: 'novedades', label: 'Novedades y anuncios' },
  { key: 'newsletter', label: 'Newsletter semanal' },
]

const FREQUENCIES = [
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'none', label: 'No recibir emails' },
]

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export default function PreferencesForm({ token: propToken }) {
  const token = propToken || new URLSearchParams(window.location.search).get('token')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [categories, setCategories] = useState({})
  const [frequency, setFrequency] = useState('weekly')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('Token no válido')
      return
    }

    async function load() {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/email-preferences?token=${encodeURIComponent(token)}`)
        if (!res.ok) throw new Error('No se pudieron cargar las preferencias')
        const data = await res.json()
        setCategories(data.categories || {})
        setFrequency(data.frequency || 'weekly')
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  const toggleCategory = useCallback((key) => {
    setCategories(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/email-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, categories, frequency }),
      })
      if (!res.ok) throw new Error('Error al guardar preferencias')
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }, [token, categories, frequency])

  if (!token) {
    return (
      <div className="ve-preferences-page">
        <div className="ve-card">
          <h2>Enlace no válido</h2>
          <p>Este enlace de preferencias no es válido o ha expirado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ve-preferences-page">
      <div className="ve-card">
        <h2>Preferencias de email</h2>
        <p>Gestiona qué tipo de emails deseas recibir y con qué frecuencia.</p>

        {loading ? (
          <div className="ve-loading" />
        ) : error ? (
          <p style={{ color: '#dc3545', fontSize: 'var(--font-sm)' }}>{error}</p>
        ) : (
          <>
            <div className="ve-preferences-section">
              <h4>Categorías</h4>
              {CATEGORIES.map(cat => (
                <label key={cat.key} className="ve-preferences-check">
                  <input
                    type="checkbox"
                    checked={!!categories[cat.key]}
                    onChange={() => toggleCategory(cat.key)}
                  />
                  {cat.label}
                </label>
              ))}
            </div>

            <div className="ve-preferences-section">
              <h4>Frecuencia</h4>
              {FREQUENCIES.map(f => (
                <label key={f.value} className="ve-preferences-check">
                  <input
                    type="radio"
                    name="frequency"
                    value={f.value}
                    checked={frequency === f.value}
                    onChange={() => { setFrequency(f.value); setSaved(false) }}
                  />
                  {f.label}
                </label>
              ))}
            </div>

            <button
              className="ve-btn ve-btn--primary"
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%' }}
            >
              {saving ? 'Guardando…' : 'Guardar preferencias'}
            </button>

            {saved && (
              <p style={{ color: '#198754', fontSize: 'var(--font-sm)', textAlign: 'center', marginTop: 'var(--space-sm)' }}>
                Preferencias guardadas correctamente.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
