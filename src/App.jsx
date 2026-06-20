import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login'
import Dashboard from './Dashboard'

function AppContent() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)' }}>
        Загрузка...
      </div>
    )
  }

  if (!session) return <Login />

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
