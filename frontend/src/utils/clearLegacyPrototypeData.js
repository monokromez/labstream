const CLEANUP_KEY = 'labstream:prototype-data-cleanup:v1'
const LEGACY_SAMPLE_KEYS = [
  'labstream-admin-test-catalog',
  'labstream.cashier.transactions.v1',
]

export function clearLegacyPrototypeData() {
  if (typeof window === 'undefined') return

  try {
    const storage = window.localStorage
    if (storage.getItem(CLEANUP_KEY)) return
    LEGACY_SAMPLE_KEYS.forEach((key) => storage.removeItem(key))
    storage.setItem(CLEANUP_KEY, 'complete')
  } catch {
    // Storage can be unavailable in private browsing; pages still start empty.
  }
}
