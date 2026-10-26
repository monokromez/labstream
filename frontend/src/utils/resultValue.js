export function resultValueForDisplay(value) {
  if (Array.isArray(value?.structuredValue)) {
    return value.structuredValue.map((row) => Object.entries(row).map(([key, cell]) => `${key}: ${cell}`).join(' · ')).join(' | ') || '—'
  }
  const scalar = [value?.numericValue, value?.textValue, value?.selectValue, value?.booleanValue].find((entry) => entry != null)
  if (typeof scalar === 'boolean') return scalar ? 'Yes' : 'No'
  return scalar ?? '—'
}
