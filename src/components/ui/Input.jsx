export default function Input({
  label, type = 'text', value, onChange, placeholder, disabled, readOnly,
  error, helperText, prefix, suffix, className = '', size = 'md', ...props
}) {
  const sizeClass = size === 'sm' ? 'ui-input--sm' : ''
  return (
    <div className={`ui-field ${error ? 'ui-field--error' : ''} ${className}`}>
      {label && <label className="ui-label">{label}</label>}
      <div className="ui-input-wrapper">
        {prefix && <span className="ui-input-prefix">{prefix}</span>}
        <input
          className={`ui-input ${sizeClass} ${error ? 'ui-input--error' : ''} ${prefix ? 'ui-input--has-prefix' : ''} ${suffix ? 'ui-input--has-suffix' : ''}`}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          {...props}
        />
        {suffix && <span className="ui-input-suffix">{suffix}</span>}
      </div>
      {error && <p className="ui-field-error">{error}</p>}
      {helperText && !error && <p className="ui-field-helper">{helperText}</p>}
    </div>
  )
}
