import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabaseClient'
import ContractsView from './ContractsView'
import InvestorsView from './InvestorsView'

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('investors')

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 1.5rem' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '1.5rem 0 1rem',
      }}>
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
        <button
          onClick={() => setTab('investors')}
          className={tab === 'investors' ? 'btn-primary' : 'btn-secondary'}
        >
          Инвесторы
        </button>
        <button
          onClick={() => setTab('contracts')}
          className={tab === 'contracts' ? 'btn-primary' : 'btn-secondary'}
        >
          Договоры
        </button>
      </nav>

      <main style={{ paddingBottom: '4rem' }}>
        {tab === 'investors' && <InvestorsView tenantId={profile.tenant_id} />}
        {tab === 'contracts' && <ContractsView tenantId={profile.tenant_id} profile={profile} />}
      </main>
    </div>
  )
}
