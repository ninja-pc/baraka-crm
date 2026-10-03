import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export default function ProfileView() {
  const { profile, session, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [companyName, setCompanyName] = useState(profile?.tenants?.name || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setFullName(profile?.full_name || '')
    setCompanyName(profile?.tenants?.name || '')
  }, [profile])

  async function saveProfile(e) {
    e.preventDefault()
    const name = fullName.trim()
    const company = companyName.trim()

    if (!name) {
      setError('Введите ваше имя')
      return
    }
    if (!company) {
      setError('Введите название компании')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: name })
      .eq('id', session.user.id)

    if (profileError) {
      setError('Не удалось сохранить имя: ' + profileError.message)
      setSaving(false)
      return
    }

    if (profile?.role === 'admin' && profile?.tenant_id) {
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({ name: company })
        .eq('id', profile.tenant_id)

      if (tenantError) {
        setError('Имя сохранено, но компанию изменить не удалось: ' + tenantError.message)
        await refreshProfile()
        setSaving(false)
        return
      }
    }

    await refreshProfile()
    setMessage('Изменения сохранены')
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 500, margin: 0 }}>
          Профиль
        </h2>
        <p style={{ color: 'var(--stone)', fontSize: 13, margin: '5px 0 0' }}>
          Данные, которые отображаются в CRM и в печатных договорах.
        </p>
      </div>

      <form onSubmit={saveProfile} className="card" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--stone)', marginBottom: 6 }}>
              Ваше имя
            </label>
            <input
              className="input-field"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Например, Иван Иванов"
              autoComplete="name"
            />
            <p style={{ fontSize: 11, color: 'var(--stone)', margin: '5px 0 0' }}>
              Это имя будет использоваться как имя продавца в договоре.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--stone)', marginBottom: 6 }}>
              Компания
            </label>
            <input
              className="input-field"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Название компании"
              disabled={profile?.role !== 'admin'}
            />
            {profile?.role === 'admin' ? (
              <p style={{ fontSize: 11, color: 'var(--stone)', margin: '5px 0 0' }}>
                Это название отображается в шапке CRM и в печатных договорах.
              </p>
            ) : (
              <p style={{ fontSize: 11, color: 'var(--stone)', margin: '5px 0 0' }}>
                Название компании может менять только администратор.
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--stone)', marginBottom: 6 }}>
              Email
            </label>
            <input
              className="input-field"
              value={session?.user?.email || ''}
              disabled
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Сохраняем...' : 'Сохранить изменения'}
            </button>
            {message && <span style={{ color: 'var(--teal)', fontSize: 13 }}>✓ {message}</span>}
            {error && <span style={{ color: 'var(--rust)', fontSize: 13 }}>{error}</span>}
          </div>
        </div>
      </form>

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--stone)' }}>
          <b style={{ color: 'var(--ink)' }}>Роль:</b> {profile?.role || '—'}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--stone)' }}>
          Email используется для входа в аккаунт и здесь не изменяется.
        </p>
      </div>
    </div>
  )
}
