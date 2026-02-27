export default function Skeleton({ width, height, borderRadius, variant = 'rect', className = '' }) {
  const style = {}
  if (width) style.width = typeof width === 'number' ? width + 'px' : width
  if (height) style.height = typeof height === 'number' ? height + 'px' : height
  if (borderRadius) style.borderRadius = typeof borderRadius === 'number' ? borderRadius + 'px' : borderRadius

  const variantClass = variant === 'circle' ? 'ui-skeleton--circle' : variant === 'text' ? 'ui-skeleton--text' : ''

  return <div className={`ui-skeleton ${variantClass} ${className}`} style={style} />
}
