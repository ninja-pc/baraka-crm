import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return

      setSession(session)

      if (session) {
        setLoading(true)
        await loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }

    initialize()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)

      if (!session) {
        setProfile(null)
        setLoading(false)
        return
      }

      // Do not make async Supabase calls directly inside onAuthStateChange.
      // Supabase documents a potential deadlock in that case.
      setLoading(true)
      setTimeout(() => {
        loadProfile(session.user.id)
      }, 0)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId, attempt = 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, tenants(name)')
      .eq('id', userId)
      .single()

    if (error || !data) {
      // Registration creates Auth first and profile second.
      // Give the profile a few seconds to appear before showing an error state.
      if (attempt < 10) {
        setTimeout(() => loadProfile(userId, attempt + 1), 500)
      } else {
        setLoading(false)
      }
      return
    }

    setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
