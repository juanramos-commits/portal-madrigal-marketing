export default function Badge({ variant = 'neutral', color, dot = false, size = 'md', children, className = '' }) {
  const sizeClass = size === 'sm' ? 'ui-badge--sm' : ''
  const variantClass = variant === 'custom' ? '' : `ui-badge--${variant}`

  return (
    <span
      className={`ui-badge ${variantClass} ${sizeClass} ${className}`}
      style={variant === 'custom' && color ? { background: `${color}20`, color } : undefined}
    >
      {dot && <span className="ui-badge-dot" style={variant === 'custom' && color ? { background: color } : undefined} />}
      {children}
    </span>
  )
}
