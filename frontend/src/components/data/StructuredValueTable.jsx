import './StructuredValueTable.css'

export default function StructuredValueTable({ rows = [] }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row ?? {})))]
  if (!rows.length || !columns.length) return '—'
  return <div className="structured-value-table-wrap"><table className="structured-value-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{row?.[column] || '—'}</td>)}</tr>)}</tbody></table></div>
}
