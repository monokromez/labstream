import { Fragment, useEffect, useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { formatDateTime } from '../../utils/dateFormat.js'
import { getCashierTransactions, subscribeToCashierTransactions, updateCashierTransaction, createReceiptNumber, getLocalTransactionDate } from '../../utils/cashierTransactions.js'
import './CashierQueue.css'

const technicians = ['M. Dizon, RMT', 'L. Navarro, RMT', 'A. Flores, RMT']
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function CashierQueue() {
  const [transactions, setTransactions] = useState(getCashierTransactions)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [active, setActive] = useState(null)
  const [details, setDetails] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => subscribeToCashierTransactions(() => setTransactions(getCashierTransactions())), [])

  const pending = useMemo(() => transactions.filter((item) => item.status === 'pending'), [transactions])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return pending.filter((item) => `${item.id} ${item.pid} ${item.patientName} ${item.tests.map((test) => test.name).join(' ')}`.toLowerCase().includes(needle))
  }, [pending, query])
  const rows = filtered.slice((page - 1) * 10, page * 10)

  function processPayment() {
    if (!active) return
    const tech = technicians[transactions.filter((item) => item.status === 'paid').length % technicians.length]
    updateCashierTransaction(active.id, {
      status: 'paid', paymentMethod: 'cash', transactionDate: getLocalTransactionDate(),
      receiptNumber: createReceiptNumber(), assignedTechnologist: tech,
    })
    setActive(null)
    setNotice(`${active.id} paid and assigned to ${tech}.`)
    window.setTimeout(() => setNotice(''), 3500)
  }

  return (
    <section className="cashier-queue" aria-label="Requests awaiting payment">
      <div className="cashier-queue__summary">
        <SummaryCard title="Awaiting payment" value={String(pending.length).padStart(2, '0')} helperText="Requests ready for cashier processing" />
        <SummaryCard title="Value awaiting" value={currency.format(pending.reduce((sum, item) => sum + Number(item.fee || 0), 0))} helperText="Total amount due" />
        <SummaryCard title="Paid today" value={String(transactions.filter((item) => item.status === 'paid' && item.transactionDate === getLocalTransactionDate()).length).padStart(2, '0')} helperText="Processed and sent to the laboratory" />
      </div>
      {notice && <p className="cashier-queue__note" role="status">{notice}</p>}
      <div className="cashier-queue__toolbar">
        <SearchInput className="cashier-queue__search" label="Search payment queue" placeholder="Request, PID, patient, or test" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
      </div>
      <section className="cashier-queue__table-card" aria-labelledby="cashier-queue-title">
        <header className="cashier-queue__heading"><div><h2 id="cashier-queue-title">Payment Queue</h2><p>Confirm cash received to issue an invoice and assign the request to the laboratory.</p></div><span>{filtered.length} {filtered.length === 1 ? 'request' : 'requests'}</span></header>
        <div className="cashier-queue__table-scroll"><table className="cashier-queue__table"><thead><tr><th>Request</th><th>Patient</th><th>Tests</th><th>Amount due</th><th>Registered</th><th>Action</th></tr></thead><tbody>
          {rows.map((item) => <tr key={item.id}><td className="cashier-queue__primary">{item.id}</td><td><strong>{item.patientName}</strong><small>{item.pid}</small></td><td>{item.tests.map((test) => test.name).join(', ')}</td><td className="cashier-queue__primary">{currency.format(item.fee)}</td><td>{item.requestedAt ? formatDateTime(item.requestedAt) : '—'}</td><td><div className="cashier-queue__row-actions"><button className="cashier-queue__action" type="button" onClick={() => setDetails(item)}>Details</button><button className="cashier-queue__action cashier-queue__action--positive" type="button" onClick={() => setActive(item)}>Process</button></div></td></tr>)}
          {!rows.length && <tr><td colSpan="6" className="cashier-queue__empty">No unpaid requests match your search.</td></tr>}
        </tbody></table></div>
        <TablePagination currentPage={page} pageSize={10} totalItems={filtered.length} onPageChange={setPage} />
      </section>
      {details && <div className="cashier-queue__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null) }}><section className="cashier-queue__dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-queue-details-title">
        <h2 id="cashier-queue-details-title">Request details</h2><p>{details.id} · {details.patientName} · {details.pid}</p>
        <div className="cashier-queue__payment-details"><span>Requested tests</span><strong>{details.tests.map((test) => test.name).join(', ')}</strong>{details.tests.map((test) => <Fragment key={test.id}><span>{test.name}</span><strong>{currency.format(test.price)}</strong></Fragment>)}<span>Total due</span><strong>{currency.format(details.fee)}</strong></div>
        <footer><button type="button" onClick={() => setDetails(null)}>Close</button><button className="cashier-queue__action--positive" type="button" onClick={() => { setActive(details); setDetails(null) }}>Process payment</button></footer>
      </section></div>}
      {active && <div className="cashier-queue__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive(null) }}><section className="cashier-queue__dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-queue-confirm-title">
        <h2 id="cashier-queue-confirm-title">Confirm cash payment</h2><p>Confirm that cash was received for <strong>{active.id}</strong> from <strong>{active.patientName}</strong>.</p>
        <div className="cashier-queue__payment-details"><span>Tests</span><strong>{active.tests.map((test) => test.name).join(', ')}</strong><span>Total due · Cash</span><strong>{currency.format(active.fee)}</strong></div>
        <p>Confirming records the payment, creates the invoice, and assigns one medical technologist to handle this request.</p>
        <footer><button type="button" onClick={() => setActive(null)}>Back</button><button className="cashier-queue__action--positive" type="button" onClick={processPayment}>Confirm payment</button></footer>
      </section></div>}
      <p className="cashier-queue__note">Prototype requests and payment changes are stored in this browser until the backend is connected.</p>
    </section>
  )
}
