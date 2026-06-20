import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU') + ' ₸'
}

const STATUS_LABEL = { active: 'Активен', overdue: 'Просрочка', closed: 'Закрыт' }
const STATUS_CLASS = { active: 'badge-active', overdue: 'badge-overdue', closed: 'badge-closed' }

export default function ContractsView({ tenantId, profile }) {
  const [contracts, setContracts] = useState([])
  const [investors, setInvestors] = useState([])
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
      .select('*, clients(full_name, phone), contract_funding(*, investors(full_name))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    const { data: investorsData } = await supabase
      .from('investors')
      .select('id, full_name')
      .eq('tenant_id', tenantId)

    setContracts(contractsData || [])
    setInvestors(investorsData || [])
    setLoading(false)
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

    // 1. create client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .insert({ tenant_id: tenantId, full_name: form.client_name, phone: form.client_phone })
      .select()
      .single()

    if (clientErr) { setSaving(false); alert('Ошибка создания клиента: ' + clientErr.message); return }

    // 2. create contract
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

    // 3. create pool funding rows
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

    setSaving(false)
    setShowForm(false)
    setForm({ client_name: '', client_phone: '', item_description: '', cost_price: '', sale_price: '', term_months: '' })
    setPool([{ investor_id: '', amount: '' }])
    loadAll()
  }

  if (loading) return <p style={{ color: 'var(--stone)' }}>Загрузка...</p>

  const activeCount = contracts.filter(c => c.status === 'active').length
  const overdueCount = contracts.filter(c => c.status === 'overdue').length
  const totalMarkup = contracts.reduce((s, c) => s + Number(c.markup || 0), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        <SummaryCard label="Активных договоров" value={activeCount} />
        <SummaryCard label="Ожидаемая наценка" value={fmt(totalMarkup)} color="var(--teal)" />
        <SummaryCard label="Просрочка" value={overdueCount} color={overdueCount > 0 ? 'var(--rust)' : undefined} />
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
            <input className="input-field" placeholder="Закупочная цена (₸)" type="number" required
              value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
            <input className="input-field" placeholder="Цена продажи (₸)" type="number" required
              value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} />
            <input className="input-field" placeholder="Срок (мес.)" type="number" required
              value={form.term_months} onChange={e => setForm({ ...form, term_months: e.target.value })} />
          </div>
          {form.cost_price && form.sale_price && (
            <p style={{ fontSize: 13, color: 'var(--teal)', margin: 0 }}>
              Наценка (доход): {fmt(Number(form.sale_price) - Number(form.cost_price))}
            </p>
          )}

          <p style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 0', color: 'var(--stone)' }}>
            Пул инвесторов {poolMismatch && <span style={{ color: 'var(--rust)', fontWeight: 400 }}>— сумма не равна закупочной цене ({fmt(poolTotal)} из {fmt(costPrice)})</span>}
          </p>
          {pool.map((row, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center' }}>
              <select className="input-field" required value={row.investor_id}
                onChange={e => updatePoolRow(idx, 'investor_id', e.target.value)}>
                <option value="">Выберите инвестора</option>
                {investors.map(inv => <option key={inv.id} value={inv.id}>{inv.full_name}</option>)}
              </select>
              <input className="input-field" placeholder="Сумма вклада (₸)" type="number" required
                value={row.amount} onChange={e => updatePoolRow(idx, 'amount', e.target.value)} />
              {pool.length > 1 && (
                <button type="button" onClick={() => removePoolRow(idx)} className="btn-secondary" style={{ padding: '8px 12px' }}>✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addPoolRow} className="btn-secondary" style={{ justifySelf: 'start' }}>
            + Добавить инвестора в пул
          </button>

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
