import { useRef, useEffect } from 'react'

export default function TextArea({
  label, value, onChange, placeholder, disabled, rows = 3,
  error, helperText, autoResize = false, className = '', ...props
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (autoResize && ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value, autoResize])

  return (
    <div className={`ui-field ${error ? 'ui-field--error' : ''} ${className}`}>
      {label && <label className="ui-label">{label}</label>}
      <textarea
        ref={ref}
        className={`ui-input ui-textarea ${error ? 'ui-input--error' : ''}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        {...props}
      />
      {error && <p className="ui-field-error">{error}</p>}
      {helperText && !error && <p className="ui-field-helper">{helperText}</p>}
    </div>
  )
}
