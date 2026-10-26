import { AsYouType, getCountryCallingCode, isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js/min'

export const PATIENT_NAME_MIN = 2
export const PATIENT_NAME_MAX = 50
export const PATIENT_AGE_LIMIT = 120

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u
const ID_NUMBER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} /-]*$/u
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const localDateValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const OPTIONAL_FIELD_LIMITS = {
  houseNumber: { min: 1, max: 30, label: 'House number' },
  street: { min: 2, max: 100, label: 'Street' },
}

export function getPatientCallingCode(countryCode) {
  return countryCode && isSupportedCountry(countryCode) ? getCountryCallingCode(countryCode) : ''
}

export function formatPatientPhoneInput(value, countryCode) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 15)
  if (!countryCode || !isSupportedCountry(countryCode)) return digits
  return new AsYouType(countryCode).input(digits)
}

export function getPatientFieldError(field, value, context = {}) {
  const text = String(value ?? '')
  const trimmed = text.trim()

  if (field === 'firstName' || field === 'middleName' || field === 'lastName') {
    const label = field === 'lastName' ? 'Surname' : field === 'firstName' ? 'First name' : 'Middle name'
    if (!trimmed && field === 'middleName') return ''
    if (!trimmed) return `${label} is required.`
    if (text !== trimmed) return `${label} cannot start or end with spaces.`
    if (field !== 'middleName' && trimmed.length < PATIENT_NAME_MIN) return `${label} must contain at least ${PATIENT_NAME_MIN} characters.`
    if (field !== 'middleName' && text.length < PATIENT_NAME_MIN) return `${label} must be at least ${PATIENT_NAME_MIN} characters.`
    if (text.length > PATIENT_NAME_MAX) return `${label} cannot exceed ${PATIENT_NAME_MAX} characters.`
    if (!NAME_PATTERN.test(text)) return `${label} can contain letters, spaces, hyphens, apostrophes, and periods.`
    return ''
  }

  if (field === 'email') {
    if (!trimmed) return ''
    if (trimmed.length > 254) return 'Email address cannot exceed 254 characters.'
    if (trimmed.length < 6 || !EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.'
    return ''
  }

  if (field === 'phone') {
    if (!trimmed) return 'Contact number is required.'
    if (!context.countryCode) return 'Select a country before entering a contact number.'
    if (!isSupportedCountry(context.countryCode)) return 'Phone validation is unavailable for the selected country.'
    const phone = parsePhoneNumberFromString(trimmed, context.countryCode)
    if (!phone?.isValid() || phone.country !== context.countryCode) {
      return `Enter a valid phone number for ${context.countryName || 'the selected country'}.`
    }
    return ''
  }

  if (field === 'dateOfBirth') {
    if (!trimmed) return 'Date of birth is required.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'Enter a valid date of birth.'
    const date = new Date(`${trimmed}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) return 'Enter a valid date of birth.'
    const today = localDateValue(new Date())
    const earliest = new Date(`${today}T00:00:00.000Z`)
    earliest.setUTCFullYear(earliest.getUTCFullYear() - PATIENT_AGE_LIMIT)
    if (trimmed > today) return 'Date of birth cannot be in the future.'
    if (trimmed < earliest.toISOString().slice(0, 10)) return `Date of birth must be within the last ${PATIENT_AGE_LIMIT} years.`
    return ''
  }

  if (field === 'validIdType') return trimmed ? '' : 'Select an ID type.'

  if (field === 'otherIdType') {
    if (context.idSelection !== 'other') return ''
    if (!trimmed) return 'Enter the ID type or classification.'
    if (trimmed.length < 2) return 'ID type must be at least 2 characters.'
    if (trimmed.length > 80) return 'ID type cannot exceed 80 characters.'
    return ''
  }

  if (field === 'validIdNumber') {
    if (!trimmed) return 'ID number is required.'
    if (trimmed.length < 3) return 'ID number must be at least 3 characters.'
    if (trimmed.length > 50) return 'ID number cannot exceed 50 characters.'
    if (!ID_NUMBER_PATTERN.test(trimmed)) return 'Use letters, numbers, spaces, hyphens, or slashes only.'
    return ''
  }

  if (field === 'country' || field === 'city' || field === 'sex') {
    if (!trimmed) return field === 'sex' ? 'Select sex.' : `Select a ${field}.`
    if (field === 'city' && (trimmed.length < 2 || trimmed.length > 100)) return 'City must be between 2 and 100 characters.'
    if (field === 'sex' && !['Female', 'Male'].includes(trimmed)) return 'Select a valid sex.'
    return ''
  }

  const optional = OPTIONAL_FIELD_LIMITS[field]
  if (optional && trimmed) {
    if (trimmed.length < optional.min) return `${optional.label} must be at least ${optional.min} character.`
    if (trimmed.length > optional.max) return `${optional.label} cannot exceed ${optional.max} characters.`
  }
  return ''
}

export function getPatientFormErrors(values, context = {}) {
  const fields = [
    'firstName', 'middleName', 'lastName', 'country', 'city', 'houseNumber',
    'street', 'email', 'validIdType', 'otherIdType', 'validIdNumber', 'sex', 'dateOfBirth', 'phone',
  ]
  return Object.fromEntries(fields.map((field) => [
    field,
    getPatientFieldError(field, values[field], context),
  ]))
}

export function getAvailablePatientIds(countryCode, countryName = '') {
  const idsByCountry = {
    PH: [
      ['national-id', 'Philippine National ID'],
      ['drivers-license', 'Driver’s License'],
      ['philhealth', 'PhilHealth ID'],
      ['sss', 'SSS ID'],
      ['umid', 'UMID'],
      ['voters-id', 'Voter’s ID'],
    ],
    US: [['drivers-license', 'State Driver’s License'], ['state-id', 'State ID']],
    CA: [['drivers-license', 'Provincial Driver’s License']],
    IN: [['aadhaar', 'Aadhaar'], ['pan', 'PAN Card'], ['voter-id', 'Voter ID']],
    GB: [['drivers-license', 'UK Driver’s Licence'], ['national-id', 'National identity document']],
    AU: [['drivers-license', 'Australian Driver Licence']],
  }
  const countryIds = idsByCountry[countryCode] ?? (countryName
    ? [
        ['national-id', `${countryName} national identity document`],
        ['drivers-license', `${countryName} driver’s license`],
      ]
    : [])
  return [
    ['passport', 'Passport'],
    ...countryIds,
    ['other', 'Other government-issued ID'],
  ]
}
