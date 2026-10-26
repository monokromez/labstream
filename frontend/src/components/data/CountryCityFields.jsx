import { useEffect, useMemo, useState } from 'react'
import { getCitiesForCountry, getCountries } from '../../api/geography.js'
import './CountryCityFields.css'

export default function CountryCityFields({
  country,
  city,
  onCountryChange,
  onCountryCodeChange,
  onCityChange,
  countryError = '',
  cityError = '',
  onCountryBlur,
  onCityBlur,
  idPrefix,
  className = '',
  fieldClassName = '',
}) {
  const [countries, setCountries] = useState([])
  const [cities, setCities] = useState([])
  const [countriesLoading, setCountriesLoading] = useState(true)
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    getCountries()
      .then((items) => { if (mounted) setCountries(items) })
      .catch(() => { if (mounted) setError('Countries could not be loaded. Check your connection and retry.') })
      .finally(() => { if (mounted) setCountriesLoading(false) })
    return () => { mounted = false }
  }, [])

  const selectedCountry = useMemo(
    () => countries.find((item) => item.name === country) ?? null,
    [countries, country],
  )

  useEffect(() => {
    if (!selectedCountry) {
      setCities([])
      return undefined
    }
    let mounted = true
    setCitiesLoading(true)
    setError('')
    getCitiesForCountry(selectedCountry.alpha2Code)
      .then((items) => { if (mounted) setCities(items) })
      .catch(() => { if (mounted) setError('Cities could not be loaded for this country. Please retry.') })
      .finally(() => { if (mounted) setCitiesLoading(false) })
    return () => { mounted = false }
  }, [selectedCountry])

  return (
    <div className={`country-city-fields ${className}`.trim()}>
      <label className={fieldClassName} htmlFor={`${idPrefix}-country`}>
        Country
        <select
          id={`${idPrefix}-country`}
          name="country"
          autoComplete="country-name"
          value={selectedCountry?.alpha2Code ?? ''}
          aria-invalid={Boolean(countryError)}
          onBlur={onCountryBlur}
          onChange={(event) => {
            const nextCountry = countries.find((item) => item.alpha2Code === event.target.value)
            onCountryChange(nextCountry?.name ?? '')
            onCountryCodeChange?.(nextCountry?.alpha2Code ?? '')
            onCityChange('')
          }}
          required
        >
          <option value="" disabled>{countriesLoading ? 'Loading countries…' : 'Select a country'}</option>
          {countries.map((item) => <option key={item.alpha2Code} value={item.alpha2Code}>{item.name}</option>)}
        </select>
      </label>
      <label className={fieldClassName} htmlFor={`${idPrefix}-city`}>
        City
        <select
          id={`${idPrefix}-city`}
          name="city"
          autoComplete="address-level2"
          value={city}
          aria-invalid={Boolean(cityError)}
          onBlur={onCityBlur}
          onChange={(event) => onCityChange(event.target.value)}
          disabled={!selectedCountry || citiesLoading}
          required
        >
          <option value="" disabled>
            {!selectedCountry ? 'Select a country first' : citiesLoading ? 'Loading cities…' : 'Select a city'}
          </option>
          {city && !cities.some((item) => item.name === city) && <option value={city}>{city}</option>}
          {cities.map((item) => <option key={`${item.geonameId}-${item.name}`} value={item.name}>{item.name}{item.admin1Code ? ` (${item.admin1Code})` : ''}</option>)}
        </select>
      </label>
      {countryError && <p className="country-city-fields__error" role="alert">{countryError}</p>}
      {cityError && <p className="country-city-fields__error" role="alert">{cityError}</p>}
      {error && <p className="country-city-fields__error" role="status">{error}</p>}
    </div>
  )
}
