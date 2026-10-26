import './LimitedInput.css'

export function CharacterCount({ value, limit, unit = 'characters' }) {
  const length = String(value ?? '').length
  return <small className="character-count" aria-label={`${length} of ${limit} ${unit}`}>{length}/{limit} {unit}</small>
}

export function LimitedInput({ maxLength, value, ...props }) {
  return (
    <>
      <input {...props} value={value} maxLength={maxLength} />
      <CharacterCount value={value} limit={maxLength} />
    </>
  )
}

export function LimitedTextarea({ maxLength, value, ...props }) {
  return (
    <>
      <textarea {...props} value={value} maxLength={maxLength} />
      <CharacterCount value={value} limit={maxLength} />
    </>
  )
}

const MAX_PRICE_INTEGER_DIGITS = 8
const MAX_PRICE_DECIMAL_DIGITS = 2

function formatPrice(value) {
  const [whole = '', fraction = ''] = String(value ?? '').split('.')
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return String(value ?? '').includes('.') ? `${groupedWhole}.${fraction}` : groupedWhole
}

export function CurrencyInput({ value, onValueChange, ...props }) {
  const amount = String(value ?? '')
  const [whole = '', fraction = ''] = amount.split('.')

  function handleChange(event) {
    const entered = event.target.value.replace(/[^\d.]/g, '')
    const decimalIndex = entered.indexOf('.')
    const digitsOnly = entered.replace(/\./g, '')
    const wholeDigits = (decimalIndex === -1 ? entered : entered.slice(0, decimalIndex))
      .replace(/\D/g, '')
      .slice(0, MAX_PRICE_INTEGER_DIGITS)
    const decimalDigits = decimalIndex === -1
      ? ''
      : entered.slice(decimalIndex + 1).replace(/\D/g, '').slice(0, MAX_PRICE_DECIMAL_DIGITS)

    if (!digitsOnly && decimalIndex === -1) {
      onValueChange('')
      return
    }

    onValueChange(decimalIndex === -1
      ? wholeDigits
      : `${wholeDigits || '0'}.${decimalDigits}`)
  }

  return (
    <>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        value={formatPrice(amount)}
        maxLength={13}
        onChange={handleChange}
      />
      <small
        className="character-count"
        aria-label={`${whole.length} of ${MAX_PRICE_INTEGER_DIGITS} whole-number digits and ${fraction.length} of ${MAX_PRICE_DECIMAL_DIGITS} decimal places`}
      >
        {whole.length}/{MAX_PRICE_INTEGER_DIGITS} digits · {fraction.length}/{MAX_PRICE_DECIMAL_DIGITS} decimals
      </small>
    </>
  )
}

const MAX_DECIMAL_INTEGER_DIGITS = 8
const MAX_DECIMAL_FRACTION_DIGITS = 2

export function DecimalInput({ value, onValueChange, ...props }) {
  const amount = String(value ?? '')
  const [whole = '', fraction = ''] = amount.split('.')

  function handleChange(event) {
    const [rawWhole = '', ...rawFraction] = event.target.value.replace(/[^\d.]/g, '').split('.')
    const wholeDigits = rawWhole.slice(0, MAX_DECIMAL_INTEGER_DIGITS)
    const decimalDigits = rawFraction.join('').slice(0, MAX_DECIMAL_FRACTION_DIGITS)
    const nextValue = rawFraction.length
      ? `${wholeDigits || '0'}.${decimalDigits}`
      : wholeDigits

    onValueChange(nextValue)
  }

  return (
    <>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        pattern="[0-9]{1,8}([.][0-9]{1,2})?"
        maxLength={MAX_DECIMAL_INTEGER_DIGITS + MAX_DECIMAL_FRACTION_DIGITS + 1}
        value={amount}
        onChange={handleChange}
      />
      <small
        className="character-count"
        aria-label={`${whole.length} of ${MAX_DECIMAL_INTEGER_DIGITS} whole-number digits and ${fraction.length} of ${MAX_DECIMAL_FRACTION_DIGITS} decimal places`}
      >
        {whole.length}/{MAX_DECIMAL_INTEGER_DIGITS} digits · {fraction.length}/{MAX_DECIMAL_FRACTION_DIGITS} decimals
      </small>
    </>
  )
}
