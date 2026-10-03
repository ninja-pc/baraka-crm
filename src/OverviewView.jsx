import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) { return (Number(n) || 0).toLocaleString('ru-RU') + ' ₽' }

export default function OverviewView({ tenantId }) {
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState([])
  const [payments, setPayments] = useState([])
  const [cash, setCash] = useState([])
  const [expenses, setExpenses] = useState([])
  const [clients, setClients] = useState([])

  useEffect(() => { load() }, [tenantId])

  async function load() {
    setLoading(true)
    const [c, p, ca, e, cl] = await Promise.all([
      supabase.from('contracts').select('id,status,sale_price,markup,created_at,clients(full_name)').eq('tenant_id', tenantId),
      supabase.from('payments').select('id,amount,paid_at,contracts!inner(tenant_id,clients(full_name))').eq('contracts.tenant_id', tenantId).order('paid_at', { ascending: false }),
      supabase.from('cash_operations').select('id,type,amount,operation_date,category,description').eq('tenant_id', tenantId).order('operation_date', { ascending: false }),
      supabase.from('expenses').select('id,amount,expense_date,category').eq('tenant_id', tenantId),
      supabase.from('clients').select('id').eq('tenant_id', tenantId),
    ])
    setContracts(c.data || [])
    setPayments(p.data || [])
    setCash(ca.data || [])
    setExpenses(e.data || [])
    setClients(cl.data || [])
    setLoading(false)
  }

  const stats = useMemo(() => {
    const active = contracts.filter(c => c.status === 'active').length
    const overdue = contracts.filter(c => c.status === 'overdue').length
    const closed = contracts.filter(c => c.status === 'closed').length
    const expectedProfit = contracts.reduce((s,c) => s + Number(c.markup || 0), 0)
    const paid = payments.reduce((s,p) => s + Number(p.amount || 0), 0)
    const cashIn = cash.filter(x => x.type === 'in' || x.type === 'initial').reduce((s,x) => s + Number(x.amount || 0), 0)
    const cashOut = cash.filter(x => x.type === 'out').reduce((s,x) => s + Number(x.amount || 0), 0)
    const balance = cashIn - cashOut
    const debt = contracts.filter(c => c.status !== 'closed').reduce((s,c) => s + Math.max(0, Number(c.sale_price || 0)), 0) - payments.reduce((s,p) => s + Number(p.amount || 0), 0)
    return { active, overdue, closed, expectedProfit, paid, balance, debt: Math.max(0,debt) }
  }, [contracts,payments,cash])

  const chart = useMemo(() => {
    const days = []
    for (let i=6;i>=0;i--) {
      const d = new Date()
      d.setHours(0,0,0,0)
      d.setDate(d.getDate()-i)
      const key = d.toISOString().slice(0,10)
      const value = payments.filter(p => p.paid_at?.slice(0,10) === key).reduce((s,p)=>s+Number(p.amount||0),0)
      days.push({ label: d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}), value })
    }
    return days
  }, [payments])

  const recent = [...payments].slice(0,5)

  if (loading) return <div className="card" style={{padding:'2rem',color:'var(--stone)'}}>Загрузка обзора...</div>

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'end',marginBottom:20}}>
      <div>
        <p style={{fontSize:12,color:'var(--stone)',margin:'0 0 5px',textTransform:'uppercase',letterSpacing:'.08em'}}>Обзор</p>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:30,fontWeight:500,margin:0}}>Финансовая картина</h1>
      </div>
      <span className="badge badge-active">Сегодня</span>
    </div>

    <div className="overview-grid">
      <Metric label="Денег в кассе" value={fmt(stats.balance)} accent="teal" hint="текущий расчётный остаток" />
      <Metric label="Получено" value={fmt(stats.paid)} hint="все зафиксированные оплаты" />
      <Metric label="Задолженность" value={fmt(stats.debt)} accent="rust" hint="по незакрытым договорам" />
      <Metric label="Ожидаемая наценка" value={fmt(stats.expectedProfit)} hint="по всем договорам" />
    </div>

    <div className="overview-main-grid">
      <section className="card overview-panel">
        <div className="panel-head"><div><p className="eyebrow">Динамика</p><h3>Поступления</h3></div><span>7 дней</span></div>
        <div className="spark-chart">
          {chart.map((d,i)=><div className="spark-col" key={d.label}><div className="spark-value">{d.value ? fmt(d.value) : '—'}</div><div className="spark-track"><div className="spark-bar" style={{height:Math.max(5,Math.round((d.value/Math.max(1,...chart.map(x=>x.value)))*100))+'%'}}/></div><small>{d.label}</small></div>)}
        </div>
      </section>

      <section className="card overview-panel">
        <div className="panel-head"><div><p className="eyebrow">Портфель</p><h3>Договоры</h3></div></div>
        <div className="portfolio-row"><strong>{stats.active}</strong><span>Активных</span></div>
        <div className="portfolio-row"><strong className={stats.overdue?'danger':''}>{stats.overdue}</strong><span>Просрочено</span></div>
        <div className="portfolio-row"><strong>{stats.closed}</strong><span>Закрыто</span></div>
      </section>
    </div>

    <div className="overview-main-grid">
      <section className="card overview-panel">
        <div className="panel-head"><div><p className="eyebrow">Последние операции</p><h3>Поступления</h3></div></div>
        {recent.length ? recent.map(p=><div className="activity-row" key={p.id}><div className="activity-icon">↘</div><div><strong>{p.contracts?.clients?.full_name || 'Клиент'}</strong><small>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ru-RU') : '—'}</small></div><b className="positive">+{fmt(p.amount)}</b></div>) : <Empty text="Платежей пока нет"/>}
      </section>

      <section className="card overview-panel">
        <div className="panel-head"><div><p className="eyebrow">Клиентская база</p><h3>Ключевые показатели</h3></div></div>
        <div className="big-number">{clients.length}<small> клиентов</small></div>
        <div className="mini-stats"><span><b>{stats.active}</b> активных договоров</span><span><b>{expenses.length}</b> расходов</span></div>
      </section>
    </div>
  </div>
}

function Metric({label,value,accent,hint}) { return <div className="metric-card"><span>{label}</span><strong className={accent==='teal'?'positive':accent==='rust'?'danger':''}>{value}</strong><small>{hint}</small></div> }
function Empty({text}) { return <p style={{color:'var(--stone)',fontSize:13}}>{text}</p> }
