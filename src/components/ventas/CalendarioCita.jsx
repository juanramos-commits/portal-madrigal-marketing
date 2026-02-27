const estadoColores = {
  agendada: 'var(--status-onboarding-text)',
  realizada: 'var(--success)',
  'no show': 'var(--warning)',
  cancelada: 'var(--text-muted)',
  reagendada: 'var(--warning)',
}

function getColorCita(cita) {
  if (cita.estado_reunion?.color) return cita.estado_reunion.color
  const estado = (cita.estado || 'agendada').toLowerCase()
  return estadoColores[estado] || 'var(--status-onboarding-text)'
}

function formatHora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function CalendarioCita({ cita, onClick, mostrarCloser, compacto }) {
  const color = getColorCita(cita)

  if (compacto) {
    return (
      <button
        className="vc-cita-dot"
        style={{ background: color }}
        onClick={e => { e.stopPropagation(); onClick?.(cita) }}
        title={`${formatHora(cita.fecha_hora)} - ${cita.lead?.nombre || 'Sin nombre'}`}
      />
    )
  }

  return (
    <button
      className="vc-cita-bloque"
      style={{ borderLeftColor: color }}
      onClick={e => { e.stopPropagation(); onClick?.(cita) }}
    >
      <span className="vc-cita-hora">{formatHora(cita.fecha_hora)}</span>
      <span className="vc-cita-nombre">{cita.lead?.nombre || 'Sin nombre'}</span>
      {mostrarCloser && cita.closer && (
        <span className="vc-cita-closer">{cita.closer.nombre || cita.closer.email}</span>
      )}
    </button>
  )
}

export { getColorCita }
