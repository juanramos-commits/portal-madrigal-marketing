import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Debounces a value — returns the value only after it stops changing for `delay` ms.
 * Use for search inputs: const debouncedQuery = useDebounce(query, 300)
 */
export function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}

/**
 * Returns a stable debounced version of `callback` that waits `delay` ms after
 * the last invocation before executing. Useful for actions (API calls, saves).
 * The returned function is stable across renders (same identity).
 */
export function useDebouncedCallback(callback, delay) {
  const callbackRef = useRef(callback)
  const timerRef = useRef(null)

  // Always point to latest callback without re-creating the returned function
  callbackRef.current = callback

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  return useCallback((...args) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => callbackRef.current(...args), delay)
  }, [delay])
}
