import { useEffect } from 'react'

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Traps focus within a container ref while active.
 * @param {React.RefObject} ref — container element ref
 * @param {boolean} active — whether the trap is active
 */
export function useFocusTrap(ref, active = true) {
  useEffect(() => {
    if (!active || !ref.current) return

    const container = ref.current
    const previouslyFocused = document.activeElement

    // Focus first focusable element
    const focusables = container.querySelectorAll(FOCUSABLE)
    if (focusables.length > 0) focusables[0].focus()

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return

      const nodes = container.querySelectorAll(FOCUSABLE)
      if (nodes.length === 0) return

      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [ref, active])
}
