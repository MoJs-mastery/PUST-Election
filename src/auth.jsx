import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function formatUser(rawUser) {
  if (!rawUser) return null
  return {
    ...rawUser,
    username: rawUser.user_metadata?.username || rawUser.user_metadata?.first_name || rawUser.email?.split('@')[0] || 'admin',
    is_superuser: rawUser.user_metadata?.is_superuser ?? true,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(formatUser(session?.user))
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(formatUser(session?.user))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (emailInput, passwordInput) => {
    let email = emailInput.trim()
    if (!email.includes('@')) {
      email = `${email}@pelection.com`
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: passwordInput,
    })

    if (error) {
      throw new Error(error.message)
    }

    const formatted = formatUser(data.user)
    setUser(formatted)
    return formatted
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
