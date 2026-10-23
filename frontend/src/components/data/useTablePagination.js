import { useState } from 'react'

export const TABLE_PAGE_SIZE = 10

export default function useTablePagination(items, pageSize = TABLE_PAGE_SIZE) {
  const [requestedPage, setRequestedPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(requestedPage, totalPages)
  const visibleItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return { currentPage, pageSize, setCurrentPage: setRequestedPage, visibleItems }
}
