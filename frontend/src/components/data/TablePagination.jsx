import './TablePagination.css'

export default function TablePagination({ currentPage, pageSize = 10, totalItems, onPageChange }) {
  const totalPages = Math.ceil(totalItems / pageSize)
  if (totalPages <= 1) return null

  const firstItem = (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <nav className='table-pagination' aria-label='Table pages'>
      <span className='table-pagination__summary'>
        Showing {firstItem}–{lastItem} of {totalItems}
      </span>
      <div className='table-pagination__controls'>
        <button
          type='button'
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label='Previous page'
        >
          Previous
        </button>
        <span className='table-pagination__page' aria-live='polite'>
          Page {currentPage} of {totalPages}
        </span>
        <button
          type='button'
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label='Next page'
        >
          Next
        </button>
      </div>
    </nav>
  )
}
