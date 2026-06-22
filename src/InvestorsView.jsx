import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU') + ' ₽'
}

export default function InvestorsView({ tenantId, profile }) {
  const [investors, setInvestors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ full_name: '', phone: '', total_capital: '' })
  const [saving, setSaving] = useState(false)
  const [payoutForm, setPayoutForm] = useState({ investor_id: null, amount: '', note: '' })
  const [payoutSaving, setPayoutSaving] = useState(false)

  useEffect(() => { loadInvestors() }, [tenantId])

  async function loadInvestors() {
    setLoading(true)

    const { data: invs } = await supabase
      .from('investors')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    // funding с договорами для расчёта: в обороте + прибыль по закрытым
    const { data: funding } = await supabase
      .from('contract_funding')
      .select('investor_id, amount, share_pct, contracts(id, item_description, status, markup, clients(full_name))')

    // выплаты инвесторам
    const { data: payouts } = await supabase
      .from('investor_payouts')
      .select('*')
      .eq('tenant_id', tenantId)

    const enriched = (invs || []).map(inv => {
      const myFunding = (funding || []).filter(f => f.investor_id === inv.id)

      // в обороте = активные + просроченные договоры
      const working = myFunding
        .filter(f => f.contracts?.status !== 'closed')
        .reduce((s, f) => s + Number(f.amount), 0)

      // заработано = доля от наценки по закрытым договорам
      const earned = myFunding
        .filter(f => f.contracts?.status === 'closed')
        .reduce((s, f) => s + Math.round(Number(f.contracts.markup) * Number(f.share_pct)) / 100, 0)

      // выплачено
      const paid_out = (payouts || [])
        .filter(p => p.investor_id === inv.id)
        .reduce((s, p) => s + Number(p.amount), 0)

      const myPayouts = (payouts || [])
        .filter(p => p.investor_id === inv.id)
        .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))

      return {
        ...inv,
        working,
        free: Math.max(0, Number(inv.total_capital) - working),
        earned,
        paid_out,
        profit_pending: Math.max(0, earned - paid_out),
        deals: myFunding,
        payouts: myPayouts,
      }
    })

    setInvestors(enriched)
    setLoading(false)
  }

  async function handleSaveInvestor(e) {
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

  async function handleDeleteInvestor(id) {
    if (!confirm('Удалить инвестора? Это действие необратимо.')) return
    await supabase.from('investors').delete().eq('id', id)
    setSelected(null)
    loadInvestors()
  }

  async function handlePayout(e) {
    e.preventDefault()
    setPayoutSaving(true)
    try {
      const { error } = await supabase.from('investor_payouts').insert({
        tenant_id: tenantId,
        investor_id: payoutForm.investor_id,
        amount: Number(payoutForm.amount),
        note: payoutForm.note || null,
        paid_at: new Date().toISOString().slice(0, 10),
        created_by: profile.id,
      })
      if (error) {
        alert('Ошибка выплаты: ' + error.message)
      } else {
        setPayoutForm({ investor_id: null, amount: '', note: '' })
        loadInvestors()
      }
    } catch (err) {
      alert('Неожиданная ошибка: ' + err.message)
    } finally {
      setPayoutSaving(false)
    }
  }

  const totals = investors.reduce((acc, i) => ({
    total: acc.total + Number(i.total_capital),
    working: acc.working + i.working,
    earned: acc.earned + i.earned,
    pending: acc.pending + i.profit_pending,
  }), { total: 0, working: 0, earned: 0, pending: 0 })

  if (loading) return <p style={{ color: 'var(--stone)' }}>Загрузка...</p>

  return (
    <div>
      {/* Сводка */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        <SummaryCard label="Капитал всего" value={fmt(totals.total)} />
        <SummaryCard label="В обороте" value={fmt(totals.working)} color="var(--teal)" />
        <SummaryCard label="Заработано всего" value={fmt(totals.earned)} color="var(--teal)" />
        <SummaryCard label="К выплате" value={fmt(totals.pending)} color={totals.pending > 0 ? 'var(--rust)' : undefined} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>{investors.length} инвестор(ов)</p>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Отмена' : '+ Добавить инвестора'}
        </button>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <form onSubmit={handleSaveInvestor} className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'grid', gap: 10 }}>
          <input className="input-field" placeholder="ФИО" required
            value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <input className="input-field" placeholder="Телефон"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input className="input-field" placeholder="Капитал всего (₽)" type="number" required
            value={form.total_capital} onChange={e => setForm({ ...form, total_capital: e.target.value })} />
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

      {/* Список инвесторов */}
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
              <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>
                {inv.deals.length} договор(а) · {inv.phone || 'телефон не указан'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="mono" style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{fmt(inv.working)} в обороте</p>
              {inv.profit_pending > 0 && (
                <p className="mono" style={{ fontSize: 12, color: 'var(--rust)', margin: '2px 0 0' }}>
                  к выплате: {fmt(inv.profit_pending)}
                </p>
              )}
              {inv.profit_pending === 0 && inv.earned > 0 && (
                <p className="mono" style={{ fontSize: 12, color: 'var(--teal)', margin: '2px 0 0' }}>
                  заработано: {fmt(inv.earned)}
                </p>
              )}
            </div>
          </div>

          {/* Детальная карточка */}
          {selected === inv.id && (
            <div className="card" style={{ padding: '1rem', marginTop: -4, marginBottom: 8, background: 'var(--ivory)' }}>

              {/* Финансовая сводка инвестора */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                <MiniCard label="Капитал" value={fmt(inv.total_capital)} />
                <MiniCard label="Свободно" value={fmt(inv.free)} />
                <MiniCard label="В обороте" value={fmt(inv.working)} color="var(--teal)" />
                <MiniCard label="Заработано" value={fmt(inv.earned)} color="var(--teal)" />
                <MiniCard label="Выплачено" value={fmt(inv.paid_out)} />
                <MiniCard label="К выплате" value={fmt(inv.profit_pending)} color={inv.profit_pending > 0 ? 'var(--rust)' : undefined} />
              </div>

              {/* Кнопка выплатить */}
              {inv.profit_pending > 0 && payoutForm.investor_id !== inv.id && (
                <button
                  className="btn-primary"
                  style={{ marginBottom: 12, fontSize: 13 }}
                  onClick={() => setPayoutForm({ investor_id: inv.id, amount: String(inv.profit_pending), note: '' })}
                >
                  Выплатить прибыль ({fmt(inv.profit_pending)})
                </button>
              )}

              {/* Форма выплаты */}
              {payoutForm.investor_id === inv.id && (
                <form onSubmit={handlePayout} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--stone)', margin: 0 }}>Выплата прибыли</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input className="input-field" type="number" placeholder="Сумма (₽)" required
                      value={payoutForm.amount} onChange={e => setPayoutForm({ ...payoutForm, amount: e.target.value })} />
                    <input className="input-field" placeholder="Комментарий (необязательно)"
                      value={payoutForm.note} onChange={e => setPayoutForm({ ...payoutForm, note: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" disabled={payoutSaving} style={{ fontSize: 13 }}>
                      {payoutSaving ? 'Сохраняем...' : 'Подтвердить выплату'}
                    </button>
                    <button type="button" className="btn-secondary" style={{ fontSize: 13 }}
                      onClick={() => setPayoutForm({ investor_id: null, amount: '', note: '' })}>
                      Отмена
                    </button>
                  </div>
                </form>
              )}

              {/* Договоры инвестора */}
              {inv.deals.length > 0 && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 4px' }}>Договоры</p>
                  {inv.deals.map((d, idx) => {
                    const profitFromDeal = d.contracts?.status === 'closed'
                      ? Math.round(Number(d.contracts.markup) * Number(d.share_pct)) / 100
                      : 0
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: '1px solid var(--border)' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{d.contracts?.item_description}</p>
                          <p style={{ fontSize: 11, color: 'var(--stone)', margin: '2px 0 0' }}>
                            {d.contracts?.clients?.full_name} · {d.share_pct}% доля
                            {d.contracts?.status === 'closed' && <span style={{ color: 'var(--teal)' }}> · прибыль {fmt(profitFromDeal)}</span>}
                            {d.contracts?.status === 'active' && <span style={{ color: 'var(--stone)' }}> · активен</span>}
                            {d.contracts?.status === 'overdue' && <span style={{ color: 'var(--rust)' }}> · просрочка</span>}
                          </p>
                        </div>
                        <p className="mono" style={{ fontSize: 13, margin: 0 }}>{fmt(d.amount)}</p>
                      </div>
                    )
                  })}
                </>
              )}

              {/* История выплат */}
              {inv.payouts.length > 0 && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--stone)', margin: '12px 0 4px' }}>История выплат</p>
                  {inv.payouts.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 13, margin: 0, color: 'var(--stone)' }}>
                        {new Date(p.paid_at).toLocaleDateString('ru-RU')}
                        {p.note && <span> · {p.note}</span>}
                      </p>
                      <p className="mono" style={{ fontSize: 13, margin: 0, color: 'var(--teal)' }}>{fmt(p.amount)}</p>
                    </div>
                  ))}
                </>
              )}

              {/* Удаление */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 12, color: 'var(--rust)', borderColor: 'var(--rust-bg)' }}
                  onClick={() => handleDeleteInvestor(inv.id)}
                >
                  Удалить инвестора
                </button>
              </div>
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

function MiniCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
      <p style={{ fontSize: 11, color: 'var(--stone)', margin: '0 0 2px' }}>{label}</p>
      <p className="mono" style={{ fontSize: 14, fontWeight: 500, margin: 0, color: color || 'var(--ink)' }}>{value}</p>
    </div>
  )
}
