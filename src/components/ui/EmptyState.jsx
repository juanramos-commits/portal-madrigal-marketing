export default function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={`ui-empty ${className}`}>
      {icon && <div className="ui-empty-icon">{icon}</div>}
      {title && <h3 className="ui-empty-title">{title}</h3>}
      {description && <p className="ui-empty-desc">{description}</p>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  )
}
