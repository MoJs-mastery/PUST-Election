import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  success: 'fa-circle-check',
  error: 'fa-circle-xmark',
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info',
}
const TITLES = {
  success: 'Guul!',
  error: 'Khalad!',
  warning: 'Digniin!',
  info: 'Macluumaad',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const showToast = useCallback(
    (type, message, duration = 4000) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((t) => [
        ...t,
        {
          id,
          type,
          message,
          icon: ICONS[type] || ICONS.info,
          title: TITLES[type] || TITLES.info,
        },
      ])
      setTimeout(() => dismiss(id), duration)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type} show`}
            onClick={() => dismiss(t.id)}
          >
            <div className="toast-icon">
              <i className={`fa-solid ${t.icon}`} />
            </div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              <div className="toast-message">{t.message}</div>
            </div>
            <button
              className="toast-close"
              onClick={(e) => {
                e.stopPropagation()
                dismiss(t.id)
              }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <div className="toast-progress" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
