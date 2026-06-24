import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU') + ' ₽'
}

const IN_CATEGORIES = ['Оплата по договору', 'Первоначальный взнос', 'Прочий приход']
const OUT_CATEGORIES = ['Выдача инвестору', 'Аренда', 'Зарплата', 'Канцелярия', 'Транспорт', 'Связь', 'Реклама', 'Прочий расход']

export default function CashView({ tenantId, profile }) {
  const [ops, setOps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [form, setForm] = useState({
    type: 'in', amount: '', category: IN_CATEGORIES[0], description: '',
    operation_date: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => { loadOps() }, [tenantId])

  async function loadOps() {
    setLoading(true)
    const { data } = await supabase
      .from('cash_operations')
      .select('*, profiles(full_name)')
      .eq('tenant_id', tenantId)
      .order('operation_date', { ascending: false })
      .order('created_at', { ascending: false })
    setOps(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('cash_operations').insert({
      tenant_id: tenantId,
      type: form.type,
      amount: Number(form.amount),
      category: form.category,
      description: form.description || null,
      operation_date: form.operation_date,
      created_by: profile.id,
    })
    setSaving(false)
    if (error) { alert('Ошибка: ' + error.message); return }
    setForm({ type: 'in', amount: '', category: IN_CATEGORIES[0], description: '', operation_date: new Date().toISOString().slice(0, 10) })
    setShowForm(false)
    loadOps()
  }

  async function handleDelete(id) {
    if (!confirm('Удалить операцию?')) return
    await supabase.from('cash_operations').delete().eq('id', id)
    loadOps()
  }

  if (loading) return <p style={{ color: 'var(--stone)' }}>Загрузка...</p>

  // Считаем остаток на выбранную дату
  const opsUpToDate = ops.filter(o => o.operation_date <= date)
  const totalIn = opsUpToDate.filter(o => o.type === 'in' || o.type === 'initial').reduce((s, o) => s + Number(o.amount), 0)
  const totalOut = opsUpToDate.filter(o => o.type === 'out').reduce((s, o) => s + Number(o.amount), 0)
  const balance = totalIn - totalOut

  // Операции за выбранный день
  const dayOps = ops.filter(o => o.operation_date === date)
  const dayIn = dayOps.filter(o => o.type === 'in').reduce((s, o) => s + Number(o.amount), 0)
  const dayOut = dayOps.filter(o => o.type === 'out').reduce((s, o) => s + Number(o.amount), 0)

  // Начальный остаток на начало выбранного дня
  const prevOps = ops.filter(o => o.operation_date < date)
  const prevIn = prevOps.filter(o => o.type === 'in' || o.type === 'initial').reduce((s, o) => s + Number(o.amount), 0)
  const prevOut = prevOps.filter(o => o.type === 'out').reduce((s, o) => s + Number(o.amount), 0)
  const openingBalance = prevIn - prevOut

  const categories = form.type === 'in' ? IN_CATEGORIES : OUT_CATEGORIES

  return (
    <div>
      {/* Выбор даты */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Отчёт за:</p>
        <input className="input-field" type="date" value={date}
          onChange={e => setDate(e.target.value)}
          style={{ width: 'auto' }} />
        <button className="btn-secondary" style={{ fontSize: 13, padding: '7px 14px' }}
          onClick={() => setDate(new Date().toISOString().slice(0, 10))}>
          Сегодня
        </button>
      </div>

      {/* Кассовый день */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 4px' }}>Остаток на начало</p>
          <p className="mono" style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>{fmt(openingBalance)}</p>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 4px' }}>Приход за день</p>
          <p className="mono" style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--teal)' }}>+{fmt(dayIn)}</p>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 4px' }}>Расход за день</p>
          <p className="mono" style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--rust)' }}>-{fmt(dayOut)}</p>
        </div>
        <div className="card" style={{ padding: '1rem', background: balance >= 0 ? 'var(--teal-bg)' : 'var(--rust-bg)', border: `1px solid ${balance >= 0 ? 'var(--teal)' : 'var(--rust)'}` }}>
          <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 4px' }}>Остаток на конец</p>
          <p className="mono" style={{ fontSize: 20, fontWeight: 600, margin: 0, color: balance >= 0 ? 'var(--teal)' : 'var(--rust)' }}>{fmt(balance)}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>
          {dayOps.length > 0 ? `${dayOps.length} операций за день` : 'Нет операций за этот день'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ fontSize: 13 }}
            onClick={() => { setForm({ ...form, type: 'initial', category: 'Начальный остаток', amount: '', description: '', operation_date: date }); setShowForm(true) }}>
            Установить остаток
          </button>
          <button className="btn-primary" onClick={() => { setShowForm(s => !s); setForm({ type: 'in', amount: '', category: IN_CATEGORIES[0], description: '', operation_date: date }) }}>
            {showForm ? 'Отмена' : '+ Операция'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'grid', gap: 10 }}>
          {form.type !== 'initial' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button"
                onClick={() => setForm({ ...form, type: 'in', category: IN_CATEGORIES[0] })}
                className={form.type === 'in' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: 13 }}>
                ↓ Приход
              </button>
              <button type="button"
                onClick={() => setForm({ ...form, type: 'out', category: OUT_CATEGORIES[0] })}
                className={form.type === 'out' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: 13 }}>
                ↑ Расход / Выдача
              </button>
            </div>
          )}
          {form.type === 'initial' && (
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--stone)', margin: 0 }}>
              Начальный остаток кассы на {new Date(date).toLocaleDateString('ru-RU')}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="input-field" type="number" placeholder="Сумма (₽)" required
              value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <input className="input-field" type="date" required
              value={form.operation_date} onChange={e => setForm({ ...form, operation_date: e.target.value })} />
          </div>
          {form.type !== 'initial' && (
            <select className="input-field" value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <input className="input-field" placeholder="Описание (необязательно)"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <button className="btn-primary" disabled={saving} style={{ justifySelf: 'start' }}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      )}

      {/* Операции за день */}
      {dayOps.length > 0 && (
        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--stone)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Операции за {new Date(date).toLocaleDateString('ru-RU')}
          </p>
          {dayOps.map((op, idx) => (
            <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: op.type === 'out' ? 'var(--rust-bg)' : 'var(--teal-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>
                {op.type === 'out' ? '↑' : '↓'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{op.category}</p>
                {op.description && <p style={{ fontSize: 11, color: 'var(--stone)', margin: '2px 0 0' }}>{op.description}</p>}
                {op.profiles?.full_name && <p style={{ fontSize: 11, color: 'var(--stone)', margin: '2px 0 0' }}>{op.profiles.full_name}</p>}
              </div>
              <p className="mono" style={{
                fontSize: 14, fontWeight: 500, margin: 0,
                color: op.type === 'out' ? 'var(--rust)' : 'var(--teal)',
              }}>
                {op.type === 'out' ? '-' : '+'}{fmt(op.amount)}
              </p>
              <button onClick={() => handleDelete(op.id)}
                className="btn-secondary" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--rust)', borderColor: 'var(--rust-bg)' }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Все операции */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--stone)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          История всех операций
        </p>
        {ops.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>Операций пока нет</p>
        )}
        {ops.map((op, idx) => (
          <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 11, background: op.type === 'out' ? 'var(--rust-bg)' : 'var(--teal-bg)', color: op.type === 'out' ? 'var(--rust)' : 'var(--teal)', padding: '2px 7px', borderRadius: 99, fontWeight: 500 }}>
                  {op.type === 'initial' ? 'Остаток' : op.type === 'out' ? 'Расход' : 'Приход'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--stone)' }}>{new Date(op.operation_date).toLocaleDateString('ru-RU')}</span>
                <span style={{ fontSize: 11, color: 'var(--stone)' }}>{op.category}</span>
              </div>
              {op.description && <p style={{ fontSize: 12, color: 'var(--stone)', margin: 0 }}>{op.description}</p>}
            </div>
            <p className="mono" style={{ fontSize: 14, fontWeight: 500, margin: 0, color: op.type === 'out' ? 'var(--rust)' : 'var(--teal)' }}>
              {op.type === 'out' ? '-' : '+'}{fmt(op.amount)}
            </p>
            <button onClick={() => handleDelete(op.id)}
              className="btn-secondary" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--rust)', borderColor: 'var(--rust-bg)' }}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
