import { useEffect, useState } from 'react'
import { apiRequest } from '../../lib/api.js'

const EMPTY_SUMMARY = {
  pendingCount: 0,
  returnedCount: 0,
  releasedTodayCount: 0,
  reviewedTodayCount: 0,
}

export function usePathologistWorklist(view, search, page, refreshKey = 0) {
  const requestKey = `${view}:${search}:${page}:${refreshKey}`
  const [data, setData] = useState({ key: '', items: [], total: 0, error: '' })

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ view, search, page: String(page), pageSize: '10' })
    apiRequest(`/api/pathologist/worklist?${query}`, { signal: controller.signal })
      .then((result) => setData({ key: requestKey, items: result.items, total: result.total, error: '' }))
      .catch((error) => {
        if (error.name !== 'AbortError') setData({ key: requestKey, items: [], total: 0, error: error.message })
      })
    return () => controller.abort()
  }, [view, search, page, refreshKey, requestKey])

  const isCurrentRequest = data.key === requestKey
  return {
    items: isCurrentRequest ? data.items : [],
    total: isCurrentRequest ? data.total : 0,
    loading: !isCurrentRequest,
    error: isCurrentRequest ? data.error : '',
  }
}

export function usePathologistSummary(refreshKey = 0) {
  const [data, setData] = useState({ summary: EMPTY_SUMMARY, error: '' })

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/api/pathologist/summary', { signal: controller.signal })
      .then((result) => setData({ summary: result.summary, error: '' }))
      .catch((error) => {
        if (error.name !== 'AbortError') setData({ summary: EMPTY_SUMMARY, error: error.message })
      })
    return () => controller.abort()
  }, [refreshKey])

  return data
}

export function formatPathologistDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function getResultValue(result) {
  if (result.value == null || result.value === '') return '—'
  return [result.value, result.unit].filter(Boolean).join(' ')
}

export function getReferenceRange(result) {
  if (result.referenceMin != null || result.referenceMax != null) {
    const low = result.referenceMin ?? '—'
    const high = result.referenceMax ?? '—'
    return `${low}–${high}${result.unit ? ` ${result.unit}` : ''}`
  }
  return result.referenceText || 'Not configured'
}
