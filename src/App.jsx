import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login'
import Dashboard from './Dashboard'
import SuperAdmin from './SuperAdmin'
import { SUPERADMIN_ID } from './superadminClient'

function AppContent() {
  const { session, profile, loading } = useAuth()
  const isAdminRoute = window.location.pathname === '/admin'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)' }}>
        Загрузка...
      </div>
    )
  }

  if (!session) return <Login />

  // Суперадмин панель — только по /admin и только для суперадмина
  if (isAdminRoute) {
    if (profile?.id === SUPERADMIN_ID) return <SuperAdmin />
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)' }}>
        Доступ запрещён
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)', padding: '2rem', textAlign: 'center' }}>
        Аккаунт не привязан ни к одной компании. Обратитесь к администратору.
      </div>
    )
  }

  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
