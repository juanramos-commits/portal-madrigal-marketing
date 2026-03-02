import { jsPDF } from 'jspdf'
import { formatMoneda } from './formatters'

function formatFechaLarga(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function generarFacturaPDF(factura) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20
  const colW = (pageW - margin * 2) / 2
  let y = margin

  // ── Header line ────────────────────────────────────────────────────
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageW - margin, y)
  y += 10

  // ── Title ──────────────────────────────────────────────────────────
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(30, 30, 30)
  doc.text(`FACTURA Nº ${factura.numero_factura}`, pageW / 2, y, { align: 'center' })
  y += 8

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Fecha: ${formatFechaLarga(factura.fecha_emision)}`, pageW / 2, y, { align: 'center' })
  y += 6

  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 12

  // ── Emisor / Receptor ──────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('EMISOR', margin, y)
  doc.text('RECEPTOR', margin + colW + 10, y)
  y += 6

  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.setFont('Helvetica', 'bold')
  doc.text(factura.emisor_nombre || '', margin, y)
  doc.text(factura.receptor_nombre || '', margin + colW + 10, y)
  y += 5.5

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(60, 60, 60)

  const emisorLines = [
    factura.emisor_nif ? `NIF/CIF: ${factura.emisor_nif}` : '',
    factura.emisor_direccion || '',
    [factura.emisor_ciudad, factura.emisor_cp].filter(Boolean).join(', '),
    factura.emisor_pais || '',
  ].filter(Boolean)

  const receptorLines = [
    factura.receptor_cif ? `CIF: ${factura.receptor_cif}` : '',
    factura.receptor_direccion || '',
    [factura.receptor_ciudad, factura.receptor_cp].filter(Boolean).join(', '),
    factura.receptor_pais || '',
  ].filter(Boolean)

  const maxLines = Math.max(emisorLines.length, receptorLines.length)
  for (let i = 0; i < maxLines; i++) {
    if (emisorLines[i]) doc.text(emisorLines[i], margin, y)
    if (receptorLines[i]) doc.text(receptorLines[i], margin + colW + 10, y)
    y += 5
  }

  y += 8

  // ── Separator ──────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // ── Concepto ───────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('CONCEPTO', margin, y)
  y += 6

  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(factura.concepto || 'Servicios de intermediación comercial', margin, y)
  y += 12

  // ── Separator ──────────────────────────────────────────────────────
  doc.line(margin, y, pageW - margin, y)
  y += 10

  // ── Amounts ────────────────────────────────────────────────────────
  const rightX = pageW - margin
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)

  doc.text('Base imponible:', rightX - 70, y)
  doc.setFont('Helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(formatMoneda(factura.base_imponible), rightX, y, { align: 'right' })
  y += 7

  doc.setFont('Helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  const ivaPct = Number(factura.iva_porcentaje) || 0
  doc.text(`IVA (${ivaPct}%):`, rightX - 70, y)
  doc.text(formatMoneda(factura.iva_monto || 0), rightX, y, { align: 'right' })
  y += 5

  doc.setLineWidth(0.3)
  doc.line(rightX - 70, y, rightX, y)
  y += 7

  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(30, 30, 30)
  doc.text('TOTAL:', rightX - 70, y)
  doc.text(formatMoneda(factura.total), rightX, y, { align: 'right' })
  y += 15

  // ── Separator ──────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageW - margin, y)
  y += 10

  // ── Payment info ───────────────────────────────────────────────────
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(80, 80, 80)
  doc.text('Forma de pago: Transferencia bancaria', margin, y)
  y += 6

  if (factura.iban) {
    doc.text(`IBAN: ${factura.iban}`, margin, y)
    y += 10
  }

  // ── Bottom line ────────────────────────────────────────────────────
  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.8)
  doc.line(margin, y + 5, pageW - margin, y + 5)

  // ── Save ───────────────────────────────────────────────────────────
  doc.save(`Factura_${factura.numero_factura}.pdf`)
}

export function generarCSVFacturas(facturas) {
  const headers = ['Nº Factura', 'Fecha', 'Emisor', 'NIF Emisor', 'Receptor', 'CIF Receptor', 'Concepto', 'Base Imponible', 'IVA %', 'IVA Monto', 'Total']
  const rows = facturas.map(f => [
    f.numero_factura,
    f.fecha_emision,
    f.emisor_nombre || '',
    f.emisor_nif || '',
    f.receptor_nombre || '',
    f.receptor_cif || '',
    f.concepto || '',
    f.base_imponible,
    f.iva_porcentaje,
    f.iva_monto,
    f.total,
  ])

  const csv = [headers, ...rows].map(row =>
    row.map(cell => {
      const str = String(cell ?? '')
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  ).join('\n')

  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `facturas_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
