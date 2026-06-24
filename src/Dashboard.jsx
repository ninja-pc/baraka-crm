import { useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login'
import InvestorsView from './InvestorsView'
import ContractsView from './ContractsView'
import ReportsView from './ReportsView'
import ExpensesView from './ExpensesView'
import CashView from './CashView'

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

function Dashboard() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('investors')

  const tabs = [
    { key: 'investors', label: 'Инвесторы' },
    { key: 'contracts', label: 'Договоры' },
    { key: 'cash', label: 'Касса' },
    { key: 'expenses', label: 'Расходы' },
    { key: 'reports', label: 'Отчёты' },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 1.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1.5rem 0 1rem' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, margin: 0 }}>
          {profile.tenants?.name || 'Барака CRM'}
        </p>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--stone)' }}>
          {profile.full_name} · {profile.role}
        </span>
        <button onClick={signOut} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }}>
          Выйти
        </button>
      </header>

      <nav style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={tab === t.key ? 'btn-primary' : 'btn-secondary'}>
            {t.label}
          </button>
        ))}
      </nav>

      <main style={{ paddingBottom: '4rem' }}>
        {tab === 'investors' && <InvestorsView tenantId={profile.tenant_id} profile={profile} />}
        {tab === 'contracts' && <ContractsView tenantId={profile.tenant_id} profile={profile} />}
        {tab === 'cash' && <CashView tenantId={profile.tenant_id} profile={profile} />}
        {tab === 'expenses' && <ExpensesView tenantId={profile.tenant_id} profile={profile} />}
        {tab === 'reports' && <ReportsView tenantId={profile.tenant_id} />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
