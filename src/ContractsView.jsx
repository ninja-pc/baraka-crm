import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function fmt(n) {
  return (n || 0).toLocaleString('ru-RU') + ' ₽'
}

const STATUS_LABEL = { active: 'Активен', overdue: 'Просрочка', closed: 'Закрыт' }
const STATUS_CLASS = { active: 'badge-active', overdue: 'badge-overdue', closed: 'badge-closed' }

function getUrgencyStyle(contract) {
  if (contract.status === 'closed') return {}
  if (contract.status === 'overdue') return { borderLeft: '3px solid #B5482F' }
  const totalPaid = (contract.payments || []).reduce((s, p) => s + Number(p.amount), 0)
  const sorted = [...(contract.payment_schedule || [])].sort((a, b) => a.installment_no - b.installment_no)
  let remaining = totalPaid
  let nextDue = null
  for (const item of sorted) {
    const due = Number(item.amount_due)
    const allocated = Math.min(remaining, due)
    remaining -= allocated
    if (allocated < due - 0.01) { nextDue = item; break }
  }
  if (!nextDue) return {}
  const daysUntil = Math.ceil((new Date(nextDue.due_date) - new Date()) / (1000 * 60 * 60 * 24))
  if (daysUntil <= 0) return { borderLeft: '3px solid #B5482F' }
  if (daysUntil <= 2) return { borderLeft: '3px solid #D4A017' }
  if (totalPaid > 0) return { borderLeft: '3px solid #0E6B5C' }
  return {}
}

