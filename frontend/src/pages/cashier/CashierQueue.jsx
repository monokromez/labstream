import { Fragment, useMemo, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { describeEmailDelivery } from '../../utils/emailDelivery.js'
import './CashierQueue.css'

const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function CashierQueue() {
  const { result, error, refresh } = useApiResource(() => api.cashier.queue({ page: 1, pageSize: 100 }), [])
  const { result: invoicesResult } = useApiResource(() => api.cashier.invoices({ page: 1, pageSize: 100 }), [])
  const transactions = (result?.data ?? []).map((item) => ({
    ...item,
    queueNumber: `Q-${String(item.queueTicket).padStart(3, '0')}`,
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
    return pending.filter((item) => `${item.queueNumber} ${item.requestNumber} ${item.pid} ${item.patientName} ${item.tests.map((test) => test.name).join(' ')}`.toLowerCase().includes(needle))
  }, [pending, query])
  const rows = filtered.slice((page - 1) * 10, page * 10)

  const currentlyCalling = useMemo(() => pending.find((item) => item.queueCalledAt) || null, [pending])

  async function callPatient(item) {
    try {
      await api.cashier.callQueueItem(item.id)
      await refresh()
      setNotice(`Marked ${item.patientName} (${item.queueNumber}) as called to the cashier counter.`)
    } catch (requestError) { setNotice(requestError.message || 'Unable to call this patient.') }
  }

  async function callNextPatient() {
    try {
      await api.cashier.callNext()
      await refresh()
      setNotice('The next patient in queue has been marked as called to the cashier counter.')
    } catch (requestError) { setNotice(requestError.message || 'No waiting patient is available to call.') }
  }

  async function dismissCurrentCall() {
    try {
      await api.cashier.dismissCurrentCall()
      await refresh()
      setNotice('Current call dismissed.')
    } catch (requestError) { setNotice(requestError.message || 'Unable to dismiss the current call.') }
  }

  async function processPayment() {
    if (!active) return
    try {
      const response = await api.cashier.processPayment(active.id)
      setActive(null)
      const emailNotice = describeEmailDelivery(response.emailDelivery, {
        sent: 'Receipt email sent.',
        skipped: 'No patient email is on file; receipt email was skipped.',
        failed: 'Payment recorded, but the receipt email failed.',
      })
      setNotice(`${response.data.requestNumber} payment recorded. Invoice ${response.data.invoice.invoiceNumber} issued. ${emailNotice.text}`)
      await refresh()
      window.setTimeout(() => setNotice(''), emailNotice.tone === 'error' ? 10_000 : 3_500)
    } catch (requestError) {
      setNotice(requestError.message || 'Unable to process payment.')
    }
  }

  return (
    <section className="cashier-queue" aria-label="Requests awaiting payment">
      {error && <p className="cashier-queue__note" role="alert">{error}</p>}
      <div className="cashier-queue__summary">
        <SummaryCard title="Awaiting payment" value={String(result?.pagination?.total ?? pending.length).padStart(2, '0')} helperText="Patients in queue" />
        <SummaryCard title="Value awaiting" value={currency.format(pending.reduce((sum, item) => sum + Number(item.fee || 0), 0))} helperText="Total amount due" />
        <SummaryCard title="Invoices issued" value={String(invoicesResult?.pagination?.total ?? invoices.length).padStart(2, '0')} helperText="Paid requests recorded today" />
      </div>

      {currentlyCalling && (
        <div className="cashier-queue__calling-banner" role="region" aria-label="Now calling patient">
          <div className="cashier-queue__calling-info">
            <span className="cashier-queue__calling-badge">📢 NOW CALLING</span>
            <h3>Queue #{currentlyCalling.queueNumber} · {currentlyCalling.patientName}</h3>
            <p>PID: {currentlyCalling.pid} · Request: {currentlyCalling.requestNumber} · Due: {currency.format(currentlyCalling.fee)}</p>
          </div>
          <div className="cashier-queue__calling-actions">
            <button className="cashier-queue__action cashier-queue__action--positive" type="button" onClick={() => setActive(currentlyCalling)}>
              {currentlyCalling.fee === 0 ? 'Confirm Request' : 'Process Payment'}
            </button>
            <button className="cashier-queue__action" type="button" onClick={dismissCurrentCall}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {notice && <p className="cashier-queue__note" role="status">{notice}</p>}

      <div className="cashier-queue__toolbar">
        <SearchInput className="cashier-queue__search" label="Search payment queue" placeholder="Queue #, Request, PID, patient, or test" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
        {filtered.length > 0 && (
          <button className="cashier-queue__action cashier-queue__action--positive" type="button" onClick={callNextPatient}>
            📢 Call Next to Counter
          </button>
        )}
      </div>

      <section className="cashier-queue__table-card" aria-labelledby="cashier-queue-title">
        <header className="cashier-queue__heading"><div><h2 id="cashier-queue-title">Patient Queue</h2><p>Mark patients as called to the counter, then confirm cash received to assign requests to the laboratory. This does not place a phone call.</p></div><span>{filtered.length} {filtered.length === 1 ? 'patient' : 'patients'}</span></header>
        <div className="cashier-queue__table-scroll"><table className="cashier-queue__table"><thead><tr><th>Queue #</th><th>Request</th><th>Patient</th><th>Tests</th><th>Amount due</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {rows.map((item) => {
            const isServing = Boolean(item.queueCalledAt)
            return (
              <tr key={item.id} style={isServing ? { background: '#f0fdf4' } : undefined}>
                <td className="cashier-queue__primary"><strong>{item.queueNumber}</strong></td>
                <td>{item.requestNumber}</td>
                <td><strong>{item.patientName}</strong><small>{item.pid}</small></td>
                <td>{item.tests.map((test) => test.name).join(', ')}</td>
                <td className="cashier-queue__primary">{currency.format(item.fee)}</td>
                <td>
                  <span className={`cashier-queue__status cashier-queue__status--${isServing ? 'serving' : 'waiting'}`}>
                    {isServing ? 'Now Calling' : 'Waiting'}
                  </span>
                </td>
                <td>
                  <div className="cashier-queue__row-actions">
                    <button className="cashier-queue__action" type="button" onClick={() => callPatient(item)}>{isServing ? 'Called' : 'Call to Counter'}</button>
                    <button className="cashier-queue__action" type="button" onClick={() => setDetails(item)}>Details</button>
                    <button className="cashier-queue__action cashier-queue__action--positive" type="button" onClick={() => setActive(item)}>
                      {item.fee === 0 ? 'Confirm' : 'Process'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
          {!rows.length && <tr><td colSpan="7" className="cashier-queue__empty">No patients waiting in queue.</td></tr>}
        </tbody></table></div>
        <TablePagination currentPage={page} pageSize={10} totalItems={filtered.length} onPageChange={setPage} />
      </section>

      {details && <div className="cashier-queue__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null) }}><section className="cashier-queue__dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-queue-details-title">
        <h2 id="cashier-queue-details-title">Request details</h2><p>Queue #{details.queueNumber} · {details.requestNumber} · {details.patientName} · {details.pid}</p>
        <div className="cashier-queue__payment-details"><span>Requested tests</span><strong>{details.tests.map((test) => test.name).join(', ')}</strong>{details.tests.map((test) => <Fragment key={test.id}><span>{test.name}</span><strong>{currency.format(test.price)}</strong></Fragment>)}<span>Total due</span><strong>{currency.format(details.fee)}</strong></div>
        <footer><button type="button" onClick={() => setDetails(null)}>Close</button><button className="cashier-queue__action--positive" type="button" onClick={() => { setActive(details); setDetails(null) }}>{details.fee === 0 ? 'Confirm request' : 'Process payment'}</button></footer>
      </section></div>}

      {active && <div className="cashier-queue__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive(null) }}><section className="cashier-queue__dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-queue-confirm-title">
        <h2 id="cashier-queue-confirm-title">{active.fee === 0 ? 'Confirm zero-fee request' : 'Confirm cash payment'}</h2><p>Confirm {active.fee === 0 ? 'waiver / zero-fee request' : 'cash received'} for <strong>{active.requestNumber}</strong> from <strong>{active.patientName}</strong>.</p>
        <div className="cashier-queue__payment-details"><span>Tests</span><strong>{active.tests.map((test) => test.name).join(', ')}</strong><span>Total due · Cash</span><strong>{currency.format(active.fee)}</strong></div>
        <p>Confirming records the transaction and creates an invoice. A medical technologist will be assigned to process specimens and encode results.</p>
        <footer><button type="button" onClick={() => setActive(null)}>Back</button><button className="cashier-queue__action--positive" type="button" onClick={processPayment}>{active.fee === 0 ? 'Confirm request' : 'Confirm payment'}</button></footer>
      </section></div>}
    </section>
  )
}
