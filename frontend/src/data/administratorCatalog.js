const STORAGE_KEY = 'labstream-admin-test-catalog'
const CHANGE_EVENT = 'labstream-admin-test-catalog-change'

export const defaultCatalog = {
  categories: ['Hematology', 'Clinical Chemistry', 'Clinical Microscopy', 'Immunology', 'Microbiology'],
  tests: [
    { id: 1, name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 450, turnaround: 'Same day', availability: 'Available' },
    { id: 2, name: 'Fasting Blood Sugar', category: 'Clinical Chemistry', price: 250, turnaround: 'Same day', availability: 'Available' },
    { id: 3, name: 'Urinalysis', category: 'Clinical Microscopy', price: 300, turnaround: 'Same day', availability: 'Available' },
    { id: 4, name: 'Lipid Profile', category: 'Clinical Chemistry', price: 850, turnaround: '1 day', availability: 'Available' },
    { id: 5, name: 'Thyroid Stimulating Hormone', category: 'Immunology', price: 700, turnaround: '2 days', availability: 'Unavailable' },
  ],
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