function buildScheduleDates(termMonths, paymentDay) {
  const dates = []
  const today = new Date()
  for (let i = 1; i <= termMonths; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(paymentDay, maxDay))
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function Calculator({ form }) {
  const costPrice = Number(form.cost_price) || 0
  const salePrice = Number(form.sale_price) || 0
  const downPayment = Number(form.down_payment) || 0
  const termMonths = Number(form.term_months) || 0
  const paymentDay = Number(form.payment_day) || 1
  if (!salePrice || !termMonths) return null
  const markup = salePrice - costPrice
  const amountToFinance = Math.max(0, salePrice - downPayment)
  const monthlyPayment = termMonths > 0 ? amountToFinance / termMonths : 0
  const dates = buildScheduleDates(termMonths, paymentDay)
  const firstDate = dates[0] ? new Date(dates[0]).toLocaleDateString('ru-RU') : '—'
  const lastDate = dates[dates.length - 1] ? new Date(dates[dates.length - 1]).toLocaleDateString('ru-RU') : '—'
  return (
    <div style={{ background: 'var(--teal-bg)', border: '1px solid var(--teal)', borderRadius: 8, padding: '12px 14px' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' }}>📊 Расчёт рассрочки</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {[
          { label: 'Наценка (доход)', value: fmt(markup), color: 'var(--teal)' },
          ...(downPayment > 0 ? [{ label: 'Первоначальный взнос', value: fmt(downPayment) }] : []),
          { label: 'Сумма к рассрочке', value: fmt(amountToFinance) },
          { label: 'Ежемесячный платёж', value: fmt(Math.round(monthlyPayment)), bold: true },
          { label: 'Первый платёж', value: firstDate },
          { label: 'Последний платёж', value: lastDate },
        ].map((row, i) => (
          <div key={i}>
            <p style={{ fontSize: 11, color: 'var(--stone)', margin: 0 }}>{row.label}</p>
            <p className="mono" style={{ fontSize: 14, margin: 0, color: row.color || 'var(--ink)', fontWeight: row.bold ? 600 : 400 }}>{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const emptyGuarantor = {
  full_name: '', birth_date: '', phone: '',
  registration_address: '',
  passport_series: '', passport_number: '', passport_issued_by: '',
  passport_issue_date: '', passport_department_code: '', notes: ''
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(value) {
  return value ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('ru-RU') : '—'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function printContract(contract, sellerName, companyName) {
  const client = contract.clients || {}
  const guarantors = contract.guarantors || []
  const schedule = [...(contract.payment_schedule || [])].sort((a, b) => a.installment_no - b.installment_no)
  const totalPrice = Number(contract.sale_price || 0)
  const downPayment = Number(contract.down_payment || 0)
  const creditAmount = Math.max(0, totalPrice - downPayment)
  const totalSchedule = schedule.reduce((s, x) => s + Number(x.amount_due || 0), 0)
  const money = n => fmt(Number(n || 0))
  const dateLong = value => value ? new Date(value + 'T00:00:00').toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' }) : '—'
  const clean = value => escapeHtml(value || '—')

  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
  <title>Договор № ${clean(contract.contract_number)}</title>
  <style>
    @page{size:A4;margin:16mm 17mm 18mm}*{box-sizing:border-box}
    body{font-family:"Times New Roman",serif;color:#111;font-size:12pt;line-height:1.42;margin:0}
    .header{text-align:center;margin-bottom:20px}.company{font-size:14pt;font-weight:700;text-transform:uppercase}
    h1{font-size:16pt;line-height:1.25;margin:12px 0 5px;text-transform:uppercase}.number{text-align:center;font-size:11pt}
    h2{font-size:13pt;margin:18px 0 8px;text-transform:uppercase}.intro{margin:16px 0}
    p{margin:6px 0;text-align:justify}table{width:100%;border-collapse:collapse;margin:9px 0 14px}
    th,td{border:1px solid #222;padding:6px 8px}th{text-align:center}.right{text-align:right;white-space:nowrap}
    .box{border:1px solid #222;padding:9px 11px;margin:9px 0}.sign{margin-top:28px;page-break-inside:avoid}
    .sign td{border:0;width:50%;padding:13px 12px 13px 0;vertical-align:top}.line{display:inline-block;border-bottom:1px solid #111;width:155px;height:17px}
    .small{font-size:10pt}
  </style></head><body>
  <div class="header"><div class="company">${clean(companyName)}</div>
  <h1>Договор купли-продажи товара<br>с рассрочкой платежа</h1>
  <div class="number">№ ${clean(contract.contract_number)} от ${dateLong(contract.contract_date)}</div></div>
  <p class="intro">г. ______________________________ &nbsp;&nbsp; «____» ______________ 20____ г.</p>
  <p>Гражданин(ка) <b>${clean(client.full_name)}</b>, именуемый(ая) в дальнейшем «Покупатель», с одной стороны, и <b>${clean(companyName)}</b>, в лице <b>${clean(sellerName)}</b>, именуемый в дальнейшем «Продавец», с другой стороны, заключили настоящий договор о нижеследующем.</p>

  <h2>1. Предмет договора</h2>
  <p>1.1. Продавец передает Покупателю товар, а Покупатель принимает товар и обязуется оплатить его стоимость в порядке и сроки, установленные настоящим договором.</p>
  <p>1.2. Товар: <b>${clean(contract.item_description)}</b>.</p>
  <p>1.3. Комплектность, внешний вид и основные характеристики товара проверяются Покупателем при получении. При наличии серийного номера он указывается в товарных документах.</p>

  <h2>2. Данные покупателя</h2>
  <p><b>ФИО:</b> ${clean(client.full_name)}; <b>дата рождения:</b> ${dateLong(client.birth_date)}.</p>
  <p><b>Паспорт:</b> серия ${clean(client.passport_series)}, № ${clean(client.passport_number)}, выдан ${clean(client.passport_issued_by)}, дата выдачи ${dateLong(client.passport_issue_date)}, код подразделения ${clean(client.passport_department_code)}.</p>
  <p><b>Адрес регистрации:</b> ${clean(client.registration_address || client.address)}.</p>
  <p><b>Телефон:</b> ${clean(client.phone)}.</p>

  <h2>3. Цена и рассрочка</h2>
  <p>3.1. Цена товара составляет <b>${money(totalPrice)}</b>.</p>
  <p>3.2. Первоначальный платеж составляет <b>${money(downPayment)}</b>. Сумма, предоставленная в рассрочку, составляет <b>${money(creditAmount)}</b>.</p>
  <p>3.3. Покупатель обязан оплачивать каждый платеж не позднее указанной в графике даты. Платеж считается исполненным после фактического поступления денежных средств Продавцу.</p>
  <p>3.4. Досрочное погашение допускается без дополнительной комиссии.</p>

  <h2>4. График платежей</h2>
  <table><thead><tr><th>№</th><th>Дата платежа</th><th>Сумма</th></tr></thead><tbody>
  ${schedule.map(x => `<tr><td style="text-align:center">${x.installment_no}</td><td>${dateLong(x.due_date)}</td><td class="right">${money(x.amount_due)}</td></tr>`).join('')}
  <tr><td colspan="2"><b>Итого платежей по рассрочке</b></td><td class="right"><b>${money(totalSchedule || creditAmount)}</b></td></tr></tbody></table>

  <h2>5. Порядок оплаты и досрочное погашение</h2>
  <p>5.1. Покупатель самостоятельно контролирует сроки оплаты и обязан обеспечить наличие денежных средств к каждой дате платежа.</p>
  <p>5.2. Частичное или полное досрочное погашение допускается. При досрочном погашении остаток задолженности определяется по данным учета Продавца на дату платежа.</p>
  <p>5.3. Любое изменение графика платежей оформляется письменно и подписывается Сторонами.</p>

  <h2>6. Просрочка</h2>
  <p>6.1. При просрочке Покупатель обязан погасить сумму просроченного платежа и сохраняет обязанность исполнить остальные платежи по договору.</p>
  <p>6.2. Продавец вправе направить Покупателю письменное требование об устранении просрочки и использовать иные способы защиты права, предусмотренные законодательством Российской Федерации.</p>
  <p>6.3. Неустойка, штрафы и иные платежи за просрочку не начисляются, если они прямо не предусмотрены отдельным письменным соглашением Сторон и законодательством Российской Федерации.</p>

  <h2>7. Поручительство</h2>
  ${guarantors.length ? guarantors.map((g,i) => `<div class="box">
    <p><b>Поручитель №${i+1}: ${clean(g.full_name)}</b>; дата рождения: ${dateLong(g.birth_date)}.</p>
    <p><b>Паспорт:</b> серия ${clean(g.passport_series)}, № ${clean(g.passport_number)}, выдан ${clean(g.passport_issued_by)}, дата выдачи ${dateLong(g.passport_issue_date)}, код подразделения ${clean(g.passport_department_code)}.</p>
    <p><b>Адрес регистрации:</b> ${clean(g.registration_address || g.address)}; <b>телефон:</b> ${clean(g.phone)}.</p>
    <p>Поручитель подтверждает ознакомление с условиями договора. Объем и пределы ответственности поручителя определяются условиями настоящего договора, подписанного им, и законодательством Российской Федерации.</p>
  </div>`).join('') : '<p>Поручитель по договору отсутствует.</p>'}

  <h2>8. Передача товара и качество</h2>
  <p>8.1. При получении товара Покупатель проверяет его внешний вид, комплектность и работоспособность, если такая проверка возможна на месте.</p>
  <p>8.2. Подписание настоящего договора подтверждает ознакомление Покупателя с товаром и условиями его оплаты.</p>
  <p>8.3. Требования по качеству товара предъявляются в порядке, установленном законодательством Российской Федерации.</p>

  <h2>9. Персональные данные</h2>
  <p>Стороны подтверждают достоверность предоставленных сведений. Персональные данные обрабатываются исключительно в целях заключения, исполнения и учета настоящего договора и в соответствии с применимым законодательством.</p>

  <h2>10. Заключительные положения</h2>
  <p>10.1. Все изменения и дополнения к договору оформляются письменно и подписываются Сторонами.</p>
  <p>10.2. Споры разрешаются путем переговоров, а при недостижении соглашения — в порядке, установленном законодательством Российской Федерации.</p>
  <p>10.3. Договор составлен в экземплярах для Продавца, Покупателя и каждого поручителя. Все подписанные экземпляры имеют одинаковую юридическую силу.</p>

  <div class="sign"><h2>11. Подписи сторон</h2><table><tr>
  <td><b>ПРОДАВЕЦ</b><br>${clean(companyName)}<br>${clean(sellerName)}<br><br>Подпись: <span class="line"></span></td>
  <td><b>ПОКУПАТЕЛЬ</b><br>${clean(client.full_name)}<br><br>Подпись: <span class="line"></span></td></tr>
  ${guarantors.map((g,i)=>`<tr><td><b>ПОРУЧИТЕЛЬ №${i+1}</b><br>${clean(g.full_name)}<br><br>Подпись: <span class="line"></span></td><td></td></tr>`).join('')}</table></div>
  </body></html>`
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) { alert('Браузер заблокировал окно печати. Разрешите всплывающие окна для сайта.'); return }
  w.document.write(html); w.document.close()
}
export default function ContractsView({ tenantId, profile }) {
  const [contracts, setContracts] = useState([])
  const [investors, setInvestors] = useState([])
  const [freeCapital, setFreeCapital] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [dupWarning, setDupWarning] = useState('')
  const [form, setForm] = useState({
    client_name: '', client_birth_date: '', client_phone: '', client_address: '', client_registration_address: '',
    client_passport_series: '', client_passport_number: '', client_passport_issued_by: '', client_passport_issue_date: '', client_passport_department_code: '',
    contract_number: '', contract_date: todayIso(),
    item_description: '', cost_price: '', sale_price: '',
    down_payment: '', term_months: '', payment_day: '1',
  })
  const [pool, setPool] = useState([{ investor_id: '', amount: '' }])
  const [guarantors, setGuarantors] = useState([{ ...emptyGuarantor }])

  useEffect(() => { loadAll() }, [tenantId])

  async function loadAll() {
    setLoading(true)
    const { data: contractsData } = await supabase
      .from('contracts')
      .select('*, clients(full_name, phone, address, birth_date, passport_series, passport_number, passport_issued_by, passport_issue_date, passport_department_code, registration_address), contract_funding(*, investors(full_name)), payment_schedule(*), payments(*), guarantors(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    const { data: investorsData } = await supabase
      .from('investors').select('id, full_name, total_capital').eq('tenant_id', tenantId)
    const { data: activeFunding } = await supabase
      .from('contract_funding').select('investor_id, amount, contracts(status)')
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

  function checkDuplicate(name) {
    if (!name || name.length < 3) { setDupWarning(''); return }
    const existing = contracts.filter(c =>
      c.clients?.full_name?.toLowerCase().includes(name.toLowerCase()) && c.status !== 'closed'
    )
    setDupWarning(existing.length > 0
      ? `⚠️ У клиента "${existing[0].clients.full_name}" уже есть активный договор: ${existing[0].item_description}`
      : '')
  }

  function autoDistribute() {
    const cost = Number(form.cost_price)
    if (!cost) { alert('Сначала введите закупочную цену'); return }
    const eligible = investors.filter(inv => (freeCapital[inv.id] || 0) > 0)
    if (!eligible.length) { alert('Нет инвесторов со свободным капиталом'); return }
    const totalFree = eligible.reduce((s, inv) => s + freeCapital[inv.id], 0)
    let remaining = cost
    setPool(eligible.map((inv, idx) => {
      const isLast = idx === eligible.length - 1
      const amount = isLast ? remaining : Math.floor(cost * freeCapital[inv.id] / totalFree)
      remaining -= amount
      return { investor_id: inv.id, amount: String(amount) }
    }))
  }

  function addPoolRow() { setPool([...pool, { investor_id: '', amount: '' }]) }
  function updatePoolRow(idx, f, v) { const n = [...pool]; n[idx][f] = v; setPool(n) }
  function removePoolRow(idx) { setPool(pool.filter((_, i) => i !== idx)) }

  function addGuarantor() { if (guarantors.length < 2) setGuarantors([...guarantors, { ...emptyGuarantor }]) }
  function updateGuarantor(idx, f, v) { const n = [...guarantors]; n[idx][f] = v; setGuarantors(n) }
  function removeGuarantor(idx) { setGuarantors(guarantors.filter((_, i) => i !== idx)) }

  const poolTotal = pool.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  function nextContractNumber() {
    const nums = contracts.map(c => Number.parseInt(c.contract_number, 10)).filter(Number.isFinite)
    return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')
  }
  const costPrice = Number(form.cost_price) || 0
  const poolMismatch = poolTotal > 0 && costPrice > 0 && poolTotal !== costPrice

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const contractNumber = form.contract_number.trim() || nextContractNumber()
    const { data: client, error: ce } = await supabase.from('clients')
      .insert({
        tenant_id: tenantId, full_name: form.client_name.trim(), phone: form.client_phone.trim() || null,
        address: form.client_address.trim() || null, birth_date: form.client_birth_date || null,
        registration_address: form.client_registration_address.trim() || null,
        passport_series: form.client_passport_series.trim() || null,
        passport_number: form.client_passport_number.trim() || null,
        passport_issued_by: form.client_passport_issued_by.trim() || null,
        passport_issue_date: form.client_passport_issue_date || null,
        passport_department_code: form.client_passport_department_code.trim() || null,
      })
      .select().single()
    if (ce) { setSaving(false); alert('Ошибка клиента: ' + ce.message); return }

    const downPayment = Number(form.down_payment) || 0
    const salePrice = Number(form.sale_price)
    const amountToFinance = Math.max(0, salePrice - downPayment)
    const paymentDay = Number(form.payment_day) || 1

    const { data: contract, error: coe } = await supabase.from('contracts')
      .insert({
        tenant_id: tenantId, client_id: client.id,
        item_description: form.item_description,
        cost_price: Number(form.cost_price), sale_price: salePrice,
        down_payment: downPayment, term_months: Number(form.term_months), payment_day: paymentDay,
        contract_number: contractNumber, contract_date: form.contract_date || todayIso(),
      }).select().single()
    if (coe) { setSaving(false); alert('Ошибка договора: ' + coe.message); return }

    // Поручители
    const gRows = guarantors.filter(g => g.full_name.trim()).map(g => ({
      contract_id: contract.id, full_name: g.full_name,
      phone: g.phone || null, address: g.registration_address || null, notes: g.notes || null,
      birth_date: g.birth_date || null, registration_address: g.registration_address || null,
      passport_series: g.passport_series || null, passport_number: g.passport_number || null,
      passport_issued_by: g.passport_issued_by || null, passport_issue_date: g.passport_issue_date || null,
      passport_department_code: g.passport_department_code || null,
    }))
    if (gRows.length > 0) {
      const { error: ge } = await supabase.from('guarantors').insert(gRows)
      if (ge) { setSaving(false); alert('Ошибка поручителей: ' + ge.message); return }
    }

    // Пул инвесторов
    const fundingRows = pool.filter(p => p.investor_id && p.amount).map(p => ({
      contract_id: contract.id, investor_id: p.investor_id, amount: Number(p.amount),
      share_pct: costPrice > 0 ? Math.round((Number(p.amount) / costPrice) * 10000) / 100 : 0,
    }))
    if (fundingRows.length > 0) {
      const { error: fe } = await supabase.from('contract_funding').insert(fundingRows)
      if (fe) { setSaving(false); alert('Ошибка пула: ' + fe.message); return }
    }

    // График платежей
    const months = Number(form.term_months)
    const base = Math.floor((amountToFinance / months) * 100) / 100
    const dates = buildScheduleDates(months, paymentDay)
    let rt = 0
    const scheduleRows = dates.map((due_date, i) => {
      const amount = i === months - 1 ? Math.round((amountToFinance - rt) * 100) / 100 : base
      rt += amount
      return { contract_id: contract.id, installment_no: i + 1, due_date, amount_due: amount }
    })
    const { error: se } = await supabase.from('payment_schedule').insert(scheduleRows)
    if (se) { setSaving(false); alert('Ошибка графика: ' + se.message); return }

    setSaving(false)
    setShowForm(false)
    setDupWarning('')
    setForm({ client_name: '', client_birth_date: '', client_phone: '', client_address: '', client_registration_address: '', client_passport_series: '', client_passport_number: '', client_passport_issued_by: '', client_passport_issue_date: '', client_passport_department_code: '', contract_number: '', contract_date: todayIso(), item_description: '', cost_price: '', sale_price: '', down_payment: '', term_months: '', payment_day: '1' })
    setPool([{ investor_id: '', amount: '' }])
    setGuarantors([{ ...emptyGuarantor }])
    loadAll()
  }

  async function handleDeleteContract(id) {
    if (!confirm('Удалить договор? Все данные будут удалены.')) return
    await supabase.from('contracts').delete().eq('id', id)
    setSelected(null)
    loadAll()
  }

  if (loading) return <p style={{ color: 'var(--stone)' }}>Загрузка...</p>

  const activeCount = contracts.filter(c => c.status === 'active').length
  const overdueCount = contracts.filter(c => c.status === 'overdue').length
  const closedCount = contracts.filter(c => c.status === 'closed').length
  const totalMarkup = contracts.reduce((s, c) => s + Number(c.markup || 0), 0)

  const filtered = contracts.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.clients?.full_name?.toLowerCase().includes(q) ||
      c.item_description?.toLowerCase().includes(q) ||
      c.clients?.phone?.includes(q) ||
      c.clients?.address?.toLowerCase().includes(q) ||
      (c.guarantors || []).some(g => g.full_name.toLowerCase().includes(q))
    )
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        <SummaryCard label="Активных" value={activeCount} />
        <SummaryCard label="Ожидаемая наценка" value={fmt(totalMarkup)} color="var(--teal)" />
        <SummaryCard label="Просрочка" value={overdueCount} color={overdueCount > 0 ? 'var(--rust)' : undefined} />
        <SummaryCard label="Закрыто" value={closedCount} />
      </div>

      <input className="input-field"
        placeholder="🔍 Поиск по клиенту, товару, телефону, адресу или поручителю..."
        value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>{filtered.length} из {contracts.length} договор(ов)</p>
        <button className="btn-primary" onClick={() => { setShowForm(s => !s); setDupWarning('') }}>
          {showForm ? 'Отмена' : '+ Новый договор'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: 'var(--stone)' }}>
        <span><span style={{ color: '#0E6B5C' }}>▌</span> Есть оплата</span>
        <span><span style={{ color: '#D4A017' }}>▌</span> До платежа ≤ 2 дня</span>
        <span><span style={{ color: '#B5482F' }}>▌</span> Просрочка</span>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="card" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'grid', gap: 12 }}>

          {/* Клиент */}
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--stone)' }}>Клиент</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <input className="input-field" placeholder="ФИО клиента" required value={form.client_name}
                onChange={e => { setForm({ ...form, client_name: e.target.value }); checkDuplicate(e.target.value) }} />
              {dupWarning && <p style={{ color: '#D4A017', fontSize: 12, margin: '4px 0 0' }}>{dupWarning}</p>}
            </div>
            <input className="input-field" placeholder="Телефон" value={form.client_phone}
              onChange={e => setForm({ ...form, client_phone: e.target.value })} />
          </div>
          <input className="input-field" placeholder="Адрес (город, улица, дом, квартира)"
            value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="input-field" type="date" title="Дата рождения" value={form.client_birth_date}
              onChange={e => setForm({ ...form, client_birth_date: e.target.value })} />
            <input className="input-field" placeholder="Адрес регистрации (прописка)" value={form.client_registration_address}
              onChange={e => setForm({ ...form, client_registration_address: e.target.value })} />
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--stone)', margin: 0 }}>Паспортные данные покупателя</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input className="input-field" placeholder="Серия" value={form.client_passport_series}
                onChange={e => setForm({ ...form, client_passport_series: e.target.value })} />
              <input className="input-field" placeholder="Номер" value={form.client_passport_number}
                onChange={e => setForm({ ...form, client_passport_number: e.target.value })} />
              <input className="input-field" type="date" title="Дата выдачи" value={form.client_passport_issue_date}
                onChange={e => setForm({ ...form, client_passport_issue_date: e.target.value })} />
            </div>
            <input className="input-field" placeholder="Кем выдан паспорт" value={form.client_passport_issued_by}
              onChange={e => setForm({ ...form, client_passport_issued_by: e.target.value })} />
            <input className="input-field" placeholder="Код подразделения" value={form.client_passport_department_code}
              onChange={e => setForm({ ...form, client_passport_department_code: e.target.value })} />
          </div>

          {/* Поручители */}
          <p style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 0', color: 'var(--stone)' }}>Поручители (до 2-х)</p>
          {guarantors.map((g, idx) => (
            <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--stone)', margin: 0 }}>Поручитель {idx + 1}</p>
                {guarantors.length > 1 && (
                  <button type="button" onClick={() => removeGuarantor(idx)}
                    className="btn-secondary" style={{ padding: '2px 10px', fontSize: 12, marginLeft: 'auto' }}>
                    Удалить
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="input-field" placeholder="ФИО поручителя"
                  value={g.full_name} onChange={e => updateGuarantor(idx, 'full_name', e.target.value)} />
                <input className="input-field" placeholder="Телефон"
                  value={g.phone} onChange={e => updateGuarantor(idx, 'phone', e.target.value)} />
              </div>
              <input className="input-field" placeholder="Адрес поручителя"
                value={g.address} onChange={e => updateGuarantor(idx, 'address', e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="input-field" type="date" title="Дата рождения" value={g.birth_date}
                  onChange={e => updateGuarantor(idx, 'birth_date', e.target.value)} />
                <input className="input-field" placeholder="Адрес регистрации (прописка)" value={g.registration_address}
                  onChange={e => updateGuarantor(idx, 'registration_address', e.target.value)} />
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'grid', gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--stone)', margin: 0 }}>Паспортные данные</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <input className="input-field" placeholder="Серия" value={g.passport_series} onChange={e => updateGuarantor(idx, 'passport_series', e.target.value)} />
                  <input className="input-field" placeholder="Номер" value={g.passport_number} onChange={e => updateGuarantor(idx, 'passport_number', e.target.value)} />
                  <input className="input-field" type="date" title="Дата выдачи" value={g.passport_issue_date} onChange={e => updateGuarantor(idx, 'passport_issue_date', e.target.value)} />
                </div>
                <input className="input-field" placeholder="Кем выдан паспорт" value={g.passport_issued_by} onChange={e => updateGuarantor(idx, 'passport_issued_by', e.target.value)} />
                <input className="input-field" placeholder="Код подразделения" value={g.passport_department_code} onChange={e => updateGuarantor(idx, 'passport_department_code', e.target.value)} />
              </div>
              <input className="input-field" placeholder="Заметки (необязательно)"
                value={g.notes} onChange={e => updateGuarantor(idx, 'notes', e.target.value)} />
            </div>
          ))}
          {guarantors.length < 2 && (
            <button type="button" onClick={addGuarantor} className="btn-secondary" style={{ justifySelf: 'start' }}>
              + Добавить второго поручителя
            </button>
          )}

          {/* Договор */}
          <p style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 0', color: 'var(--stone)' }}>Договор</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="input-field" placeholder={`Номер договора (по умолчанию ${nextContractNumber()})`} value={form.contract_number}
              onChange={e => setForm({ ...form, contract_number: e.target.value })} />
            <input className="input-field" type="date" value={form.contract_date}
              onChange={e => setForm({ ...form, contract_date: e.target.value })} />
          </div>
          <input className="input-field" placeholder="Товар / описание" required
            value={form.item_description} onChange={e => setForm({ ...form, item_description: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="input-field" placeholder="Закупочная цена (₽)" type="number" required
              value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
            <input className="input-field" placeholder="Цена продажи (₽)" type="number" required
              value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <input className="input-field" placeholder="Первоначальный взнос (₽)" type="number"
                value={form.down_payment} onChange={e => setForm({ ...form, down_payment: e.target.value })} />
              <p style={{ fontSize: 11, color: 'var(--stone)', margin: '4px 0 0' }}>Необязательно</p>
            </div>
            <input className="input-field" placeholder="Срок (мес.)" type="number" required
              value={form.term_months} onChange={e => setForm({ ...form, term_months: e.target.value })} />
            <div>
              <select className="input-field" value={form.payment_day}
                onChange={e => setForm({ ...form, payment_day: e.target.value })}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}-е число</option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: 'var(--stone)', margin: '4px 0 0' }}>День оплаты</p>
            </div>
          </div>

          <Calculator form={form} />

          {/* Пул инвесторов */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 0' }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--stone)', flex: 1 }}>
              Пул инвесторов {poolMismatch && <span style={{ color: 'var(--rust)', fontWeight: 400 }}>— сумма ≠ закупочной цене</span>}
            </p>
            <button type="button" onClick={autoDistribute} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }}>
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
          <button type="button" onClick={addPoolRow} className="btn-secondary" style={{ justifySelf: 'start' }}>
            + Добавить инвестора
          </button>
          <button className="btn-primary" disabled={saving} style={{ justifySelf: 'start', marginTop: 8 }}>
            {saving ? 'Сохраняем...' : 'Создать договор'}
          </button>
        </form>
      )}

      {filtered.length === 0 && !showForm && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--stone)' }}>
          {search ? `Ничего не найдено по запросу «${search}»` : 'Пока нет договоров. Создайте первый.'}
        </div>
      )}

      {filtered.map(c => {
        const urgencyStyle = getUrgencyStyle(c)
        const totalPaid = (c.payments || []).reduce((s, p) => s + Number(p.amount), 0)
        const isDouble = contracts.filter(x =>
          x.clients?.full_name === c.clients?.full_name && x.id !== c.id && x.status !== 'closed'
        ).length > 0

        return (
          <div key={c.id}>
            <div onClick={() => setSelected(selected === c.id ? null : c.id)}
              className="card" style={{ padding: 12, marginBottom: 8, cursor: 'pointer', ...urgencyStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <p style={{ fontWeight: 500, fontSize: 14, margin: 0, flex: 1 }}>
                  {c.item_description}
                  {isDouble && (
                    <span style={{ marginLeft: 8, fontSize: 11, background: '#FFF3CD', color: '#856404', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>
                      2-й договор
                    </span>
                  )}
                </p>
                <span className={`badge ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 4px' }}>
                {c.clients?.full_name} · {c.term_months} мес · оплата {c.payment_day || 1}-го
                {Number(c.down_payment) > 0 && <span> · взнос {fmt(c.down_payment)}</span>}
                {(c.guarantors || []).length > 0 && <span> · {c.guarantors.length} поруч.</span>}
              </p>
              {c.clients?.address && (
                <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 4px' }}>📍 {c.clients.address}</p>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span className="mono">Цена: {fmt(c.sale_price)}</span>
                <span className="mono" style={{ color: 'var(--teal)' }}>Наценка: {fmt(c.markup)}</span>
                {totalPaid > 0 && <span className="mono" style={{ color: 'var(--stone)' }}>Оплачено: {fmt(totalPaid)}</span>}
              </div>
            </div>

            {selected === c.id && (
              <div className="card" style={{ padding: '0.75rem 1rem', marginTop: -4, marginBottom: 8, background: 'var(--ivory)' }}>

                {/* Клиент */}
                <p style={{ fontSize: 12, color: 'var(--stone)', margin: '0 0 4px' }}>Клиент</p>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{c.clients?.full_name}</p>
                {c.clients?.phone && <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>📞 {c.clients.phone}</p>}
                {c.clients?.address && <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 4px' }}>📍 {c.clients.address}</p>}

                {/* Поручители */}
                {(c.guarantors || []).length > 0 && (
                  <>
                    <p style={{ fontSize: 12, color: 'var(--stone)', margin: '10px 0 6px' }}>Поручители</p>
                    {c.guarantors.map((g, idx) => (
                      <div key={idx} style={{ padding: '8px 10px', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{idx + 1}. {g.full_name}</p>
                        {g.phone && <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>📞 {g.phone}</p>}
                        {g.address && <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>📍 {g.address}</p>}
                        {g.notes && <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>💬 {g.notes}</p>}
                      </div>
                    ))}
                  </>
                )}

                {/* Взнос */}
                {Number(c.down_payment) > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--stone)', margin: '8px 0' }}>
                    Взнос: <span className="mono" style={{ fontWeight: 500 }}>{fmt(c.down_payment)}</span>
                    {' · '}к рассрочке: <span className="mono" style={{ fontWeight: 500 }}>{fmt(Number(c.sale_price) - Number(c.down_payment))}</span>
                  </p>
                )}

                {/* Пул */}
                <p style={{ fontSize: 12, color: 'var(--stone)', margin: '10px 0 6px' }}>Пул инвесторов</p>
                {(c.contract_funding || []).map((f, idx) => {
                  const investorProfit = Math.round(Number(c.markup) * Number(f.share_pct)) / 100
                  const paidProfit = totalPaid > 0 && Number(c.sale_price) > 0
                    ? Math.round((totalPaid / Number(c.sale_price)) * investorProfit) : 0
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <p style={{ fontSize: 13, margin: 0 }}>{f.investors?.full_name}</p>
                        {paidProfit > 0 && (
                          <p style={{ fontSize: 11, color: 'var(--teal)', margin: '2px 0 0' }}>
                            прибыль по оплатам: {fmt(paidProfit)} из {fmt(investorProfit)}
                          </p>
                        )}
                      </div>
                      <p className="mono" style={{ fontSize: 13, margin: 0 }}>{fmt(f.amount)} · {f.share_pct}%</p>
                    </div>
                  )
                })}

                {/* График */}
                <p style={{ fontSize: 12, color: 'var(--stone)', margin: '14px 0 6px' }}>График платежей</p>
                <PaymentSchedule contract={c} profile={profile} onChanged={loadAll} />

                <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button className="btn-primary" style={{ fontSize: 12 }}
                    onClick={e => { e.stopPropagation(); printContract(c, profile.full_name, profile.tenants?.name) }}>
                    🖨️ Печать договора
                  </button>
                  <button className="btn-secondary"
                    style={{ fontSize: 12, color: 'var(--rust)', borderColor: 'var(--rust-bg)' }}
                    onClick={e => { e.stopPropagation(); handleDeleteContract(c.id) }}>
                    Удалить договор
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PaymentSchedule({ contract, profile, onChanged }) {
  const [payingId, setPayingId] = useState(null)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const isClosed = contract.status === 'closed'
  const schedule = [...(contract.payment_schedule || [])].sort((a, b) => a.installment_no - b.installment_no)
  const totalPaid = (contract.payments || []).reduce((s, p) => s + Number(p.amount), 0)
  const amountToFinance = Math.max(0, Number(contract.sale_price) - Number(contract.down_payment || 0))
  const progressPct = amountToFinance > 0 ? Math.min(100, Math.round((totalPaid / amountToFinance) * 100)) : 0
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
    try {
      const { error } = await supabase.from('payments').insert({
        contract_id: contract.id, amount: Number(amount), received_by: profile.id,
      })
      if (error) { alert('Ошибка: ' + error.message); return }
      setPayingId(null); setAmount(''); onChanged()
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--stone-light)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: isClosed ? 'var(--teal)' : 'var(--ink)' }} />
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--stone)' }}>{progressPct}% оплачено</span>
      </div>
      {isClosed && <p style={{ fontSize: 12, color: 'var(--teal)', margin: '0 0 10px', fontWeight: 500 }}>✓ Договор полностью оплачен и закрыт</p>}
      {rows.map(item => (
        <div key={item.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, margin: 0 }}>Платёж {item.installment_no} · {new Date(item.due_date).toLocaleDateString('ru-RU')}</p>
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
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => { setPayingId(item.id); setAmount(String(item.amount_due - item.allocated)) }}>
                  Внести оплату
                </button>
              )}
            </div>
          </div>
          {payingId === item.id && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="input-field" type="number" autoFocus
                value={amount} onChange={e => setAmount(e.target.value)} style={{ maxWidth: 160 }} />
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
      {schedule.length === 0 && <p style={{ fontSize: 12, color: 'var(--stone)' }}>График не сформирован.</p>}
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
