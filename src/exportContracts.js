function escapeXls(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function xlsDate(value) {
  if (!value) return ''
  const d = new Date(value + (String(value).length === 10 ? 'T00:00:00' : ''))
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('ru-RU')
}

function xlsMoney(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function downloadXls(filename, html) {
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportContractsToXls(contracts, companyName = '') {
  const rows = (contracts || []).map((c) => {
    const client = c.clients || {}
    const guarantors = c.guarantors || []
    const payments = c.payments || []
    const schedule = c.payment_schedule || []
    const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const price = Number(c.sale_price || 0)
    const down = Number(c.down_payment || 0)
    const financed = Math.max(0, price - down)
    const scheduleTotal = schedule.reduce((sum, p) => sum + Number(p.amount_due || 0), 0)
    const debt = Math.max(0, financed - paid)
    const g1 = guarantors[0] || {}
    const g2 = guarantors[1] || {}

    return [
      c.contract_number || '',
      xlsDate(c.contract_date),
      c.status === 'active' ? 'Активен' : c.status === 'overdue' ? 'Просрочка' : c.status === 'closed' ? 'Закрыт' : (c.status || ''),
      client.full_name || '',
      client.birth_date ? xlsDate(client.birth_date) : '',
      client.phone || '',
      client.address || '',
      client.registration_address || '',
      client.passport_series || '',
      client.passport_number || '',
      client.passport_issued_by || '',
      xlsDate(client.passport_issue_date),
      client.passport_department_code || '',
      c.item_description || '',
      xlsMoney(c.cost_price),
      xlsMoney(price),
      xlsMoney(c.markup),
      xlsMoney(down),
      xlsMoney(financed),
      xlsMoney(c.term_months),
      c.payment_day || '',
      xlsMoney(c.payment_schedule?.length ? scheduleTotal : financed),
      xlsMoney(paid),
      xlsMoney(debt),
      schedule.length,
      schedule.length ? xlsDate(schedule[schedule.length - 1].due_date) : '',
      g1.full_name || '',
      g1.phone || '',
      g1.registration_address || g1.address || '',
      g1.passport_series || '',
      g1.passport_number || '',
      g1.passport_issued_by || '',
      xlsDate(g1.passport_issue_date),
      g1.passport_department_code || '',
      g2.full_name || '',
      g2.phone || '',
      g2.registration_address || g2.address || '',
      g2.passport_series || '',
      g2.passport_number || '',
      g2.passport_issued_by || '',
      xlsDate(g2.passport_issue_date),
      g2.passport_department_code || '',
      payments.length,
      c.created_at ? xlsDate(c.created_at) : '',
    ]
  })

  const headers = [
    '№ договора','Дата договора','Статус','Покупатель','Дата рождения','Телефон',
    'Адрес','Адрес регистрации','Паспорт серия','Паспорт номер','Паспорт выдан',
    'Дата выдачи паспорта','Код подразделения','Товар / описание','Закупочная цена',
    'Цена продажи','Наценка','Первоначальный взнос','Сумма в рассрочку','Срок, мес.',
    'День платежа','Сумма по графику','Оплачено','Остаток долга','Кол-во платежей',
    'Последний платеж','Поручитель 1','Телефон поручителя 1','Регистрация поручителя 1',
    'Паспорт серия П1','Паспорт номер П1','Паспорт выдан П1','Дата выдачи П1','Код П1',
    'Поручитель 2','Телефон поручителя 2','Регистрация поручителя 2',
    'Паспорт серия П2','Паспорт номер П2','Паспорт выдан П2','Дата выдачи П2','Код П2',
    'Кол-во внесенных оплат','Дата создания'
  ]

  const headerHtml = headers.map(h => '<th>' + escapeXls(h) + '</th>').join('')
  const bodyHtml = rows.map(row =>
    '<tr>' + row.map((value, i) => {
      const numeric = [14,15,16,17,18,20,21,22,23].includes(i)
      return '<td' + (numeric ? ' x:num' : '') + '>' + escapeXls(value) + '</td>'
    }).join('') + '</tr>'
  ).join('')

  const generatedAt = new Date().toLocaleString('ru-RU')
  const title = companyName ? 'Договоры — ' + companyName : 'Договоры Baraka CRM'
  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>${escapeXls(title)}</title>
<style>
body{font-family:Arial,sans-serif;font-size:10pt}
table{border-collapse:collapse}
th,td{border:1px solid #999;padding:5px 7px;white-space:nowrap}
th{font-weight:700;background:#eee}
</style></head>
<body>
<h2>${escapeXls(title)}</h2>
<p>Экспортировано: ${escapeXls(generatedAt)} · Договоров: ${rows.length}</p>
<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
</body></html>`

  const date = new Date().toISOString().slice(0, 10)
  downloadXls(`baraka-contracts-${date}.xls`, html)
}
