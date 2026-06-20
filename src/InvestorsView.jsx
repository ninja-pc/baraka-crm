import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU') + ' ₸'
}

export default function InvestorsView({ tenantId }) {
  const [investors, setInvestors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ full_name: '', phone: '', total_capital: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadInvestors() }, [tenantId])

  async function loadInvestors() {
    setLoading(true)
    const { data: invs, error } = await supabase
      .from('investors')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) { setLoading(false); return }

    // working capital = sum of contract_funding amounts per investor (active contracts only)
    const { data: funding } = await supabase
      .from('contract_funding')
      .select('investor_id, amount, contracts(item_description, status, client_id, markup, clients(full_name))')

    const enriched = (invs || []).map(inv => {
      const myFunding = (funding || []).filter(f => f.investor_id === inv.id && f.contracts?.status !== 'closed')
      const working = myFunding.reduce((sum, f) => sum + Number(f.amount), 0)
      return {
        ...inv,
        working,
        free: Number(inv.total_capital) - working,
        deals: myFunding,
      }
    })

    setInvestors(enriched)
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('investors').insert({
      tenant_id: tenantId,
      full_name: form.full_name,
      phone: form.phone,
      total_capital: Number(form.total_capital) || 0,
    })
    setSaving(false)
    if (!error) {
      setForm({ full_name: '', phone: '', total_capital: '' })
      setShowForm(false)
      loadInvestors()
    }
  }

  const totals = investors.reduce((acc, i) => ({
    total: acc.total + Number(i.total_capital),
    working: acc.working + i.working,
    free: acc.free + i.free,
  }), { total: 0, working: 0, free: 0 })

  if (loading) return <p style={{ color: 'var(--stone)' }}>Загрузка...</p>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        <SummaryCard label="Капитал всего" value={fmt(totals.total)} />
        <SummaryCard label="В обороте" value={fmt(totals.working)} color="var(--teal)" />
        <SummaryCard label="Свободно" value={fmt(totals.free)} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>{investors.length} инвестор(ов)</p>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Отмена' : '+ Добавить инвестора'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'grid', gap: 10 }}>
          <input
            className="input-field" placeholder="ФИО" required
            value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
          />
          <input
            className="input-field" placeholder="Телефон"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
          />
          <input
            className="input-field" placeholder="Капитал всего (₸)" type="number" required
            value={form.total_capital} onChange={e => setForm({ ...form, total_capital: e.target.value })}
          />
          <button className="btn-primary" disabled={saving} style={{ justifySelf: 'start' }}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </form>
      )}

      {investors.length === 0 && !showForm && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--stone)' }}>
          Пока нет инвесторов. Добавьте первого.
        </div>
      )}

      {investors.map(inv => (
        <div key={inv.id}>
          <div
            onClick={() => setSelected(selected === inv.id ? null : inv.id)}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, cursor: 'pointer' }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: '50%', background: 'var(--teal-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 13, color: 'var(--teal)', flexShrink: 0,
            }}>
              {inv.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{inv.full_name}</p>
              <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>{inv.deals.length} договор(а) в пуле</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="mono" style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{fmt(inv.working)}</p>
              <p style={{ fontSize: 11, color: 'var(--stone)', margin: '2px 0 0' }}>в обороте из {fmt(inv.total_capital)}</p>
            </div>
          </div>

          {selected === inv.id && inv.deals.length > 0 && (
            <div className="card" style={{ padding: '0.75rem 1rem', marginTop: -4, marginBottom: 8, background: 'var(--ivory)' }}>
              {inv.deals.map((d, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{d.contracts?.item_description}</p>
                    <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>{d.contracts?.clients?.full_name}</p>
                  </div>
                  <p className="mono" style={{ fontSize: 13, margin: 0 }}>{fmt(d.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <p style={{ fontSize: 13, color: 'var(--stone)', margin: '0 0 4px' }}>{label}</p>
      <p className="mono" style={{ fontSize: 22, fontWeight: 500, margin: 0, color: color || 'var(--ink)' }}>{value}</p>
    </div>
  )
}
