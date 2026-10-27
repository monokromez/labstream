import { useState } from 'react'
import './CashierDashboard.css'
import SummaryCard from '../../components/reports/SummaryCard.jsx'
import TablePagination from '../../components/data/TablePagination.jsx'
import SearchInput from '../../components/data/SearchInput.jsx'
import { api } from '../../api/client.js'
import useApiResource from '../../api/useApiResource.js'

const ROWS_PER_PAGE = 10

export default function CashierDashboard() {
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState('')
  const { result, loading, error } = useApiResource(
    () => api.cashier.dashboard({ page: currentPage, pageSize: ROWS_PER_PAGE, q: search }),
    [currentPage, search],
  )
  const report = result?.data
  const summaryData = report?.summary ?? {}
  const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
  const summary = [
    { label: 'REQUESTS TODAY', value: String(summaryData.requestsToday ?? 0) },
    { label: 'PAYMENTS COLLECTED', value: currency.format(Number(summaryData.paymentsToday ?? 0)) },
    { label: 'UNPAID REQUESTS', value: String(summaryData.unpaidRequests ?? 0) },
    { label: 'AWAITING NEXT STEP', value: String(summaryData.awaitingNextStep ?? 0) },
  ]
  const recentRequests = (report?.recent ?? []).map((request) => ({
    number: request.requestNumber,
    patient: request.patientName,
    tests: (request.tests ?? []).join(', '),
    amount: currency.format(Number(request.totalAmount ?? 0)),
    payment: request.isPaid ? 'Paid' : 'Unpaid',
    status: request.status === 'paid'
      ? 'Awaiting specimens'
      : request.status.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    requestedAt: request.requestedAt,
  }))
  const visibleRequests = recentRequests

  return (
    <section className="cashier-dashboard" aria-label="Cashier dashboard">
      {error && <p role="alert">{error}</p>}
      <div className="cashier-dashboard__summary">
        {summary.map((item) => (
          <SummaryCard
            key={item.label}
            title={item.label}
            value={item.value}
          />
        ))}
      </div>

      <section className="cashier-dashboard__recent">
        <header className="cashier-dashboard__table-heading"><div><h2>Recent Requests</h2><p>Payment shows whether money was recorded; workflow shows the request’s laboratory progress.</p></div><span>{result?.pagination?.total ?? 0} entries</span></header>
        <SearchInput className="cashier-dashboard__search" label="Search requests" placeholder="Request, patient, PID, or test" value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }} />

        <div className="cashier-dashboard__table-wrap">
          <table className="cashier-dashboard__table">
            <thead>
              <tr>
                <th scope="col">Request No.</th>
                <th scope="col">Patient</th>
                <th scope="col">Tests</th>
                <th scope="col">Amount</th>
                <th scope="col">Payment status</th>
                <th scope="col">Workflow status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr key={request.number}>
                  <td>{request.number}</td>
                  <td>{request.patient}</td>
                  <td>{request.tests}</td>
                  <td>{request.amount}</td>
                  <td>
                    <span
                      className={`cashier-dashboard__payment-status cashier-dashboard__payment-status--${request.payment.toLowerCase()}`}
                    >
                      {request.payment}
                    </span>
                  </td>
                  <td>
                    <span className="cashier-dashboard__workflow-status">
                      {request.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(loading || visibleRequests.length === 0) && <tr><td colSpan="6" className="cashier-dashboard__empty">{loading ? 'Loading requests…' : 'No requests have been registered.'}</td></tr>}
            </tbody>
          </table>
          <TablePagination
            currentPage={result?.pagination?.page ?? currentPage}
            pageSize={ROWS_PER_PAGE}
            totalItems={result?.pagination?.total ?? 0}
            onPageChange={setCurrentPage}
          />
        </div>
      </section>
    </section>
  )
}
