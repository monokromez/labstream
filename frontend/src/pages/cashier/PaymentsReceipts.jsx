import { useEffect, useMemo, useState } from 'react'
import TablePagination from '../../components/data/TablePagination.jsx'
import { testCategories } from '../../data/testCatalog.js'
import { formatDate } from '../../utils/dateFormat.js'
import {
  createReceiptNumber,
  getCashierTransactions,
  getLocalTransactionDate,
  subscribeToCashierTransactions,
  updateCashierTransaction,
} from '../../utils/cashierTransactions.js'
import './PaymentsReceipts.css'

const ROWS_PER_PAGE = 10
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function PaymentsReceipts() {
  const [transactions, setTransactions] = useState(getCashierTransactions)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [dialog, setDialog] = useState(null)

  useEffect(() => subscribeToCashierTransactions(() => setTransactions(getCashierTransactions())), [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return transactions.filter((transaction) => {
      const matchesQuery = !query || [transaction.pid, transaction.patientName, transaction.receiptNumber ?? '']
        .some((value) => value.toLowerCase().includes(query))
      const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [transactions, searchQuery, statusFilter])

  const visibleTransactions = filteredTransactions.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  )

  const processPayment = () => {
    if (dialog?.transaction.status !== 'pending') return
    const transaction = updateCashierTransaction(dialog.transaction.id, {
      status: 'paid',
      transactionDate: getLocalTransactionDate(),
      receiptNumber: createReceiptNumber(),
    })
    setDialog(transaction ? { type: 'receipt', transaction } : null)
  }

  const cancelTransaction = () => {
    if (dialog?.transaction.status !== 'pending') return
    updateCashierTransaction(dialog.transaction.id, { status: 'cancelled' })
    setDialog(null)
  }

  return (
    <section className='payments-receipts' aria-label='Payments and receipts'>
      <div className='payments-receipts__intro'>
        <p>Record in-person cash payments for registered test requests and issue their receipts.</p>
        <span className='payments-receipts__prototype-note'>Prototype data is stored in this browser only.</span>
      </div>

      <div className='payments-receipts__toolbar'>
        <label className='payments-receipts__search' htmlFor='payments-search'>
          <svg aria-hidden='true' viewBox='0 0 24 24' fill='none'>
            <circle cx='10.8' cy='10.8' r='6.3' stroke='currentColor' strokeWidth='1.8' />
            <path d='m15.4 15.4 4.1 4.1' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
          </svg>
          <input
            id='payments-search'
            type='search'
            placeholder='Search by PID, patient name, or receipt no.'
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <label className='payments-receipts__filter' htmlFor='payments-status-filter'>
          <span>Status</span>
          <select id='payments-status-filter' value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value='all'>All statuses</option>
            <option value='pending'>Pending</option>
            <option value='paid'>Paid</option>
            <option value='cancelled'>Cancelled</option>
          </select>
        </label>
      </div>

      <section className='payments-receipts__table-card' aria-labelledby='payments-table-title'>
        <div className='payments-receipts__table-heading'>
          <div>
            <h2 id='payments-table-title'>Payment Transactions</h2>
            <p>Pending requests can be processed after cash has been received.</p>
          </div>
          <span className='payments-receipts__count'>{filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}</span>
        </div>

        <div className='payments-receipts__table-wrap'>
          <table className='payments-receipts__table'>
            <thead>
              <tr>
                <th scope='col'>PID</th>
                <th scope='col'>Name</th>
                <th scope='col'>Fee</th>
                <th scope='col'>Payment Method</th>
                <th scope='col'>Status</th>
                <th scope='col'>Date</th>
                <th scope='col'>Actions</th>
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
                  <td>Cash</td>
                  <td><span className={`payments-receipts__status payments-receipts__status--${transaction.status}`}>{transaction.status}</span></td>
                  <td>{transaction.transactionDate ? formatDate(transaction.transactionDate) : '—'}</td>
                  <td>
                    {transaction.status === 'pending' && (
                      <div className='payments-receipts__actions'>
                        <button className='payments-receipts__action payments-receipts__action--cancel' type='button' onClick={() => setDialog({ type: 'cancel', transaction })}>Cancel</button>
                        <button className='payments-receipts__action payments-receipts__action--process' type='button' onClick={() => setDialog({ type: 'process', transaction })}>Process</button>
                      </div>
                    )}
                    {transaction.status === 'paid' && (
                      <button className='payments-receipts__action payments-receipts__action--receipt' type='button' onClick={() => setDialog({ type: 'receipt', transaction })}>View Receipt</button>
                    )}
                    {transaction.status === 'cancelled' && <span className='payments-receipts__cancelled-label'>No further action</span>}
                  </td>
                </tr>
              ))}
              {visibleTransactions.length === 0 && (
                <tr><td className='payments-receipts__empty' colSpan='7'>No transactions match your search or status filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={currentPage} pageSize={ROWS_PER_PAGE} totalItems={filteredTransactions.length} onPageChange={setCurrentPage} />
      </section>

      {dialog && (
        <div className='payments-receipts__backdrop' onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialog(null)
        }}>
          <section className={`payments-receipts__dialog${dialog.type === 'receipt' ? ' payments-receipts__dialog--receipt' : ''}`} role='dialog' aria-modal='true' aria-labelledby='payment-dialog-title'>
            <div className='payments-receipts__dialog-header'>
              <div>
                <h2 id='payment-dialog-title'>
                  {dialog.type === 'process' && 'Process Cash Payment'}
                  {dialog.type === 'cancel' && 'Cancel Test Request'}
                  {dialog.type === 'receipt' && 'Payment Receipt'}
                </h2>
                <p>{dialog.type === 'receipt' ? 'Payment recorded at the laboratory.' : `${dialog.transaction.pid} · ${dialog.transaction.patientName}`}</p>
              </div>
              <button className='payments-receipts__close' type='button' aria-label='Close dialog' onClick={() => setDialog(null)}>×</button>
            </div>

            {dialog.type === 'process' && (
              <div className='payments-receipts__dialog-content'>
                <p>Confirm that <strong>{currency.format(dialog.transaction.fee)}</strong> has been received in cash. Recording payment will mark this request as paid and issue a receipt.</p>
                <fieldset className='payments-receipts__test-selection'>
                  <legend>Tests in this request</legend>
                  <p>Selected tests are checked and cannot be changed while processing payment.</p>
                  <div className='payments-receipts__test-categories'>
                    {testCategories.map((category) => (
                      <section className='payments-receipts__test-category' key={category.name}>
                        <h3>{category.name}</h3>
                        <div className='payments-receipts__test-options'>
                          {category.tests.map((test) => {
                            const isSelected = dialog.transaction.tests.some((selectedTest) => selectedTest.id === test.id)
                            return (
                              <label className='payments-receipts__test-option' key={test.id}>
                                <input type='checkbox' checked={isSelected} disabled readOnly tabIndex='-1' />
                                <span>{test.name}</span>
                              </label>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {dialog.type === 'cancel' && (
              <div className='payments-receipts__dialog-content'>
                <p>Cancel this pending test request? The transaction will remain in the table with a Cancelled status.</p>
                <strong>{currency.format(dialog.transaction.fee)} · Cash</strong>
              </div>
            )}

            {dialog.type === 'receipt' && (
              <div className='payments-receipts__receipt' id='printable-payment-receipt'>
                <div className='payments-receipts__receipt-brand'>
                  <strong>Labstream</strong>
                  <span>Diagnostic Laboratory</span>
                </div>
                <div className='payments-receipts__receipt-line'><span>Receipt no.</span><strong>{dialog.transaction.receiptNumber}</strong></div>
                <div className='payments-receipts__receipt-line'><span>Date</span><strong>{formatDate(dialog.transaction.transactionDate)}</strong></div>
                <div className='payments-receipts__receipt-line'><span>Patient</span><strong>{dialog.transaction.patientName}</strong></div>
                <div className='payments-receipts__receipt-line'><span>PID</span><strong>{dialog.transaction.pid}</strong></div>
                <div className='payments-receipts__receipt-tests'>
                  <strong>Tests</strong>
                  {dialog.transaction.tests.map((test) => (
                    <div className='payments-receipts__receipt-line' key={test.id}><span>{test.name}</span><strong>{currency.format(test.price)}</strong></div>
                  ))}
                </div>
                <div className='payments-receipts__receipt-line payments-receipts__receipt-total'><span>Total paid · Cash</span><strong>{currency.format(dialog.transaction.fee)}</strong></div>
                <p>Keep this receipt. Use your PID and the instructions provided by the laboratory to access your results online after they are released.</p>
              </div>
            )}

            <div className='payments-receipts__dialog-footer'>
              {dialog.type === 'process' && <>
                <button className='payments-receipts__dialog-secondary' type='button' onClick={() => setDialog(null)}>Back</button>
                <button className='payments-receipts__dialog-primary' type='button' onClick={processPayment}>Confirm Payment</button>
              </>}
              {dialog.type === 'cancel' && <>
                <button className='payments-receipts__dialog-secondary' type='button' onClick={() => setDialog(null)}>Keep Request</button>
                <button className='payments-receipts__dialog-danger' type='button' onClick={cancelTransaction}>Cancel Request</button>
              </>}
              {dialog.type === 'receipt' && <>
                <button className='payments-receipts__dialog-secondary' type='button' onClick={() => setDialog(null)}>Close</button>
                <button className='payments-receipts__dialog-primary' type='button' onClick={() => window.print()}>Print Receipt</button>
              </>}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
