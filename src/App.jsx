import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login'
import Dashboard from './Dashboard'
import SuperAdmin from './SuperAdmin'

function AppContent() {
  const { session, profile, profileError, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)' }}>
        Загрузка...
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/admin" element={<SuperAdmin />} />
      <Route path="*" element={
        !session ? <Login /> :
        !profile ? (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)', padding: '2rem', textAlign: 'center', gap: '0.75rem' }}>
            <div>Аккаунт не привязан ни к одной компании.</div>
            {profileError && (
              <div style={{ maxWidth: '700px', fontSize: '0.85rem', opacity: 0.8 }}>
                Техническая ошибка: {profileError}
              </div>
            )}
            {session?.user?.id && (
              <div style={{ maxWidth: '700px', fontSize: '0.75rem', opacity: 0.6, userSelect: 'text' }}>
                ID пользователя: {session.user.id}
              </div>
            )}
          </div>
        ) : <Dashboard />
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
