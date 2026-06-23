import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU') + ' ₽'
}

const CATEGORIES = [
  'Аренда', 'Зарплата', 'Канцелярия', 'Транспорт',
  'Связь', 'Реклама', 'Коммунальные', 'Прочее'
]

export default function ExpensesView({ tenantId, profile }) {
  const [expenses, setExpenses] = useState([])
  const [investors, setInvestors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ amount: '', category: 'Прочее', description: '', expense_date: new Date().toISOString().slice(0, 10) })

  useEffect(() => { loadAll() }, [tenantId])

  async function loadAll() {
    setLoading(true)
    const { data: expData } = await supabase
      .from('expenses')
      .select('*, profiles(full_name)')
      .eq('tenant_id', tenantId)
      .order('expense_date', { ascending: false })

    const { data: invData } = await supabase
      .from('investors')
      .select('id, full_name, total_capital')
      .eq('tenant_id', tenantId)

    setExpenses(expData || [])
    setInvestors(invData || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      tenant_id: tenantId,
      amount: Number(form.amount),
      category: form.category,
      description: form.description || null,
      expense_date: form.expense_date,
      created_by: profile.id,
    })
    setSaving(false)
    if (error) { alert('Ошибка: ' + error.message); return }
    setForm({ amount: '', category: 'Прочее', description: '', expense_date: new Date().toISOString().slice(0, 10) })
    setShowForm(false)
    loadAll()
  }

  async function handleDelete(id) {
    if (!confirm('Удалить расход?')) return
    await supabase.from('expenses').delete().eq('id', id)
    loadAll()
  }

  if (loading) return <p style={{ color: 'var(--stone)' }}>Загрузка...</p>

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalCapital = investors.reduce((s, i) => s + Number(i.total_capital), 0)

  // Расходы по категориям
  const byCategory = {}
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
  })
  const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

  // Распределение расходов по инвесторам
  const investorShares = investors.map(inv => {
    const share = totalCapital > 0 ? Number(inv.total_capital) / totalCapital : 0
    return {
      ...inv,
      share_pct: Math.round(share * 10000) / 100,
      expense_share: Math.round(totalExpenses * share),
    }
  })

  return (
    <div>
      {/* Сводка */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--stone)', margin: '0 0 4px' }}>Расходов всего</p>
          <p className="mono" style={{ fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--rust)' }}>{fmt(totalExpenses)}</p>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--stone)', margin: '0 0 4px' }}>Записей расходов</p>
          <p className="mono" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{expenses.length}</p>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--stone)', margin: '0 0 4px' }}>Категорий</p>
          <p className="mono" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{categoryEntries.length}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>{expenses.length} расход(ов)</p>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Отмена' : '+ Добавить расход'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="input-field" type="number" placeholder="Сумма (₽)" required
              value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <input className="input-field" type="date" required
              value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
          </div>
          <select className="input-field" value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input-field" placeholder="Описание (необязательно)"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <button className="btn-primary" disabled={saving} style={{ justifySelf: 'start' }}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Список расходов */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--stone)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Все расходы
          </p>
          {expenses.length === 0 && (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--stone)' }}>
              Расходов пока нет
            </div>
          )}
          {expenses.map(exp => (
            <div key={exp.id} className="card" style={{ padding: '10px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, background: 'var(--stone-light)', color: 'var(--stone)', padding: '2px 7px', borderRadius: 99 }}>
                    {exp.category}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--stone)' }}>
                    {new Date(exp.expense_date).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                {exp.description && <p style={{ fontSize: 12, color: 'var(--stone)', margin: 0 }}>{exp.description}</p>}
              </div>
              <p className="mono" style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--rust)' }}>
                {fmt(exp.amount)}
              </p>
              <button onClick={() => handleDelete(exp.id)}
                className="btn-secondary" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--rust)', borderColor: 'var(--rust-bg)' }}>
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Правая колонка */}
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          {/* По категориям */}
          {categoryEntries.length > 0 && (
            <div className="card" style={{ padding: '1rem' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--stone)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                По категориям
              </p>
              {categoryEntries.map(([cat, amount]) => (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13 }}>{cat}</span>
                    <span className="mono" style={{ fontSize: 13 }}>{fmt(amount)}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--stone-light)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((amount / totalExpenses) * 100)}%`, height: '100%', background: 'var(--rust)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Доля расходов по инвесторам */}
          {investorShares.length > 0 && totalExpenses > 0 && (
            <div className="card" style={{ padding: '1rem' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--stone)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Доля расходов по инвесторам
              </p>
              {investorShares.map((inv, idx) => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <p style={{ fontSize: 13, margin: 0 }}>{inv.full_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--stone)', margin: '2px 0 0' }}>доля капитала {inv.share_pct}%</p>
                  </div>
                  <p className="mono" style={{ fontSize: 13, margin: 0, color: 'var(--rust)' }}>
                    {fmt(inv.expense_share)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
