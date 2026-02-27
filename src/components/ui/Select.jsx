export default function Select({
  label, value, onChange, options, placeholder, error, disabled, className = '',
  children, ...props
}) {
  return (
    <div className={`ui-field ${error ? 'ui-field--error' : ''} ${className}`}>
      {label && <label className="ui-label">{label}</label>}
      <div className="ui-select-wrapper">
        <select
          className={`ui-select ${error ? 'ui-select--error' : ''}`}
          value={value}
          onChange={onChange}
          disabled={disabled}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))
            : children
          }
        </select>
        <svg className="ui-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {error && <p className="ui-field-error">{error}</p>}
    </div>
  )
}
