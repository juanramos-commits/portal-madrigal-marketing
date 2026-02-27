import Spinner from './Spinner'

export default function Button({
  variant = 'primary', size = 'md', loading = false, disabled = false,
  icon, fullWidth = false, children, className = '', type = 'button', ...props
}) {
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    fullWidth && 'ui-btn--full',
    loading && 'ui-btn--loading',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} disabled={disabled || loading} type={type} {...props}>
      {loading && <span className="ui-btn-spinner"><Spinner size="sm" /></span>}
      <span className="ui-btn-content" style={loading ? { visibility: 'hidden' } : undefined}>
        {icon && <span className="ui-btn-icon">{icon}</span>}
        {children}
      </span>
    </button>
  )
}
