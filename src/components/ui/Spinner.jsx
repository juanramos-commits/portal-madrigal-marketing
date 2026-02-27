const sizes = { sm: 16, md: 24, lg: 36 }

export default function Spinner({ size = 'md', color }) {
  const s = sizes[size] || sizes.md
  return (
    <svg
      className="ui-spinner"
      width={s} height={s}
      viewBox="0 0 24 24"
      fill="none"
      style={color ? { color } : undefined}
    >
      <circle className="ui-spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path className="ui-spinner-head" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
