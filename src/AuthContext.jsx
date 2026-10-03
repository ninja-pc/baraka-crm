import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
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
        setProfileError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setTimeout(() => {
        if (!cancelled) loadProfile(session.user.id)
      }, 0)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId, attempt = 1) {
    setProfileError(null)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profileData) {
      console.error('Profile load error:', profileError)

      if (attempt < 3) {
        setTimeout(() => loadProfile(userId, attempt + 1), 700)
      } else {
        setProfileError(profileError?.message || 'Профиль не найден')
        setLoading(false)
      }
      return
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', profileData.tenant_id)
      .single()

    if (tenantError) {
      console.error('Tenant load error:', tenantError)
      setProfileError('Компания не найдена: ' + tenantError.message)
    }

    setProfile({
      ...profileData,
      tenants: tenantData || null,
    })
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
    <AuthContext.Provider value={{ session, profile, profileError, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
