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
    is_superuser: false,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isSuperuser, setIsSuperuser] = useState(false)
  const [loading, setLoading] = useState(true)
  const [superUserChecked, setSuperUserChecked] = useState(false)

  const resolveSuperuser = useCallback(async (u) => {
    if (!u) {
      setIsSuperuser(false)
      setSuperUserChecked(true)
      return false
    }
    let ok = false
    try {
      const { data } = await supabase.rpc('is_superuser')
      ok = Boolean(data)
    } catch {
      ok = false
    }
    setIsSuperuser(ok)
    setSuperUserChecked(true)
    return ok
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      const u = formatUser(session?.user)
      setUser(u)
      if (u) resolveSuperuser(u)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const u = formatUser(session?.user)
      setUser(u)
      setLoading(false)
      if (u) {
        setSuperUserChecked(false)
        resolveSuperuser(u)
      } else {
        setSuperUserChecked(true)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [resolveSuperuser])

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
    setSuperUserChecked(true)
    const ok = await resolveSuperuser(formatted)
    return { ...formatted, is_superuser: ok }
  }, [resolveSuperuser])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsSuperuser(false)
    setSuperUserChecked(true)
  }, [])

  return (
    <AuthContext.Provider value={{ user, is_superuser: isSuperuser, superUserChecked, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}