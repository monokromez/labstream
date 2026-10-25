import { isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js/min'

export const STAFF_NAME_MIN = 2
export const STAFF_NAME_MAX = 50

const NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const localDateValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function getStaffFieldError(field, value, context = {}) {
  const text = String(value ?? '')
  const trimmed = text.trim()

  if (field === 'firstName' || field === 'middleName' || field === 'surname') {
    const label = field === 'surname' ? 'Surname' : field === 'firstName' ? 'First name' : 'Middle name'
    if (!trimmed && field === 'middleName') return ''
    if (!trimmed) return `${label} is required.`
    if (text !== trimmed) return `${label} cannot start or end with spaces.`
    if (text.length < STAFF_NAME_MIN) return `${label} must be at least ${STAFF_NAME_MIN} characters.`
    if (text.length > STAFF_NAME_MAX) return `${label} cannot exceed ${STAFF_NAME_MAX} characters.`
    if (!NAME_PATTERN.test(text)) return `${label} can contain letters and single spaces only.`
    return ''
  }

  if (field === 'dob') {
    if (!trimmed) return 'Date of birth is required.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'Enter a valid date of birth.'
    const date = new Date(`${trimmed}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) return 'Enter a valid date of birth.'
    const today = localDateValue(new Date())
    const earliest = new Date(`${today}T00:00:00.000Z`)
    earliest.setUTCFullYear(earliest.getUTCFullYear() - 120)
    if (trimmed > today) return 'Date of birth cannot be in the future.'
    if (trimmed < earliest.toISOString().slice(0, 10)) return 'Date of birth must be within the last 120 years.'
    return ''
  }

  if (field === 'country') {
    if (!trimmed) return 'Select a country.'
    return ''
  }

  if (field === 'city') {
    if (!trimmed) return 'Select a city.'
    if (trimmed.length < 2 || trimmed.length > 100) return 'City must be between 2 and 100 characters.'
    return ''
  }

  if (field === 'houseNo') {
    if (!trimmed) return 'House number is required.'
    if (trimmed.length > 30) return 'House number cannot exceed 30 characters.'
    return ''
  }

  if (field === 'street') {
    if (!trimmed) return 'Street is required.'
    if (trimmed.length < 2 || trimmed.length > 100) return 'Street must be between 2 and 100 characters.'
    return ''
  }

  if (field === 'contact') {
    if (!trimmed) return 'Contact number is required.'
    if (!context.countryCode) return 'Select a country before entering a contact number.'
    if (!isSupportedCountry(context.countryCode)) return 'Phone validation is unavailable for the selected country.'
    const phone = parsePhoneNumberFromString(trimmed, context.countryCode)
    if (!phone?.isValid() || phone.country !== context.countryCode) {
      return `Enter a valid phone number for ${context.countryName || 'the selected country'}.`
    }
    return ''
  }

  if (field === 'email') {
    if (!trimmed) return 'Email address is required.'
    if (trimmed.length > 254) return 'Email address cannot exceed 254 characters.'
    if (trimmed.length < 6 || !EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.'
    return ''
  }

  if (field === 'post') {
    if (!trimmed) return 'Select a post.'
    return ''
  }

  return ''
}

export function getStaffFormErrors(values, context = {}) {
  const fields = ['firstName', 'middleName', 'surname', 'dob', 'country', 'city', 'houseNo', 'street', 'contact', 'email', 'post']
  return Object.fromEntries(fields.map((field) => [field, getStaffFieldError(field, values[field], context)]))
}
