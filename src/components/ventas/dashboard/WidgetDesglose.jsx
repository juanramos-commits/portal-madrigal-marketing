import { memo, useCallback } from 'react'
import { Download } from 'lucide-react'

function tasaClass(tasa) {
  const v = Number(tasa) || 0
  if (v >= 50) return 'db-wconv-tasa-high'
  if (v >= 25) return 'db-wconv-tasa-mid'
  return 'db-wconv-tasa-low'
}

const CLOSER_COLS = [
  { key: 'agendas', label: 'Agendas' },
  { key: 'realizadas', label: 'Realizadas' },
  { key: 'canceladas', label: 'Canceladas' },
  { key: 'no_show', label: 'No Show' },
  { key: 'seguimientos', label: 'Seguim.' },
  { key: 'nurturing', label: 'Nurturing' },
  { key: 'lost', label: 'Lost' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'tasa_global', label: 'Tasa Global', isTasa: true },
  { key: 'tasa_relativa', label: 'Tasa Relat.', isTasa: true },
]

const SETTER_COLS = [
  { key: 'leads_gestionados', label: 'Leads' },
  { key: 'agendados', label: 'Agendados' },
  { key: 'ghosting', label: 'Ghosting' },
  { key: 'seguimientos', label: 'Seguim.' },
  { key: 'nurturing', label: 'Nurturing' },
  { key: 'lost', label: 'Lost' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'tasa_agenda', label: 'Tasa Agenda', isTasa: true },
  { key: 'tasa_venta', label: 'Tasa Venta', isTasa: true },
]

function buildCsv(rows, cols, title) {
  const header = ['Nombre', ...cols.map(c => c.label)].join(';')
  const body = rows.map(r =>
    [r.nombre, ...cols.map(c => c.isTasa ? `${Number(r[c.key] || 0).toFixed(1)}%` : (r[c.key] || 0))].join(';')
  )
  // Totals row
  const totals = ['TOTAL', ...cols.map(c => {
    if (c.isTasa) {
      const vals = rows.map(r => Number(r[c.key]) || 0)
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      return `${avg.toFixed(1)}%`
    }
    return rows.reduce((sum, r) => sum + (Number(r[c.key]) || 0), 0)
  })].join(';')
  return `${title}\n${header}\n${body.join('\n')}\n${totals}`
}

export default memo(function WidgetDesglose({ widgetDef, data }) {
  const rows = Array.isArray(data) ? data : []
  const isCloser = widgetDef?.dataKey === 'desglose_closers'
  const cols = isCloser ? CLOSER_COLS : SETTER_COLS

  const handleExport = useCallback(() => {
    const title = isCloser ? 'Desglose Closers' : 'Desglose Setters'
    const csv = buildCsv(rows, cols, title)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${isCloser ? 'desglose-closers' : 'desglose-setters'}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [rows, cols, isCloser])

  if (rows.length === 0) return <div className="db-widget-empty">Sin datos</div>

  // Calculate totals
  const totals = {}
  for (const col of cols) {
    if (col.isTasa) {
      const vals = rows.map(r => Number(r[col.key]) || 0)
      totals[col.key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    } else {
      totals[col.key] = rows.reduce((sum, r) => sum + (Number(r[col.key]) || 0), 0)
    }
  }

  return (
    <div className="db-wdesglose">
      <button className="db-wdesglose-export" onClick={handleExport} title="Descargar CSV" aria-label="Descargar informe CSV">
        <Download size={14} />
      </button>
      <div className="db-wdesglose-scroll">
        <table className="db-wtable db-wtable--desglose">
          <caption className="sr-only">
            {isCloser ? 'Desglose por closer' : 'Desglose por setter'}
          </caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              {cols.map(c => <th key={c.key} scope="col">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.usuario_id || i}>
                <td className="db-wtable-name" title={r.nombre}>{r.nombre}</td>
                {cols.map(c => (
                  <td key={c.key} className={c.isTasa ? tasaClass(r[c.key]) : 'db-wconv-count'}>
                    {c.isTasa ? `${(Number(r[c.key]) || 0).toFixed(1)}%` : (r[c.key] || 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="db-wdesglose-totals">
              <td className="db-wtable-name"><strong>Total</strong></td>
              {cols.map(c => (
                <td key={c.key} className={c.isTasa ? tasaClass(totals[c.key]) : 'db-wconv-count'}>
                  <strong>{c.isTasa ? `${totals[c.key].toFixed(1)}%` : totals[c.key]}</strong>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
})
