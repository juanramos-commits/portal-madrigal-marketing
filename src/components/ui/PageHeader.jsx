export default function PageHeader({ title, subtitle, actions, tabs, activeTab, onTabChange, className = '' }) {
  return (
    <div className={`ui-page-header ${className}`}>
      <div className="ui-page-header-row">
        <div className="ui-page-header-left">
          <h1 className="ui-page-title">{title}</h1>
          {subtitle && <p className="ui-page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="ui-page-header-actions">{actions}</div>}
      </div>
      {tabs && tabs.length > 0 && (
        <div className="ui-page-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={`ui-page-tab ${activeTab === tab.value ? 'ui-page-tab--active' : ''}`}
              onClick={() => onTabChange?.(tab.value)}
            >
              {tab.label}
              {tab.count != null && <span className="ui-page-tab-count">{tab.count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
