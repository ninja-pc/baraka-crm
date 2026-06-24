import { useState, useEffect } from 'react'
import { supabaseAdmin, SUPERADMIN_ID } from './superadminClient'
import { useAuth } from './AuthContext'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU')
}

export default function SuperAdmin() {
  const { profile, signOut } = useAuth()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ company: '', email: '', password: '' })
  const [error, setError] = useState('')

  useEffect(() => { loadTenants() }, [])

  async function loadTenants() {
    setLoading(true)
    const { data: tenantsData } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })

    // для каждого тенанта считаем статистику
    const enriched = await Promise.all((tenantsData || []).map(async t => {
      const { count: usersCount } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', t.id)

      const { count: contractsCount } = await supabaseAdmin
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', t.id)

      const { count: investorsCount } = await supabaseAdmin
        .from('investors')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', t.id)

      return { ...t, usersCount, contractsCount, investorsCount }
    }))

    setTenants(enriched)
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    // 1. Создаём пользователя
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
    })

    if (authErr) { setError('Ошибка создания пользователя: ' + authErr.message); setSaving(false); return }

    // 2. Создаём компанию
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .insert({ name: form.company })
      .select().single()

    if (tenantErr) { setError('Ошибка создания компании: ' + tenantErr.message); setSaving(false); return }

    // 3. Создаём профиль
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        tenant_id: tenant.id,
        full_name: form.company,
        role: 'admin',
      })

    if (profileErr) { setError('Ошибка профиля: ' + profileErr.message); setSaving(false); return }

    setSaving(false)
    setShowForm(false)
    setForm({ company: '', email: '', password: '' })
    loadTenants()
  }

  async function handleDeleteTenant(id, name) {
    if (!confirm(`Удалить компанию "${name}" и ВСЕ её данные? Это необратимо.`)) return

    // Удаляем всех пользователей компании
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('tenant_id', id)

    for (const p of profiles || []) {
      await supabaseAdmin.auth.admin.deleteUser(p.id)
    }

    // Удаляем тенант (всё остальное удалится каскадно)
    await supabaseAdmin.from('tenants').delete().eq('id', id)
    loadTenants()
  }

  async function handleDeleteUser(userId, email) {
    if (!confirm(`Удалить пользователя ${email}?`)) return
    await supabaseAdmin.auth.admin.deleteUser(userId)
    loadTenants()
  }

  // Защита — только суперадмин
  if (!profile || profile.id !== SUPERADMIN_ID) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone)' }}>
        Доступ запрещён
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1.5rem 0 1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, margin: 0 }}>
          Суперадмин панель
        </p>
        <span style={{ fontSize: 12, background: 'var(--rust-bg)', color: 'var(--rust)', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
          SUPERADMIN
        </span>
        <button onClick={signOut} className="btn-secondary" style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 13 }}>
          Выйти
        </button>
      </header>

      {/* Сводка */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--stone)', margin: '0 0 4px' }}>Компаний</p>
          <p className="mono" style={{ fontSize: 28, fontWeight: 500, margin: 0 }}>{tenants.length}</p>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--stone)', margin: '0 0 4px' }}>Пользователей</p>
          <p className="mono" style={{ fontSize: 28, fontWeight: 500, margin: 0 }}>
            {tenants.reduce((s, t) => s + (t.usersCount || 0), 0)}
          </p>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--stone)', margin: '0 0 4px' }}>Договоров всего</p>
          <p className="mono" style={{ fontSize: 28, fontWeight: 500, margin: 0 }}>
            {tenants.reduce((s, t) => s + (t.contractsCount || 0), 0)}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>{tenants.length} компаний</p>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Отмена' : '+ Создать компанию'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'grid', gap: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--stone)' }}>Новая компания</p>
          <input className="input-field" placeholder="Название компании" required
            value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          <input className="input-field" type="email" placeholder="Email администратора" required
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="input-field" type="password" placeholder="Пароль (мин. 6 символов)" required
            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          {error && <p style={{ color: 'var(--rust)', fontSize: 13, margin: 0 }}>{error}</p>}
          <button className="btn-primary" disabled={saving} style={{ justifySelf: 'start' }}>
            {saving ? 'Создаём...' : 'Создать'}
          </button>
        </form>
      )}

      {loading && <p style={{ color: 'var(--stone)' }}>Загрузка...</p>}

      {tenants.map(t => (
        <TenantCard key={t.id} tenant={t} onDelete={handleDeleteTenant} onDeleteUser={handleDeleteUser} />
      ))}
    </div>
  )
}

function TenantCard({ tenant, onDelete, onDeleteUser }) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  async function loadUsers() {
    if (users.length > 0) { setOpen(!open); return }
    setLoadingUsers(true)
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('tenant_id', tenant.id)
    setUsers(data || [])
    setLoadingUsers(false)
    setOpen(true)
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={loadUsers}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{tenant.name}</p>
            <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>
              {new Date(tenant.created_at).toLocaleDateString('ru-RU')} ·
              {' '}{tenant.usersCount || 0} польз. ·
              {' '}{tenant.contractsCount || 0} договоров ·
              {' '}{tenant.investorsCount || 0} инвесторов
            </p>
          </div>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, color: 'var(--rust)', borderColor: 'var(--rust-bg)', padding: '4px 12px' }}
            onClick={e => { e.stopPropagation(); onDelete(tenant.id, tenant.name) }}
          >
            Удалить компанию
          </button>
        </div>
      </div>

      {open && (
        <div className="card" style={{ padding: '0.75rem 1rem', marginTop: -4, background: 'var(--ivory)' }}>
          <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 8px', fontWeight: 600 }}>Пользователи</p>
          {loadingUsers && <p style={{ fontSize: 13, color: 'var(--stone)' }}>Загрузка...</p>}
          {users.map((u, idx) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, margin: 0 }}>{u.full_name || '—'}</p>
                <p style={{ fontSize: 11, color: 'var(--stone)', margin: '2px 0 0' }}>
                  {u.role} · {new Date(u.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
              <button
                className="btn-secondary"
                style={{ fontSize: 11, color: 'var(--rust)', borderColor: 'var(--rust-bg)', padding: '3px 10px' }}
                onClick={() => onDeleteUser(u.id, u.full_name)}
              >
                Удалить
              </button>
            </div>
          ))}
          {users.length === 0 && !loadingUsers && (
            <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>Нет пользователей</p>
          )}
        </div>
      )}
    </div>
  )
}
