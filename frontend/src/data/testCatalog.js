import { readCatalog } from './administratorCatalog.js'

// Read the administrator-maintained catalog at call time so workflow code never
// falls back to a separate, stale list of tests.
export function getTestCategories({ availableOnly = false } = {}) {
  const catalog = readCatalog()
  return catalog.categories
    .map((name) => ({
      name,
      tests: catalog.tests.filter((test) => test.category === name
        && (!availableOnly || test.availability === 'Available')),
    }))
    .filter((category) => category.tests.length > 0)
}

export function getTestCatalog({ availableOnly = false } = {}) {
  return getTestCategories({ availableOnly }).flatMap((category) =>
    category.tests.map((test) => ({ ...test, category: category.name })),
  )
}
