import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Register({ onBack }) {
  const [form, setForm] = useState({ company: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }
    if (form.password !== form.confirm) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)

    // 1. Регистрируем пользователя в Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authErr) {
      setError('Ошибка регистрации: ' + authErr.message)
      setLoading(false)
      return
    }

    const userId = authData.user?.id
    if (!userId) {
      setError('Не удалось создать аккаунт. Попробуйте ещё раз.')
      setLoading(false)
      return
    }

    // 2. Создаём компанию (tenant)
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({ name: form.company })
      .select()
      .single()

    if (tenantErr) {
      setError('Ошибка создания компании: ' + tenantErr.message)
      setLoading(false)
      return
    }

    // 3. Создаём профиль пользователя и привязываем к компании
    const { error: profileErr } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        tenant_id: tenant.id,
        full_name: form.email.split('@')[0],
        role: 'admin',
      })

    if (profileErr) {
      setError('Ошибка создания профиля: ' + profileErr.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '1rem',
      }}>
        <div className="card" style={{ width: '100%', maxWidth: 380, padding: '2.5rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, margin: '0 0 8px' }}>
            Аккаунт создан
          </p>
          <p style={{ fontSize: 14, color: 'var(--stone)', margin: '0 0 24px' }}>
            Компания «{form.company}» зарегистрирована. Войдите с вашим email и паролем.
          </p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={onBack}>
            Войти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '1rem',
    }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: 380, padding: '2.5rem 2rem' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, margin: '0 0 4px', fontWeight: 500 }}>
          Регистрация
        </p>
        <p style={{ color: 'var(--stone)', fontSize: 14, margin: '0 0 28px' }}>
          Барака CRM · новая компания
        </p>

        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Название компании
        </label>
        <input
          className="input-field" required placeholder="ООО Ваша компания"
          value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
          style={{ marginBottom: 16 }}
        />

        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Email</label>
        <input
          className="input-field" type="email" required placeholder="email@company.com"
          value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
          style={{ marginBottom: 16 }}
        />

        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Пароль</label>
        <input
          className="input-field" type="password" required placeholder="Минимум 6 символов"
          value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
          style={{ marginBottom: 16 }}
        />

        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
          Повторите пароль
        </label>
        <input
          className="input-field" type="password" required placeholder="Повторите пароль"
          value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
          style={{ marginBottom: 20 }}
        />

        {error && (
          <p style={{ color: 'var(--rust)', fontSize: 13, marginBottom: 16 }}>{error}</p>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginBottom: 12 }}>
          {loading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
        </button>

        <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={onBack}>
          Уже есть аккаунт — войти
        </button>
      </form>
    </div>
  )
}
