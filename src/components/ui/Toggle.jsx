export default function Toggle({ checked, onChange, label, disabled = false, className = '' }) {
  return (
    <label className={`ui-toggle ${disabled ? 'ui-toggle--disabled' : ''} ${className}`}>
      <input
        type="checkbox"
        className="ui-checkbox-native"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      <span className={`ui-toggle-track ${checked ? 'ui-toggle-track--on' : ''}`}>
        <span className="ui-toggle-knob" />
      </span>
      {label && <span className="ui-toggle-label">{label}</span>}
    </label>
  )
}
