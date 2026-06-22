import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU') + ' ₽'
}

const STATUS_LABEL = { active: 'Активен', overdue: 'Просрочка', closed: 'Закрыт' }
const STATUS_CLASS = { active: 'badge-active', overdue: 'badge-overdue', closed: 'badge-closed' }

export default function ContractsView({ tenantId, profile }) {
  const [contracts, setContracts] = useState([])
  const [investors, setInvestors] = useState([])
  const [freeCapital, setFreeCapital] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    client_name: '', client_phone: '', item_description: '',
    cost_price: '', sale_price: '', term_months: '',
  })
  const [pool, setPool] = useState([{ investor_id: '', amount: '' }])

  useEffect(() => { loadAll() }, [tenantId])

  async function loadAll() {
    setLoading(true)
    const { data: contractsData } = await supabase
      .from('contracts')
      .select('*, clients(full_name, phone), contract_funding(*, investors(full_name)), payment_schedule(*), payments(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    const { data: investorsData } = await supabase
      .from('investors')
      .select('id, full_name, total_capital')
      .eq('tenant_id', tenantId)

    // считаем свободный капитал: total_capital минус уже вложенное в активные/просроченные договоры
    const { data: activeFunding } = await supabase
      .from('contract_funding')
      .select('investor_id, amount, contracts(status)')

    const freeMap = {}
    ;(investorsData || []).forEach(inv => {
      const inUse = (activeFunding || [])
        .filter(f => f.investor_id === inv.id && f.contracts?.status !== 'closed')
        .reduce((s, f) => s + Number(f.amount), 0)
      freeMap[inv.id] = Math.max(0, Number(inv.total_capital) - inUse)
    })

    setInvestors(investorsData || [])
    setFreeCapital(freeMap)
    setContracts(contractsData || [])
    setLoading(false)
  }

  // автораспределение пула пропорционально свободному капиталу
  function autoDistribute() {
    const cost = Number(form.cost_price)
    if (!cost || cost <= 0) {
      alert('Сначала введите закупочную цену')
      return
    }
    const eligible = investors.filter(inv => (freeCapital[inv.id] || 0) > 0)
    if (eligible.length === 0) {
      alert('Нет инвесторов со свободным капиталом')
      return
    }
    const totalFree = eligible.reduce((s, inv) => s + freeCapital[inv.id], 0)
    let remaining = cost
    const newPool = eligible.map((inv, idx) => {
      const isLast = idx === eligible.length - 1
      const amount = isLast
        ? remaining
        : Math.floor((cost * freeCapital[inv.id] / totalFree))
      remaining -= amount
      return { investor_id: inv.id, amount: String(amount) }
    })
    setPool(newPool)
  }

  function addPoolRow() {
    setPool([...pool, { investor_id: '', amount: '' }])
  }

  function updatePoolRow(idx, field, value) {
    const next = [...pool]
    next[idx][field] = value
    setPool(next)
  }

  function removePoolRow(idx) {
    setPool(pool.filter((_, i) => i !== idx))
  }

  const poolTotal = pool.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const costPrice = Number(form.cost_price) || 0
  const poolMismatch = poolTotal > 0 && costPrice > 0 && poolTotal !== costPrice

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .insert({ tenant_id: tenantId, full_name: form.client_name, phone: form.client_phone })
      .select()
      .single()

    if (clientErr) { setSaving(false); alert('Ошибка создания клиента: ' + clientErr.message); return }

    const { data: contract, error: contractErr } = await supabase
      .from('contracts')
      .insert({
        tenant_id: tenantId,
        client_id: client.id,
        item_description: form.item_description,
        cost_price: Number(form.cost_price),
        sale_price: Number(form.sale_price),
        term_months: Number(form.term_months),
      })
      .select()
      .single()

    if (contractErr) { setSaving(false); alert('Ошибка создания договора: ' + contractErr.message); return }

    const fundingRows = pool
      .filter(p => p.investor_id && p.amount)
      .map(p => ({
        contract_id: contract.id,
        investor_id: p.investor_id,
        amount: Number(p.amount),
        share_pct: costPrice > 0 ? Math.round((Number(p.amount) / costPrice) * 10000) / 100 : 0,
      }))

    if (fundingRows.length > 0) {
      const { error: fundingErr } = await supabase.from('contract_funding').insert(fundingRows)
      if (fundingErr) { setSaving(false); alert('Ошибка пула: ' + fundingErr.message); return }
    }

    const months = Number(form.term_months)
    const salePrice = Number(form.sale_price)
    const baseAmount = Math.floor((salePrice / months) * 100) / 100
    const scheduleRows = []
    let runningTotal = 0
    for (let i = 1; i <= months; i++) {
      const dueDate = new Date()
      dueDate.setMonth(dueDate.getMonth() + i)
      const amount = i === months ? Math.round((salePrice - runningTotal) * 100) / 100 : baseAmount
      runningTotal += amount
      scheduleRows.push({
        contract_id: contract.id,
        installment_no: i,
        due_date: dueDate.toISOString().slice(0, 10),
        amount_due: amount,
      })
    }
    const { error: scheduleErr } = await supabase.from('payment_schedule').insert(scheduleRows)
    if (scheduleErr) { setSaving(false); alert('Ошибка графика платежей: ' + scheduleErr.message); return }

    setSaving(false)
    setShowForm(false)
    setForm({ client_name: '', client_phone: '', item_description: '', cost_price: '', sale_price: '', term_months: '' })
    setPool([{ investor_id: '', amount: '' }])
    loadAll()
  }


  async function handleDeleteContract(id) {
    if (!confirm('Удалить договор? Все платежи и данные пула будут удалены.')) return
    await supabase.from('contracts').delete().eq('id', id)
    setSelected(null)
    loadAll()
  }

  if (loading) return <p style={{ color: 'var(--stone)' }}>Загрузка...</p>

  const activeCount = contracts.filter(c => c.status === 'active').length
  const overdueCount = contracts.filter(c => c.status === 'overdue').length
  const closedCount = contracts.filter(c => c.status === 'closed').length
  const totalMarkup = contracts.reduce((s, c) => s + Number(c.markup || 0), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        <SummaryCard label="Активных договоров" value={activeCount} />
        <SummaryCard label="Ожидаемая наценка" value={fmt(totalMarkup)} color="var(--teal)" />
        <SummaryCard label="Просрочка" value={overdueCount} color={overdueCount > 0 ? 'var(--rust)' : undefined} />
        <SummaryCard label="Закрыто" value={closedCount} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>{contracts.length} договор(ов)</p>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Отмена' : '+ Новый договор'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="card" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'grid', gap: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--stone)' }}>Клиент</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="input-field" placeholder="ФИО клиента" required
              value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} />
            <input className="input-field" placeholder="Телефон"
              value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} />
          </div>

          <p style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 0', color: 'var(--stone)' }}>Договор мурабаха</p>
          <input className="input-field" placeholder="Товар / описание" required
            value={form.item_description} onChange={e => setForm({ ...form, item_description: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <input className="input-field" placeholder="Закупочная цена (₽)" type="number" required
              value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
            <input className="input-field" placeholder="Цена продажи (₽)" type="number" required
              value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} />
            <input className="input-field" placeholder="Срок (мес.)" type="number" required
              value={form.term_months} onChange={e => setForm({ ...form, term_months: e.target.value })} />
          </div>
          {form.cost_price && form.sale_price && (
            <p style={{ fontSize: 13, color: 'var(--teal)', margin: 0 }}>
              Наценка (доход): {fmt(Number(form.sale_price) - Number(form.cost_price))}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 0' }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--stone)', flex: 1 }}>
              Пул инвесторов {poolMismatch && <span style={{ color: 'var(--rust)', fontWeight: 400 }}>— сумма не равна закупочной цене ({fmt(poolTotal)} из {fmt(costPrice)})</span>}
            </p>
            <button type="button" onClick={autoDistribute} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
              ⚡ Авторасчёт
            </button>
          </div>

          {pool.map((row, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center' }}>
              <select className="input-field" required value={row.investor_id}
                onChange={e => updatePoolRow(idx, 'investor_id', e.target.value)}>
                <option value="">Выберите инвестора</option>
                {investors.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.full_name} (свободно: {fmt(freeCapital[inv.id] || 0)})
                  </option>
                ))}
              </select>
              <input className="input-field" placeholder="Сумма вклада (₽)" type="number" required
                value={row.amount} onChange={e => updatePoolRow(idx, 'amount', e.target.value)} />
              {pool.length > 1 && (
                <button type="button" onClick={() => removePoolRow(idx)} className="btn-secondary" style={{ padding: '8px 12px' }}>✕</button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={addPoolRow} className="btn-secondary" style={{ justifySelf: 'start' }}>
              + Добавить инвестора
            </button>
          </div>

          <button className="btn-primary" disabled={saving} style={{ justifySelf: 'start', marginTop: 8 }}>
            {saving ? 'Сохраняем...' : 'Создать договор'}
          </button>
        </form>
      )}

      {contracts.length === 0 && !showForm && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--stone)' }}>
          Пока нет договоров. Создайте первый.
        </div>
      )}

      {contracts.map(c => (
        <div key={c.id}>
          <div
            onClick={() => setSelected(selected === c.id ? null : c.id)}
            className="card"
            style={{ padding: 12, marginBottom: 8, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <p style={{ fontWeight: 500, fontSize: 14, margin: 0, flex: 1 }}>{c.item_description}</p>
              <span className={`badge ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 6px' }}>
              {c.clients?.full_name} · {c.term_months} мес · пул: {c.contract_funding?.length || 0} инв.
            </p>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span className="mono">Цена: {fmt(c.sale_price)}</span>
              <span className="mono" style={{ color: 'var(--teal)' }}>Наценка: {fmt(c.markup)}</span>
            </div>
          </div>

          {selected === c.id && (
            <div className="card" style={{ padding: '0.75rem 1rem', marginTop: -4, marginBottom: 8, background: 'var(--ivory)' }}>
              <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 6px' }}>Пул инвесторов</p>
              {(c.contract_funding || []).map((f, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                  <p style={{ fontSize: 13, margin: 0 }}>{f.investors?.full_name}</p>
                  <p className="mono" style={{ fontSize: 13, margin: 0 }}>{fmt(f.amount)} · {f.share_pct}%</p>
                </div>
              ))}
              <p style={{ fontSize: 12, color: 'var(--stone)', margin: '14px 0 6px' }}>График платежей</p>
              <PaymentSchedule contract={c} profile={profile} onChanged={loadAll} />
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 12, color: 'var(--rust)', borderColor: 'var(--rust-bg)' }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteContract(c.id) }}
                >
                  Удалить договор
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PaymentSchedule({ contract, profile, onChanged }) {
  const [payingId, setPayingId] = useState(null)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const isClosed = contract.status === 'closed'
  const schedule = [...(contract.payment_schedule || [])].sort((a, b) => a.installment_no - b.installment_no)
  const payments = contract.payments || []
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const totalDue = Number(contract.sale_price) || 0
  const progressPct = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0

  let remainingPaid = totalPaid
  const rows = schedule.map(item => {
    const due = Number(item.amount_due)
    const allocated = Math.min(remainingPaid, due)
    remainingPaid -= allocated
    const isPaid = allocated >= due - 0.01
    const isOverdue = !isPaid && new Date(item.due_date) <= new Date()
    return { ...item, allocated, isPaid, isOverdue }
  })

  async function handleRecordPayment() {
    if (!amount) return
    setSaving(true)
    const { error } = await supabase.from('payments').insert({
      contract_id: contract.id,
      amount: Number(amount),
      received_by: profile.id,
    })
    setSaving(false)
    if (error) { alert('Ошибка: ' + error.message); return }
    setPayingId(null)
    setAmount('')
    onChanged()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--stone-light)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: isClosed ? 'var(--teal)' : 'var(--ink)' }} />
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--stone)' }}>{progressPct}% оплачено</span>
      </div>

      {isClosed && (
        <p style={{ fontSize: 12, color: 'var(--teal)', margin: '0 0 10px', fontWeight: 500 }}>
          ✓ Договор полностью оплачен и закрыт
        </p>
      )}

      {rows.map(item => (
        <div key={item.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, margin: 0 }}>
                Платёж {item.installment_no} · {new Date(item.due_date).toLocaleDateString('ru-RU')}
              </p>
              <p style={{ fontSize: 11, margin: '2px 0 0' }}>
                {item.isPaid && <span style={{ color: 'var(--teal)' }}>оплачено</span>}
                {!item.isPaid && item.isOverdue && !isClosed && <span style={{ color: 'var(--rust)' }}>просрочен</span>}
                {!item.isPaid && !item.isOverdue && <span style={{ color: 'var(--stone)' }}>ожидается</span>}
                {item.allocated > 0 && !item.isPaid && <span style={{ color: 'var(--stone)' }}> · частично {fmt(item.allocated)}</span>}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p className="mono" style={{ fontSize: 13, margin: 0 }}>{fmt(item.amount_due)}</p>
              {!item.isPaid && !isClosed && payingId !== item.id && (
                <button
                  className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => { setPayingId(item.id); setAmount(String(item.amount_due - item.allocated)) }}
                >
                  Внести оплату
                </button>
              )}
            </div>
          </div>

          {payingId === item.id && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                className="input-field" type="number" autoFocus
                value={amount} onChange={e => setAmount(e.target.value)}
                style={{ maxWidth: 160 }}
              />
              <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} disabled={saving}
                onClick={handleRecordPayment}>
                {saving ? 'Сохраняем...' : 'Подтвердить'}
              </button>
              <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }}
                onClick={() => { setPayingId(null); setAmount('') }}>
                Отмена
              </button>
            </div>
          )}
        </div>
      ))}
      {schedule.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--stone)' }}>График не сформирован.</p>
      )}
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
