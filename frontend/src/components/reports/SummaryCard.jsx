import './SummaryCard.css'

export default function SummaryCard({ title, value, helperText }) {
  return (
    <article className="summary-card">
      <h2 className="summary-card__title">{title}</h2>
      <p className="summary-card__value">{value}</p>

      {helperText && (
        <p className="summary-card__helper">{helperText}</p>
      )}
    </article>
  )
}