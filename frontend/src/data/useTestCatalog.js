import { useEffect, useMemo, useState } from 'react'
import { readCatalog, subscribeCatalog } from './administratorCatalog.js'

export default function useTestCatalog({ availableOnly = false } = {}) {
  const [catalog, setCatalog] = useState(readCatalog)

  useEffect(() => subscribeCatalog(() => setCatalog(readCatalog())), [])

  const categories = useMemo(() => catalog.categories
    .map((name) => ({
      name,
      tests: catalog.tests.filter((test) => test.category === name
        && (!availableOnly || test.availability === 'Available')),
    }))
    .filter((category) => category.tests.length > 0), [catalog, availableOnly])

  return { catalog, categories }
}
