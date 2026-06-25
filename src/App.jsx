import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login'
import Dashboard from './Dashboard'
import SuperAdmin from './SuperAdmin'

function AppContent() {
  const { session, profile, loading } = useAuth()

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
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)', padding: '2rem', textAlign: 'center' }}>
            Аккаунт не привязан ни к одной компании. Обратитесь к администратору.
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
