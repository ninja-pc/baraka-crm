import { useState } from 'react'
import { useAuth } from './AuthContext'
import Register from './Register'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRegister, setShowRegister] = useState(false)

  if (showRegister) {
    return <Register onBack={() => setShowRegister(false)} />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('Неверный email или пароль')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: 380, padding: '2.5rem 2rem' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, margin: '0 0 4px', fontWeight: 500 }}>
          Барака CRM
        </p>
        <p style={{ color: 'var(--stone)', fontSize: 14, margin: '0 0 28px' }}>
          Реестр капитала и рассрочек
        </p>

        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Email</label>
        <input
          className="input-field" type="email"
          value={email} onChange={e => setEmail(e.target.value)}
          required style={{ marginBottom: 16 }}
        />

        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>Пароль</label>
        <input
          className="input-field" type="password"
          value={password} onChange={e => setPassword(e.target.value)}
          required style={{ marginBottom: 20 }}
        />

        {error && (
          <p style={{ color: 'var(--rust)', fontSize: 13, marginBottom: 16 }}>{error}</p>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginBottom: 12 }}>
          {loading ? 'Входим...' : 'Войти'}
        </button>

        <button
          type="button" className="btn-secondary"
          style={{ width: '100%' }}
          onClick={() => setShowRegister(true)}
        >
          Зарегистрировать компанию
        </button>
      </form>
    </div>
  )
}
