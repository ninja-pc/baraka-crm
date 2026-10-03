import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login'
import InvestorsView from './InvestorsView'
import ContractsView from './ContractsView'
import ClientsView from './ClientsView'
import OverviewView from './OverviewView'
import ReportsView from './ReportsView'
import ExpensesView from './ExpensesView'
import CashView from './CashView'
import ProfileView from './ProfileView'

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
  const [tab, setTab] = useState(() => localStorage.getItem('baraka-tab') || 'overview')
  const [dark, setDark] = useState(() => localStorage.getItem('baraka-theme') === 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('baraka-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    localStorage.setItem('baraka-tab', tab)
  }, [tab])

  const tabs = [
    { key: 'overview', label: 'Обзор' },
    { key: 'investors', label: 'Инвесторы' },
    { key: 'clients', label: 'Клиенты' },
    { key: 'contracts', label: 'Договоры' },
    { key: 'cash', label: 'Касса' },
    { key: 'expenses', label: 'Расходы' },
    { key: 'reports', label: 'Отчёты' },
    { key: 'profile', label: 'Профиль' },
  ]

  return (
    <div className="app-shell">
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 1.25rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1.25rem 0 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--teal)', color: 'var(--ivory)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>Б</div>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, margin: 0 }}>
              {profile.tenants?.name || 'Барака CRM'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--stone)', margin: '2px 0 0' }}>Финансовый кабинет</p>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--stone)' }}>{profile.full_name} · {profile.role}</span>
          <button className="btn-secondary theme-toggle" onClick={() => setDark(v => !v)} title={dark ? 'Светлая тема' : 'Тёмная тема'}>
            {dark ? '☀' : '☾'}
          </button>
          <button onClick={signOut} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>Выйти</button>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: 6, marginBottom: '1.5rem', padding: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto', boxShadow: 'var(--shadow)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={tab === t.key ? 'btn-primary' : 'btn-secondary'}
            style={{ border: tab === t.key ? 'none' : 'none', boxShadow: tab === t.key ? '0 3px 10px rgba(0,0,0,.10)' : 'none', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </nav>

      <main style={{ paddingBottom: '4rem' }}>
        {tab === 'overview' && <OverviewView tenantId={profile.tenant_id} />}
        {tab === 'investors' && <InvestorsView tenantId={profile.tenant_id} profile={profile} />}
        {tab === 'clients' && <ClientsView tenantId={profile.tenant_id} />}
        {tab === 'contracts' && <ContractsView tenantId={profile.tenant_id} profile={profile} />}
        {tab === 'cash' && <CashView tenantId={profile.tenant_id} profile={profile} />}
        {tab === 'expenses' && <ExpensesView tenantId={profile.tenant_id} profile={profile} />}
        {tab === 'reports' && <ReportsView tenantId={profile.tenant_id} />}
        {tab === 'profile' && <ProfileView />}
      </main>
      </div>
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
