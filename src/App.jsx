import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { supabase } from './supabaseClient'
import Login from './Login'
import Dashboard from './Dashboard'
import SuperAdmin from './SuperAdmin'

function AppContent() {
  const { session, profile, profileError, loading } = useAuth()
  const [company, setCompany] = useState('ЛесБаза "Аюб"')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')

  async function finishCompanySetup() {
    const name = company.trim()
    if (!name) {
      setSetupError('Введите название компании')
      return
    }

    setSetupLoading(true)
    setSetupError('')

    const { error } = await supabase.rpc(
      'create_company_profile_for_current_user',
      { company_name: name }
    )

    if (error) {
      setSetupError(error.message)
      setSetupLoading(false)
      return
    }

    window.location.reload()
  }

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
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--stone)',
            padding: '2rem',
            textAlign: 'center',
            gap: '0.75rem',
          }}>
            <div style={{ fontSize: '1.1rem' }}>
              Аккаунт не привязан ни к одной компании.
            </div>

            <div style={{ maxWidth: '500px', fontSize: '0.9rem', opacity: 0.8 }}>
              Завершите настройку компании, чтобы войти в CRM.
            </div>

            <input
              className="input-field"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Название компании"
              style={{ width: '100%', maxWidth: 360 }}
            />

            {profileError && (
              <div style={{ maxWidth: '700px', fontSize: '0.8rem', opacity: 0.65 }}>
                Предыдущая ошибка: {profileError}
              </div>
            )}

            {setupError && (
              <div style={{ maxWidth: '700px', fontSize: '0.85rem', color: 'var(--rust)' }}>
                Ошибка настройки: {setupError}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={finishCompanySetup}
              disabled={setupLoading}
              style={{ minWidth: 220 }}
            >
              {setupLoading ? 'Настраиваем...' : 'Продолжить в CRM'}
            </button>

            {session?.user?.id && (
              <div style={{ maxWidth: '700px', fontSize: '0.7rem', opacity: 0.45, userSelect: 'text' }}>
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