import { useEffect, useRef, useCallback } from 'react'

export default function Modal({ open, onClose, title, size = 'md', footer, children, closable = true }) {
  const overlayRef = useRef(null)
  const modalRef = useRef(null)
  const previousFocus = useRef(null)

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closable) onClose?.()

    // Focus trap
    if (e.key === 'Tab' && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
  }, [closable, onClose])

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeyDown)
      setTimeout(() => {
        const autofocus = modalRef.current?.querySelector('[autofocus], input, select, textarea')
        if (autofocus) autofocus.focus()
        else modalRef.current?.focus()
      }, 50)
    }
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocus.current) previousFocus.current.focus()
    }
  }, [open, handleKeyDown])

  if (!open) return null

  const sizeClass = { sm: 'ui-modal--sm', md: 'ui-modal--md', lg: 'ui-modal--lg' }[size] || 'ui-modal--md'

  return (
    <div
      className="ui-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current && closable) onClose?.() }}
    >
      <div className={`ui-modal ${sizeClass}`} ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true">
        {title && (
          <div className="ui-modal-header">
            <h2>{title}</h2>
            {closable && (
              <button className="ui-modal-close" onClick={onClose} aria-label="Cerrar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
