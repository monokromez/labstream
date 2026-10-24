import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, subscribeToCatalogChanges } from '../api/client.js'

const emptyCatalog = { categories: [], tests: [] }

export default function useTestCatalog({ availableOnly = false } = {}) {
  const [catalog, setCatalog] = useState(emptyCatalog)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const result = await api.catalog.list({ includeUnavailable: !availableOnly })
      const data = result.data ?? { categories: [], tests: [] }
      setCatalog({
        categories: data.categories ?? [],
        tests: (data.tests ?? []).map((test) => ({
          ...test,
          category: test.categoryName,
          categoryIds: (test.categories ?? []).map((category) => category.id),
          categoryNames: (test.categories ?? []).map((category) => category.name),
          availability: test.isAvailable ? 'Available' : 'Unavailable',
        })),
      })
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the test catalog.')
    } finally {
      setLoading(false)
    }
  }, [availableOnly])

  useEffect(() => {
    refresh()
    const unsubscribe = subscribeToCatalogChanges(refresh)
    return unsubscribe
  }, [refresh])

  const categories = useMemo(() => catalog.categories
    .map((category) => ({
      ...category,
      tests: catalog.tests.filter((test) => (test.categoryIds?.length ? test.categoryIds.includes(category.id) : test.categoryId === category.id)
        && (!availableOnly || test.isAvailable)),
    }))
    .filter((category) => category.tests.length > 0), [catalog, availableOnly])

  return { catalog, categories, loading, error, refresh }
}
