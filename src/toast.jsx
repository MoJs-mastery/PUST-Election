import { createContext, useContext, useCallback } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

const MAPPING = {
  success: toast.success,
  error: toast.error,
  warning: toast.warning,
  warn: toast.warning,
  info: toast.info,
}

export function ToastProvider({ children }) {
  const showToast = useCallback((type, message, duration = 4000) => {
    const fn = MAPPING[type] || toast.info
    fn(message, { autoClose: duration })
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={4000}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        pauseOnHover
        limit={5}
        toastClassName="app-toast"
        bodyClassName="app-toast-body"
      />
    </ToastContext.Provider>
  )
}