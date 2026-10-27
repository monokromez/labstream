import TablePagination from '../../components/data/TablePagination.jsx'
import useTablePagination from '../../components/data/useTablePagination.js'
import StructuredValueTable from '../../components/data/StructuredValueTable.jsx'

export default function PathologistResultTable({ results, title = 'Result values' }) {
  const { currentPage, pageSize, setCurrentPage, visibleItems } = useTablePagination(results)

  return (
    <div className="pathologist-dialog__results">
      <h3>{title}</h3>
      <div className="pathologist-table-scroll">
        <table className="admin-table pathologist-table--results">
          <thead>
            <tr><th scope="col">Specimen</th><th scope="col">Analyte</th><th scope="col">Result</th><th scope="col">Reference range</th><th scope="col">Review</th></tr>
          </thead>
          <tbody>
            {visibleItems.map((result) => (
              <tr key={`${result.specimenType ?? 'specimen'}-${result.specimenAttempt ?? 1}-${result.name}`}>
                <td>{result.specimenType ? `${result.specimenType}${result.specimenAttempt > 1 ? ` · Attempt ${result.specimenAttempt}` : ''}` : '—'}</td>
                <td>{result.name}</td>
                <td className="pathologist-result-value">{Array.isArray(result.structuredValue) ? <StructuredValueTable rows={result.structuredValue} /> : result.value}</td>
                <td>{result.range}</td>
                <td>{result.flag
                  ? <span className="admin-badge admin-badge--warning">{result.flag}</span>
                  : result.range && result.range !== '—'
                    ? <span className="admin-badge admin-badge--success">Within range</span>
                    : <span className="admin-badge admin-badge--muted">No reference range</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination currentPage={currentPage} pageSize={pageSize} totalItems={results.length} onPageChange={setCurrentPage} />
    </div>
  )
}
