import './CashierDashboard.css'
import SummaryCard from '../../components/reports/SummaryCard.jsx'

const summary = [
  { label: 'Requests Today', value: '24' },
  { label: 'Payments Collected', value: '₱12,450' },
  { label: 'Unpaid Requests', value: '5' },
  { label: 'Awaiting Next Step', value: '8' },
]

const recentRequests = [
  {
    number: 'REQ-2026-0012',
    patient: 'Maria Santos',
    tests: 'CBC, Fasting Blood Sugar',
    amount: '₱850',
    payment: 'Paid',
    status: 'For specimen collection',
  },
  {
    number: 'REQ-2026-0011',
    patient: 'Juan Reyes',
    tests: 'Urinalysis',
    amount: '₱300',
    payment: 'Unpaid',
    status: 'Awaiting payment',
  },
]

export default function CashierDashboard() {
  return (
    <section className="cashier-dashboard" aria-label="Cashier dashboard">
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
        <h2>Recent Requests</h2>

        <div className="cashier-dashboard__table-wrap">
          <table className="cashier-dashboard__table">
            <thead>
              <tr>
                <th scope="col">Request No.</th>
                <th scope="col">Patient</th>
                <th scope="col">Tests</th>
                <th scope="col">Amount</th>
                <th scope="col">Payment</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((request) => (
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
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
