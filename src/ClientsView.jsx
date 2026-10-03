import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) {
  return (Number(n) || 0).toLocaleString('ru-RU') + ' ₽'
}

export default function ClientsView({ tenantId }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadClients() }, [tenantId])

  async function loadClients() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*, contracts(id, item_description, cost_price, sale_price, markup, down_payment, status, term_months, created_at, payments(amount), payment_schedule(amount_due, due_date))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Clients load error:', error)
      setClients([])
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }

  const rows = useMemo(() => (clients || []).map(client => {
    const contracts = client.contracts || []
    const activeContracts = contracts.filter(c => c.status !== 'closed')
    const totalSale = activeContracts.reduce((s, c) => s + Number(c.sale_price || 0), 0)
    const totalPaid = activeContracts.reduce((s, c) =>
      s + (c.payments || []).reduce((x, p) => x + Number(p.amount || 0), 0), 0)
    const totalDebt = Math.max(0, totalSale - totalPaid)
    const overdue = activeContracts.filter(c => {
      const paid = (c.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
      let remaining = paid
      return (c.payment_schedule || []).some(item => {
        const due = Number(item.amount_due || 0)
        const allocated = Math.min(remaining, due)
        remaining -= allocated
        return allocated < due - 0.01 && new Date(item.due_date) <= new Date()
      })
    }).length

    return { ...client, activeContracts, totalDebt, overdue }
  }), [clients])

  const filtered = rows.filter(c => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return c.full_name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q)
  })

  function openClient(client) {
    setSelected(client)
    setForm({ full_name: client.full_name || '', phone: client.phone || '', address: client.address || '' })
    setEditing(false)
  }

  async function saveClient() {
    if (!form.full_name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('clients').update({
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    }).eq('id', selected.id).eq('tenant_id', tenantId)
    setSaving(false)
    if (error) {
      alert('Ошибка сохранения: ' + error.message)
      return
    }
    setEditing(false)
    setSelected(null)
    loadClients()
  }

  async function deleteClient() {
    if (selected.activeContracts.length > 0 || (selected.contracts || []).length > 0) {
      alert('Нельзя удалить клиента: у него есть договоры.')
      return
    }
    if (!confirm('Удалить клиента? Это действие необратимо.')) return

    const { error } = await supabase.from('clients')
      .delete().eq('id', selected.id).eq('tenant_id', tenantId)

    if (error) {
      alert('Ошибка удаления: ' + error.message)
      return
    }
    setSelected(null)
    loadClients()
  }

  if (loading) return <p style={{ color: 'var(--stone)' }}>Загрузка...</p>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        <SummaryCard label="Клиентов" value={rows.length} />
        <SummaryCard label="С активными договорами" value={rows.filter(c => c.activeContracts.length).length} />
        <SummaryCard label="Общая задолженность" value={fmt(rows.reduce((s, c) => s + c.totalDebt, 0))} color="var(--rust)" />
      </div>

      <input
        className="input-field"
        placeholder="🔍 Поиск по ФИО, телефону или адресу..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <p style={{ fontSize: 13, color: 'var(--stone)', margin: '0 0 8px' }}>
        {filtered.length} из {rows.length} клиентов
      </p>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--stone)' }}>
          {search ? 'Ничего не найдено.' : 'Клиентов пока нет. Они появятся после создания первого договора.'}
        </div>
      ) : filtered.map(client => (
        <div key={client.id}>
          <div
            className="card"
            onClick={() => openClient(client)}
            style={{ padding: 12, marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: 'var(--teal-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, color: 'var(--teal)', flexShrink: 0,
            }}>
              {(client.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{client.full_name}</p>
              <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>
                {client.phone || 'Телефон не указан'}
                {client.address ? ' · ' + client.address : ''}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, margin: 0 }}>{client.activeContracts.length} активн.</p>
              <p className="mono" style={{ fontSize: 13, margin: '2px 0 0', color: client.totalDebt > 0 ? 'var(--rust)' : 'var(--teal)' }}>
                {client.totalDebt > 0 ? 'Долг: ' + fmt(client.totalDebt) : 'Долг: 0 ₽'}
              </p>
              {client.overdue > 0 && <span className="badge badge-overdue">{client.overdue} просроч.</span>}
            </div>
          </div>

          {selected?.id === client.id && (
            <div className="card" style={{ padding: '1rem', marginTop: -4, marginBottom: 8, background: 'var(--ivory)' }}>
              {!editing ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>{client.full_name}</p>
                      {client.phone && <p style={{ fontSize: 12, color: 'var(--stone)', margin: '4px 0 0' }}>📞 {client.phone}</p>}
                      {client.address && <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>📍 {client.address}</p>}
                    </div>
                    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>Редактировать</button>
                  </div>

                  <p style={{ fontSize: 12, color: 'var(--stone)', margin: '14px 0 6px' }}>Договоры</p>
                  {(client.contracts || []).length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--stone)' }}>Договоров нет.</p>
                  )}
                  {(client.contracts || []).map(c => {
                    const paid = (c.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
                    const debt = Math.max(0, Number(c.sale_price) - paid)
                    return (
                      <div key={c.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{c.item_description}</p>
                            <p style={{ fontSize: 11, color: 'var(--stone)', margin: '2px 0 0' }}>
                              {new Date(c.created_at).toLocaleDateString('ru-RU')} · {c.term_months} мес.
                            </p>
                          </div>
                          <span className={`badge ${c.status === 'overdue' ? 'badge-overdue' : c.status === 'closed' ? 'badge-closed' : 'badge-active'}`}>
                            {c.status === 'overdue' ? 'Просрочка' : c.status === 'closed' ? 'Закрыт' : 'Активен'}
                          </span>
                        </div>
                        <p className="mono" style={{ fontSize: 12, margin: '5px 0 0' }}>
                          Цена {fmt(c.sale_price)} · Оплачено {fmt(paid)} · Долг {fmt(debt)}
                        </p>
                      </div>
                    )
                  })}

                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 12, color: 'var(--rust)', borderColor: 'var(--rust-bg)' }}
                      onClick={deleteClient}
                    >
                      Удалить клиента
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <input className="input-field" placeholder="ФИО" value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })} />
                  <input className="input-field" placeholder="Телефон" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                  <input className="input-field" placeholder="Адрес" value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" disabled={saving} onClick={saveClient}>
                      {saving ? 'Сохраняем...' : 'Сохранить'}
                    </button>
                    <button className="btn-secondary" onClick={() => setEditing(false)}>Отмена</button>
                  </div>
                </div>
              )}
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
