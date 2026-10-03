import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Register({ onBack }) {
  const [form, setForm] = useState({ company: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const company = form.company.trim()
    const email = form.email.trim()

    if (!company) {
      setError('Введите название компании')
      return
    }
    if (form.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }
    if (form.password !== form.confirm) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)

    try {
      // 1. Регистрируем пользователя в Supabase Auth.
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password: form.password,
      })

      if (authErr) {
        throw new Error('Ошибка регистрации: ' + authErr.message)
      }

      const userId = authData.user?.id
      if (!userId) {
        throw new Error('Не удалось создать аккаунт. Попробуйте ещё раз.')
      }

      // При выключенном Confirm Email Supabase сразу возвращает session.
      // Без session RLS не позволит создать компанию и профиль.
      if (!authData.session) {
        throw new Error('Аккаунт создан, но сессия не получена. Проверьте подтверждение email в Supabase.')
      }

      // 2. Создаём компанию.
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({ name: company })
        .select('id')
        .single()

      if (tenantErr) {
        throw new Error('Ошибка создания компании: ' + tenantErr.message)
      }

      // 3. Создаём профиль и связываем его с компанией.
      const { error: profileErr } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          tenant_id: tenant.id,
          full_name: email.split('@')[0],
          role: 'admin',
        })

      if (profileErr) {
        throw new Error('Ошибка создания профиля: ' + profileErr.message)
      }

      // После успешной регистрации пользователь уже авторизован.
      // AuthContext увидит профиль и откроет CRM автоматически.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка регистрации')
      setLoading(false)
    }
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
