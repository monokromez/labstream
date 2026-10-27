import { useEffect, useState } from 'react'
import SearchInput from '../../components/data/SearchInput.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import { formatDate } from '../../utils/dateFormat.js'
import { describeEmailDelivery } from '../../utils/emailDelivery.js'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'
import './PaymentsReceipts.css'

const ROWS_PER_PAGE = 10
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function PaymentsReceipts() {
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [dialog, setDialog] = useState(null)
  const [emailStatus, setEmailStatus] = useState(null)
  const [emailSending, setEmailSending] = useState(false)
  const [actionReason, setActionReason] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const { result, loading, error, refresh } = useApiResource(() => api.cashier.invoices({ page: currentPage, pageSize: ROWS_PER_PAGE, q: searchQuery, period: dateFilter === 'all' ? '' : dateFilter, state: stateFilter }), [currentPage, searchQuery, dateFilter, stateFilter])
  const transactions = (result?.data ?? []).map((invoice) => ({
    id: invoice.id,
    pid: invoice.pid,
    patientName: invoice.patientName,
    receiptNumber: invoice.invoiceNumber,
    fee: Number(invoice.amount),
    paymentMethod: invoice.method,
    transactionDate: invoice.paidAt?.slice(0, 10),
    invoiceState: invoice.invoiceState,
    correctedAt: invoice.correctedAt,
    correctionReason: invoice.correctionReason,
    correctedInvoiceNumber: invoice.correctedInvoiceNumber,
    voidedAt: invoice.voidedAt,
    voidReason: invoice.voidReason,
    refundedAmount: Number(invoice.refundedAmount ?? 0),
    requestId: invoice.requestId,
    requestStatus: invoice.requestStatus,
    tests: (invoice.tests ?? []).map((test) => ({ ...test, price: Number(test.price) })),
    issuedAt: invoice.issuedAt,
  }))

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, dateFilter, stateFilter])

  function openReceipt(transaction) {
    setEmailStatus(null)
    setEmailSending(false)
    setActionReason('')
    setDialog({ type: 'receipt', transaction })
  }

  async function emailReceipt() {
    if (!dialog?.transaction || emailSending) return
    setEmailSending(true)
    setEmailStatus({ tone: 'info', text: 'Sending the receipt email…' })
    try {
      const response = await api.cashier.emailInvoiceReceipt(dialog.transaction.id)
      setEmailStatus(describeEmailDelivery(response.emailDelivery, {
        sent: `Receipt emailed to the patient${response.data?.invoiceNumber ? ` for ${response.data.invoiceNumber}` : ''}.`,
      }))
    } catch (requestError) {
      setEmailStatus({ tone: 'error', text: requestError.message || 'Unable to email this receipt.' })
    } finally {
      setEmailSending(false)
    }
  }

  async function correctInvoice() {
    if (!dialog?.transaction || !actionReason.trim() || actionBusy) return
    setActionBusy(true)
    try {
      const response = await api.cashier.correctInvoice(dialog.transaction.id, actionReason.trim())
      setEmailStatus({ tone: 'success', text: `Invoice ${response.data.originalInvoiceNumber} marked corrected. Replacement invoice ${response.data.replacement.invoiceNumber} issued.` })
      setActionReason('')
      setDialog((current) => ({ ...current, transaction: { ...current.transaction, invoiceState: 'corrected', correctedInvoiceNumber: response.data.replacement.invoiceNumber } }))
      await refresh()
    } catch (requestError) {
      setEmailStatus({ tone: 'error', text: requestError.message || 'Unable to correct this invoice.' })
    } finally {
      setActionBusy(false)
    }
  }

  async function cancelAndRefund() {
    if (!dialog?.transaction || !actionReason.trim() || actionBusy) return
    setActionBusy(true)
    try {
      const response = await api.cashier.cancelRequest(dialog.transaction.requestId, actionReason.trim())
      const amount = Number(response.data.refundAmount ?? 0)
      setEmailStatus({
        tone: 'success',
        text: amount > 0
          ? `Request cancelled and full refund of ${currency.format(amount)} recorded. Complete the cash/bank refund outside Labstream.`
          : 'Request cancelled and the zero-fee payment voided.',
      })
      setActionReason('')
      setDialog((current) => ({ ...current, transaction: { ...current.transaction, invoiceState: 'voided', voidedAt: new Date().toISOString(), refundedAmount: amount, requestStatus: 'cancelled' } }))
      await refresh()
    } catch (requestError) {
      setEmailStatus({ tone: 'error', text: requestError.message || 'Unable to cancel and refund this request.' })
    } finally {
      setActionBusy(false)
    }
  }

  const filteredTransactions = transactions
  const visibleTransactions = transactions

  return (
    <section className='payments-receipts' aria-label='Payments and invoice'>
      <div className='payments-receipts__intro'><p>Review payment history, including corrected and voided invoices. Historical invoices are retained for audit.</p></div>
      {error && <p role='alert'>{error}</p>}

      <div className='payments-receipts__toolbar'>
        <SearchInput
          className='payments-receipts__search'
          label='Search payment transactions'
          placeholder='Search by PID, patient name, or receipt no.'
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <label className='payments-receipts__filter' htmlFor='payments-date-filter'>
          <span>Date</span>
          <select id='payments-date-filter' value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
            <option value='all'>All dates</option>
            <option value='today'>Today</option>
            <option value='7days'>Last 7 days</option>
            <option value='month'>This month</option>
          </select>
        </label>
        <label className='payments-receipts__filter' htmlFor='payments-state-filter'>
          <span>Invoice status</span>
          <select id='payments-state-filter' value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value='all'>All statuses</option>
            <option value='issued'>Issued</option>
            <option value='corrected'>Corrected</option>
            <option value='voided'>Voided / refunded</option>
          </select>
        </label>
      </div>

      <section className='payments-receipts__table-card' aria-labelledby='payments-table-title'>
        <div className='payments-receipts__table-heading'>
          <div>
            <h2 id='payments-table-title'>Payments and Invoices</h2>
            <p>Completed payments and approved zero-fee waivers.</p>
          </div>
          <span className='payments-receipts__count'>{result?.pagination?.total ?? filteredTransactions.length} {result?.pagination?.total === 1 ? 'transaction' : 'transactions'}</span>
        </div>

        <div className='payments-receipts__table-wrap'>
          <table className='payments-receipts__table'>
            <thead>
              <tr>
                <th scope='col'>PID</th>
                <th scope='col'>Name</th>
                <th scope='col'>Fee</th>
                <th scope='col'>Date</th>
                <th scope='col'>Invoice</th>
                <th scope='col'>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className='payments-receipts__pid'>{transaction.pid}</td>
                  <td className='payments-receipts__name'>
                    <span>{transaction.patientName}</span>
                    <small>{transaction.tests.map((test) => test.name).join(', ')}</small>
                  </td>
                  <td className='payments-receipts__fee'>{currency.format(transaction.fee)}</td>
                  <td>{transaction.transactionDate ? formatDate(transaction.transactionDate) : '—'}</td>
                  <td>
                    <button className='payments-receipts__action payments-receipts__action--receipt' type='button' onClick={() => openReceipt(transaction)}>View Invoice</button>
                  </td>
                  <td>{transaction.invoiceState === 'voided' ? 'Voided / refunded' : transaction.invoiceState === 'corrected' ? `Corrected${transaction.correctedInvoiceNumber ? ` · ${transaction.correctedInvoiceNumber}` : ''}` : 'Issued'}</td>
                </tr>
              ))}
              {(loading || visibleTransactions.length === 0) && (
                <tr><td className='payments-receipts__empty' colSpan='6'>{loading ? 'Loading invoices…' : 'No invoices match your search or filters.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={currentPage} pageSize={ROWS_PER_PAGE} totalItems={result?.pagination?.total ?? filteredTransactions.length} onPageChange={setCurrentPage} />
      </section>

      {dialog && (
        <div className='payments-receipts__backdrop' onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialog(null)
        }}>
          <section className={`payments-receipts__dialog${dialog.type === 'receipt' ? ' payments-receipts__dialog--receipt' : ''}`} role='dialog' aria-modal='true' aria-labelledby='payment-dialog-title'>
            <div className='payments-receipts__dialog-header'>
              <div>
                <h2 id='payment-dialog-title'>
                  {'Payment Invoice'}
                </h2>
        <p>{dialog.transaction.pid} · {dialog.transaction.patientName}</p>
              </div>
              <button className='payments-receipts__close' type='button' aria-label='Close dialog' onClick={() => setDialog(null)}>×</button>
            </div>

            {dialog.type === 'receipt' && (
              <div className='payments-receipts__receipt' id='printable-payment-receipt'>
                <div className='payments-receipts__receipt-brand'>
                  <strong>Labstream</strong>
                  <span>Payment invoice · Diagnostic Laboratory</span>
                </div>
                <div className='payments-receipts__receipt-line'><span>Invoice no.</span><strong>{dialog.transaction.receiptNumber}</strong></div>
                <div className='payments-receipts__receipt-line'><span>Invoice status</span><strong>{dialog.transaction.invoiceState === 'voided' ? 'VOIDED / REFUNDED' : dialog.transaction.invoiceState === 'corrected' ? `CORRECTED${dialog.transaction.correctedInvoiceNumber ? ` · ${dialog.transaction.correctedInvoiceNumber}` : ''}` : 'ISSUED'}</strong></div>
                <div className='payments-receipts__receipt-line'><span>Date</span><strong>{formatDate(dialog.transaction.transactionDate)}</strong></div>
                <div className='payments-receipts__receipt-line'><span>Patient</span><strong>{dialog.transaction.patientName}</strong></div>
                <div className='payments-receipts__receipt-line'><span>PID</span><strong>{dialog.transaction.pid}</strong></div>
                <div className='payments-receipts__receipt-tests'>
                  <strong>Tests</strong>
                  {dialog.transaction.tests.map((test) => (
                    <div className='payments-receipts__receipt-line' key={test.id}><span>{test.name}</span><strong>{currency.format(test.price)}</strong></div>
                  ))}
                </div>
                <div className='payments-receipts__receipt-line payments-receipts__receipt-total'><span>{dialog.transaction.paymentMethod === 'waiver' ? 'Waived amount' : 'Total paid · Cash'}</span><strong>{currency.format(dialog.transaction.fee)}</strong></div>
                {dialog.transaction.refundedAmount > 0 && <div className='payments-receipts__receipt-line'><span>Refund recorded</span><strong>{currency.format(dialog.transaction.refundedAmount)}</strong></div>}
                {dialog.transaction.voidReason && <p>Void reason: {dialog.transaction.voidReason}</p>}
                {dialog.transaction.correctionReason && <p>Correction reason: {dialog.transaction.correctionReason}</p>}
                <p>Keep this receipt. Use your PID and the instructions provided by the laboratory to access your results online after they are released.</p>
              </div>
            )}

            {dialog.type === 'receipt' && emailStatus && (
              <p
                className={`payments-receipts__email-status payments-receipts__email-status--${emailStatus.tone}`}
                role={emailStatus.tone === 'error' ? 'alert' : 'status'}
              >
                {emailStatus.text}
              </p>
            )}

            {dialog.type === 'receipt' && dialog.transaction.invoiceState === 'issued' && !dialog.transaction.voidedAt && (
              <div className='payments-receipts__correction-actions'>
                {dialog.transaction.requestStatus === 'paid' && <p>Cancellation records the full refund in Labstream; it does not move cash or initiate a bank transfer.</p>}
                <label className='payments-receipts__reason'>Reason
                  <textarea maxLength={500} required value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder='Explain the invoice correction or request cancellation' />
                </label>
                <p className='payments-receipts__correction-note'>Reissue is for correcting an invoice document or clerical error. The replacement keeps the same request and paid amount; it does not change tests, charges, or move money.</p>
                <div className='payments-receipts__correction-buttons'>
                  <button className='payments-receipts__dialog-secondary' type='button' disabled={actionBusy || !actionReason.trim()} onClick={correctInvoice}>{actionBusy ? 'Saving…' : 'Reissue corrected invoice'}</button>
                  {dialog.transaction.requestStatus === 'paid' && <button className='payments-receipts__dialog-danger' type='button' disabled={actionBusy || !actionReason.trim()} onClick={cancelAndRefund}>{actionBusy ? 'Saving…' : 'Cancel request & record refund'}</button>}
                </div>
              </div>
            )}

            <div className='payments-receipts__dialog-footer'>
              {dialog.type === 'receipt' && <>
                <button className='payments-receipts__dialog-secondary' type='button' disabled={emailSending || dialog.transaction.invoiceState !== 'issued' || Boolean(dialog.transaction.voidedAt)} onClick={emailReceipt}>
                  {emailSending ? 'Sending…' : 'Email receipt'}
                </button>
                <button className='payments-receipts__dialog-secondary' type='button' onClick={() => setDialog(null)}>Close</button>
                <button className='payments-receipts__dialog-primary' type='button' onClick={() => window.print()}>Print Invoice</button>
              </>}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
