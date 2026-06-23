import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU') + ' ₽'
}

const PERIODS = [
  { label: 'Сегодня', value: 'day' },
  { label: 'Неделя', value: 'week' },
  { label: 'Месяц', value: 'month' },
  { label: 'Всё время', value: 'all' },
]

function getPeriodRange(period) {
  const now = new Date()
  const start = new Date()
  if (period === 'day') {
    start.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    start.setDate(now.getDate() - 7)
    start.setHours(0, 0, 0, 0)
  } else if (period === 'month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  } else {
    return { from: null, to: null }
  }
  return { from: start.toISOString(), to: now.toISOString() }
}

export default function ReportsView({ tenantId }) {
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => { loadReport() }, [period, tenantId])

  async function loadReport() {
    setLoading(true)
    const { from, to } = getPeriodRange(period)

    // Все договоры тенанта
    const { data: contracts } = await supabase
      .from('contracts')
      .select('*, clients(full_name), payments(*), contract_funding(share_pct, investors(full_name))')
      .eq('tenant_id', tenantId)

    // Платежи за период
    let paymentsQuery = supabase
      .from('payments')
      .select('*, contracts(tenant_id, sale_price, markup, item_description, clients(full_name))')

    if (from) paymentsQuery = paymentsQuery.gte('paid_at', from.slice(0, 10))
    if (to) paymentsQuery = paymentsQuery.lte('paid_at', to.slice(0, 10))

    const { data: payments } = await paymentsQuery

    // фильтруем только платежи этого тенанта
    const tenantPayments = (payments || []).filter(p => p.contracts?.tenant_id === tenantId)

    // Договоры созданные за период
    let contractsInPeriod = contracts || []
    if (from) {
      contractsInPeriod = contractsInPeriod.filter(c => new Date(c.created_at) >= new Date(from))
    }

    // Считаем метрики
    const totalPaid = tenantPayments.reduce((s, p) => s + Number(p.amount), 0)
    const paymentsCount = tenantPayments.length
    const newContracts = contractsInPeriod.length
    const activeContracts = (contracts || []).filter(c => c.status === 'active').length
    const overdueContracts = (contracts || []).filter(c => c.status === 'overdue').length
    const closedContracts = (contracts || []).filter(c => c.status === 'closed').length

    // Общая ожидаемая прибыль (наценка) по всем договорам
    const totalMarkup = (contracts || []).reduce((s, c) => s + Number(c.markup || 0), 0)

    // Прибыль реализованная = наценка по закрытым
    const earnedMarkup = (contracts || [])
      .filter(c => c.status === 'closed')
      .reduce((s, c) => s + Number(c.markup || 0), 0)

    // Топ платежи за период
    const topPayments = [...tenantPayments]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)

    // Платежи по дням для мини-графика
    const byDay = {}
    tenantPayments.forEach(p => {
      const day = p.paid_at.slice(0, 10)
      byDay[day] = (byDay[day] || 0) + Number(p.amount)
    })
    const dayEntries = Object.entries(byDay).sort()

    setData({
      totalPaid, paymentsCount, newContracts,
      activeContracts, overdueContracts, closedContracts,
      totalMarkup, earnedMarkup,
      topPayments, dayEntries,
    })
    setLoading(false)
  }

  return (
    <div>
      {/* Переключатель периода */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={period === p.value ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 16px', fontSize: 13 }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--stone)' }}>Загрузка...</p>}

      {!loading && data && (
        <div style={{ display: 'grid', gap: 16 }}>

          {/* Оплаты за период */}
          <Section title="Оплаты за период">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCard label="Сумма оплат" value={fmt(data.totalPaid)} color="var(--teal)" big />
              <StatCard label="Количество оплат" value={data.paymentsCount} />
              <StatCard label="Новых договоров" value={data.newContracts} />
            </div>
          </Section>

          {/* Мини-график оплат по дням */}
          {data.dayEntries.length > 0 && (
            <Section title="Оплаты по дням">
              <DayChart entries={data.dayEntries} />
            </Section>
          )}

          {/* Состояние портфеля */}
          <Section title="Состояние портфеля (всё время)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCard label="Активных договоров" value={data.activeContracts} />
              <StatCard label="Просрочка" value={data.overdueContracts} color={data.overdueContracts > 0 ? 'var(--rust)' : undefined} />
              <StatCard label="Закрыто" value={data.closedContracts} color="var(--teal)" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <StatCard label="Ожидаемая наценка (все договоры)" value={fmt(data.totalMarkup)} />
              <StatCard label="Реализованная прибыль (закрытые)" value={fmt(data.earnedMarkup)} color="var(--teal)" />
            </div>
          </Section>

          {/* Топ оплат */}
          {data.topPayments.length > 0 && (
            <Section title={`Крупнейшие оплаты за период (топ ${data.topPayments.length})`}>
              {data.topPayments.map((p, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderTop: idx > 0 ? '1px solid var(--border)' : 'none'
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>
                      {p.contracts?.clients?.full_name || '—'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--stone)', margin: '2px 0 0' }}>
                      {p.contracts?.item_description} · {new Date(p.paid_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <p className="mono" style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--teal)' }}>
                    {fmt(p.amount)}
                  </p>
                </div>
              ))}
            </Section>
          )}

          {data.totalPaid === 0 && data.paymentsCount === 0 && (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--stone)' }}>
              За выбранный период оплат не было
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: '1rem 1.25rem' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--stone)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function StatCard({ label, value, color, big }) {
  return (
    <div style={{ background: 'var(--ivory)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
      <p style={{ fontSize: 11, color: 'var(--stone)', margin: '0 0 4px' }}>{label}</p>
      <p className="mono" style={{ fontSize: big ? 22 : 18, fontWeight: 500, margin: 0, color: color || 'var(--ink)' }}>{value}</p>
    </div>
  )
}

function DayChart({ entries }) {
  const maxVal = Math.max(...entries.map(([, v]) => v))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, padding: '0 4px' }}>
      {entries.map(([day, val]) => (
        <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: '100%', borderRadius: 3,
            height: `${Math.max(4, Math.round((val / maxVal) * 48))}px`,
            background: 'var(--teal)',
            title: fmt(val),
          }} title={`${day}: ${fmt(val)}`} />
          <p style={{ fontSize: 9, color: 'var(--stone)', margin: 0, writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
            {day.slice(5)}
          </p>
        </div>
      ))}
    </div>
  )
}
