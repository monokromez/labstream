import { useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import { describeEmailDelivery } from '../../utils/emailDelivery.js'
import './CashierQueue.css'

const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function CashierQueue() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [active, setActive] = useState(null)
  const [notice, setNotice] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const { result, error, refresh } = useApiResource(() => api.cashier.queue({ page, pageSize: 10, q: query }), [page, query])
  const { result: invoicesResult } = useApiResource(() => api.cashier.invoices({ page: 1, pageSize: 1 }), [])
  const transactions = (result?.data ?? []).map((item) => ({
    ...item,
    queueNumber: `Q-${String(item.queueTicket).padStart(3, '0')}`,
    fee: Number(item.totalAmount ?? 0),
    registeredAt: item.requestedAt,
  }))
  const invoices = invoicesResult?.data ?? []
  const rows = transactions

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

  async function cancelRequest() {
    if (!cancelTarget || !cancelReason.trim()) return
    try {
      await api.cashier.cancelRequest(cancelTarget.id, cancelReason.trim())
      setNotice(`${cancelTarget.requestNumber} cancelled.`)
      setCancelTarget(null)
      setCancelReason('')
      await refresh()
    } catch (requestError) {
      setNotice(requestError.message || 'Unable to cancel this request.')
    }
  }

  return (
    <section className="cashier-queue" aria-label="Requests awaiting payment">
      {error && <p className="cashier-queue__note" role="alert">{error}</p>}
      <div className="cashier-queue__summary">
        <SummaryCard title="Awaiting payment" value={String(result?.summary?.total ?? 0).padStart(2, '0')} helperText="Patients in queue" />
        <SummaryCard title="Value awaiting" value={currency.format(Number(result?.summary?.amountDue ?? 0))} helperText="Total amount due" />
        <SummaryCard title="Invoices issued" value={String(invoicesResult?.pagination?.total ?? invoices.length).padStart(2, '0')} helperText="Paid requests recorded today" />
      </div>

      {notice && <p className="cashier-queue__note" role="status">{notice}</p>}

      <div className="cashier-queue__toolbar">
        <SearchInput className="cashier-queue__search" label="Search payment queue" placeholder="Queue #, Request, PID, patient, or test" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
      </div>

      <section className="cashier-queue__table-card" aria-labelledby="cashier-queue-title">
        <header className="cashier-queue__heading"><div><h2 id="cashier-queue-title">Patient Queue</h2><p>Review patients awaiting payment, then confirm cash received to assign requests to the laboratory.</p></div><span>{result?.pagination?.total ?? 0} {result?.pagination?.total === 1 ? 'patient' : 'patients'}</span></header>
        <div className="cashier-queue__table-scroll"><table className="cashier-queue__table"><thead><tr><th>Queue #</th><th>Request</th><th>Patient</th><th>Tests</th><th>Amount due</th><th>Action</th></tr></thead><tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td className="cashier-queue__primary"><strong>{item.queueNumber}</strong></td>
              <td>{item.requestNumber}</td>
              <td><strong>{item.patientName}</strong><small>{item.pid}</small></td>
              <td>{item.tests.map((test) => test.name).join(', ')}</td>
              <td className="cashier-queue__primary">{currency.format(item.fee)}</td>
              <td>
                <div className="cashier-queue__row-actions">
                  <button className="cashier-queue__action" type="button" onClick={() => { setCancelTarget(item); setCancelReason('') }}>Cancel</button>
                  <button className="cashier-queue__action cashier-queue__action--positive" type="button" onClick={() => setActive(item)}>
                    {item.fee === 0 ? 'Confirm' : 'Process'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="6" className="cashier-queue__empty">No patients waiting in queue.</td></tr>}
        </tbody></table></div>
        <TablePagination currentPage={result?.pagination?.page ?? page} pageSize={10} totalItems={result?.pagination?.total ?? 0} onPageChange={setPage} />
      </section>

      {active && <div className="cashier-queue__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive(null) }}><section className="cashier-queue__dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-queue-confirm-title">
        <h2 id="cashier-queue-confirm-title">{active.fee === 0 ? 'Confirm zero-fee request' : 'Confirm cash payment'}</h2><p>Confirm {active.fee === 0 ? 'waiver / zero-fee request' : 'cash received'} for <strong>{active.requestNumber}</strong> from <strong>{active.patientName}</strong>.</p>
        <div className="cashier-queue__payment-details"><span>Tests</span><strong>{active.tests.map((test) => test.name).join(', ')}</strong><span>Total due · Cash</span><strong>{currency.format(active.fee)}</strong></div>
        <p>Confirming records the transaction and creates an invoice. A medical technologist will be assigned to process specimens and encode results.</p>
        <footer><button type="button" onClick={() => setActive(null)}>Back</button><button className="cashier-queue__action--positive" type="button" onClick={processPayment}>{active.fee === 0 ? 'Confirm request' : 'Confirm payment'}</button></footer>
      </section></div>}
      {cancelTarget && <div className="cashier-queue__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCancelTarget(null) }}><section className="cashier-queue__dialog" role="dialog" aria-modal="true" aria-labelledby="cashier-queue-cancel-title">
        <h2 id="cashier-queue-cancel-title">Cancel unpaid request?</h2><p>Cancel <strong>{cancelTarget.requestNumber}</strong> for <strong>{cancelTarget.patientName}</strong>? This request has not been paid.</p>
        <label className="admin-dialog__field">Cancellation reason<textarea value={cancelReason} maxLength={500} required onChange={(event) => setCancelReason(event.target.value)} /></label>
        <footer><button type="button" onClick={() => setCancelTarget(null)}>Back</button><button className="admin-button--negative" type="button" disabled={!cancelReason.trim()} onClick={cancelRequest}>Confirm cancellation</button></footer>
      </section></div>}
    </section>
  )
}
