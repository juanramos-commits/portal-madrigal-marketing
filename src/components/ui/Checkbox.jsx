export default function Checkbox({ checked, onChange, label, disabled = false, className = '' }) {
  return (
    <label className={`ui-checkbox ${disabled ? 'ui-checkbox--disabled' : ''} ${className}`}>
      <input
        type="checkbox"
        className="ui-checkbox-native"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      <span className={`ui-checkbox-box ${checked ? 'ui-checkbox-box--checked' : ''}`}>
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label && <span className="ui-checkbox-label">{label}</span>}
    </label>
  )
}
