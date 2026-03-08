import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react'

const ToastContext = createContext({})

export const useToast = () => useContext(ToastContext)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 200)
  }, [])

  const showToast = useCallback((message, type = 'info', duration = 3000, action = null) => {
    const id = ++toastId
    setToasts(prev => {
      const next = [...prev, { id, message, type, removing: false, action }]
      return next.slice(-3)
    })
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => removeToast(id), duration)
    }
    return id
  }, [removeToast])

  const contextValue = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.length > 0 && (
        <div className="ui-toast-container">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`ui-toast ui-toast--${toast.type} ${toast.removing ? 'ui-toast--removing' : ''}`}
              onClick={() => !toast.action && removeToast(toast.id)}
            >
              <span className="ui-toast-icon">
                {toast.type === 'success' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
                {toast.type === 'error' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                )}
                {toast.type === 'warning' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                )}
                {toast.type === 'info' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                )}
              </span>
              <span className="ui-toast-msg">{toast.message}</span>
              {toast.action && (
                <button
                  type="button"
                  className="ui-toast-action"
                  onClick={(e) => {
                    e.stopPropagation()
                    toast.action.onClick()
                    removeToast(toast.id)
                  }}
                >
                  {toast.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
