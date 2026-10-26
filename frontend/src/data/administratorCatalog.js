const STORAGE_KEY = 'labstream-admin-test-catalog'
const CHANGE_EVENT = 'labstream-admin-test-catalog-change'

export const defaultCatalog = {
  categories: [],
  tests: [],
}

export function readCatalog() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return saved?.categories && saved?.tests ? saved : defaultCatalog
  } catch {
    return defaultCatalog
  }
}

export function writeCatalog(catalog) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeCatalog(callback) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
