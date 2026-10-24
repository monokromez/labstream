const API_BASE = 'https://countries.dev'
let countriesRequest
const cityRequests = new Map()

async function readJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Geography API returned ${response.status}`)
  return response.json()
}

export function getCountries() {
  if (!countriesRequest) {
    countriesRequest = readJson(`${API_BASE}/countries?fields=name,alpha2Code&sort=name&order=asc`)
      .then((payload) => {
        const items = Array.isArray(payload) ? payload : payload?.data
        if (!Array.isArray(items)) throw new Error('Unexpected country list response')
        return items
          .filter((item) => item?.name && item?.alpha2Code)
          .map((item) => ({ name: item.name, alpha2Code: item.alpha2Code }))
          .sort((first, second) => first.name.localeCompare(second.name))
      })
      .catch((error) => { countriesRequest = undefined; throw error })
  }
  return countriesRequest
}

export function getCitiesForCountry(countryCode, search = '') {
  if (!countryCode) return Promise.resolve([])
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const cacheKey = `${countryCode}:${normalizedSearch}`
  if (!cityRequests.has(cacheKey)) {
    const query = new URLSearchParams({ country: countryCode, limit: '100' })
    if (normalizedSearch) query.set('q', search.trim())
    cityRequests.set(cacheKey, readJson(`${API_BASE}/cities?${query}`)
      .then((payload) => {
        const items = Array.isArray(payload) ? payload : payload?.data
        if (!Array.isArray(items)) throw new Error('Unexpected city list response')
        return items.filter((item) => item?.name).sort((first, second) => first.name.localeCompare(second.name))
      })
      .catch((error) => { cityRequests.delete(cacheKey); throw error }))
  }
  return cityRequests.get(cacheKey)
}
