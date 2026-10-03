import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

function getCachedProfile(userId) {
  try {
    const raw = sessionStorage.getItem(`baraka-profile-${userId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function cacheProfile(userId, profile) {
  try {
    sessionStorage.setItem(`baraka-profile-${userId}`, JSON.stringify(profile))
  } catch {
    // Cache is only a UI optimization. Ignore storage failures.
  }
}

function clearCachedProfile(userId) {
  if (!userId) return
  try {
    sessionStorage.removeItem(`baraka-profile-${userId}`)
  } catch {
    // Ignore storage failures.
  }
}

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

      if (!session) {
        setLoading(false)
        return
      }

      // If the browser recreated the React app after tab switching/backgrounding,
      // show the cached UI immediately instead of flashing the global loading screen.
      const cachedProfile = getCachedProfile(session.user.id)
      if (cachedProfile) {
        setProfile(cachedProfile)
        setLoading(false)
      } else {
        setLoading(true)
      }

      // Always refresh the cached profile in the background.
      await loadProfile(session.user.id, 1, false)
    }

    initialize()

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)

      if (event === 'SIGNED_OUT' || !nextSession) {
        clearCachedProfile(session?.user?.id)
        setProfile(null)
        setProfileError(null)
        setLoading(false)
        return
      }

      // Token refresh is normal when the browser returns to the foreground.
      // Never replace the CRM with the global loading screen for this event.
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        return
      }

      if (event === 'SIGNED_IN' && nextSession.user?.id) {
        const cachedProfile = getCachedProfile(nextSession.user.id)
        if (cachedProfile) {
          setProfile(cachedProfile)
          setLoading(false)
          loadProfile(nextSession.user.id, 1, false)
        } else {
          setLoading(true)
          setTimeout(() => {
            if (!cancelled) loadProfile(nextSession.user.id, 1, true)
          }, 0)
        }
      }
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId, attempt = 1, showLoading = false) {
    if (showLoading) setLoading(true)
    setProfileError(null)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profileData) {
      console.error('Profile load error:', profileError)

      if (attempt < 3) {
        setTimeout(() => loadProfile(userId, attempt + 1, false), 700)
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

    const nextProfile = {
      ...profileData,
      tenants: tenantData || null,
    }

    setProfile(nextProfile)
    cacheProfile(userId, nextProfile)
    setLoading(false)
  }

  async function refreshProfile() {
    if (session?.user?.id) {
      // Refresh data without unmounting the CRM or showing the global loader.
      await loadProfile(session.user.id, 1, false)
    }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, profileError, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
