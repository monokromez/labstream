import { Fragment, useEffect, useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { formatDateTime } from '../../utils/dateFormat.js'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import './CashierQueue.css'

const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function CashierQueue() {
  const { result, error, refresh } = useApiResource(() => api.cashier.queue({ page: 1, pageSize: 100 }), [])
  const { result: invoicesResult } = useApiResource(() => api.cashier.invoices({ page: 1, pageSize: 100 }), [])
  const transactions = (result?.data ?? []).map((item) => ({
    ...item,
    fee: Number(item.totalAmount ?? 0),
    registeredAt: item.requestedAt,
  }))
  const invoices = invoicesResult?.data ?? []
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [active, setActive] = useState(null)
  const [details, setDetails] = useState(null)
  const [notice, setNotice] = useState('')

  const pending = useMemo(() => transactions, [transactions])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return pending.filter((item) => `${item.requestNumber} ${item.pid} ${item.patientName} ${item.tests.map((test) => test.name).join(' ')}`.toLowerCase().includes(needle))
  }, [pending, query])
  const rows = filtered.slice((page - 1) * 10, page * 10)

  async function processPayment() {
    if (!active) return
    try {
      const response = await api.cashier.processPayment(active.id)
      setActive(null)
      setNotice(`${response.data.requestNumber} payment recorded. Invoice ${response.data.invoice.invoiceNumber} issued.`)
      await refresh()
      window.setTimeout(() => setNotice(''), 3500)
    } catch (requestError) {
      setNotice(requestError.message || 'Unable to process payment.')
    }
  }

  return (
    <section className="cashier-queue" aria-label="Requests awaiting payment">
      {error && <p className="cashier-queue__note" role="alert">{error}</p>}
      <div className="cashier-queue__summary">
        <SummaryCard title="Awaiting payment" value={String(result?.pagination?.total ?? pending.length).padStart(2, '0')} helperText="Requests ready for cashier processing" />
        <SummaryCard title="Value awaiting" value={currency.format(pending.reduce((sum, item) => sum + Number(item.fee || 0), 0))} helperText="Total amount due" />
        <SummaryCard title="Invoices issued" value={String(invoicesResult?.pagination?.total ?? invoices.length).padStart(2, '0')} helperText="Paid requests recorded for this clinic" />
      </div>
      {notice && <p className="cashier-queue__note" role="status">{notice}</p>}
      <div className="cashier-queue__toolbar">
        <SearchInput className="cashier-queue__search" label="Search payment queue" placeholder="Request, PID, patient, or test" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
      </div>
      <section className="cashier-queue__table-card" aria-labelledby="cashier-queue-title">
        <header className="cashier-queue__heading"><div><h2 id="cashier-queue-title">Payment Queue</h2><p>Confirm cash received to issue an invoice and assign the request to the laboratory.</p></div><span>{filtered.length} {filtered.length === 1 ? 'request' : 'requests'}</span></header>
        <div className="cashier-queue__table-scroll"><table className="cashier-queue__table"><thead><tr><th>Request</th><th>Patient</th><th>Tests</th><th>Amount due</th><th>Registered</th><th>Action</th></tr></thead><tbody>
          {rows.map((item) => <tr key={item.id}><td className="cashier-queue__primary">{item.requestNumber}</td><td><strong>{item.patientName}</strong><small>{item.pid}</small></td><td>{item.tests.map((test) => test.name).join(', ')}</td><td className="cashier-queue__primary">{currency.format(item.fee)}</td><td>{item.registeredAt ? formatDateTime(item.registeredAt) : '—'}</td><td><div className="cashier-queue__row-actions"><button className="cashier-queue__action" type="button" onClick={() => setDetails(item)}>Details</button><button className="cashier-queue__action cashier-queue__action--positive" type="button" onClick={() => setActive(item)}>Process</button></div></td></tr>)}
          {!rows.length && <tr><td colSpan="6" className="cashier-queue__empty">No unpaid requests match your search.</td></tr>}
        </tbody></table></div>
        <TablePagination currentPage={page} pageSize={10} totalItems={filtered.length} onPageChange={setPage} />
      </section>
      {details && <div className="cashier-queue__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null) }}><section className="cashier-queue__dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-queue-details-title">
        <h2 id="cashier-queue-details-title">Request details</h2><p>{details.requestNumber} · {details.patientName} · {details.pid}</p>
        <div className="cashier-queue__payment-details"><span>Requested tests</span><strong>{details.tests.map((test) => test.name).join(', ')}</strong>{details.tests.map((test) => <Fragment key={test.id}><span>{test.name}</span><strong>{currency.format(test.price)}</strong></Fragment>)}<span>Total due</span><strong>{currency.format(details.fee)}</strong></div>
        <footer><button type="button" onClick={() => setDetails(null)}>Close</button><button className="cashier-queue__action--positive" type="button" onClick={() => { setActive(details); setDetails(null) }}>Process payment</button></footer>
      </section></div>}
      {active && <div className="cashier-queue__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive(null) }}><section className="cashier-queue__dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-queue-confirm-title">
        <h2 id="cashier-queue-confirm-title">Confirm cash payment</h2><p>Confirm that cash was received for <strong>{active.requestNumber}</strong> from <strong>{active.patientName}</strong>.</p>
        <div className="cashier-queue__payment-details"><span>Tests</span><strong>{active.tests.map((test) => test.name).join(', ')}</strong><span>Total due · Cash</span><strong>{currency.format(active.fee)}</strong></div>
        <p>Confirming records the payment and creates an invoice. The connected workflow will assign a medical technologist to handle this request.</p>
        <footer><button type="button" onClick={() => setActive(null)}>Back</button><button className="cashier-queue__action--positive" type="button" onClick={processPayment}>Confirm payment</button></footer>
      </section></div>}
    </section>
  )
}
