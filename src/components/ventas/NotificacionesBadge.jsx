export default function NotificacionesBadge({ contador }) {
  if (!contador || contador <= 0) return null

  const texto = contador > 9 ? '9+' : String(contador)

  return (
    <span className="ntf-badge" role="status" aria-label={`${contador} notificaciones sin leer`}>{texto}</span>
  )
}
