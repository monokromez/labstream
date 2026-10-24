function camelKey(key) {
  return key.replace(/_([a-z0-9])/g, (_match, character) => character.toUpperCase())
}

export function toApiShape(value) {
  if (Array.isArray(value)) return value.map(toApiShape)
  if (!value || typeof value !== 'object' || value instanceof Date) return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [camelKey(key), toApiShape(entry)]))
}
