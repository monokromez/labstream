import './SearchInput.css'

export default function SearchInput({ label, placeholder, value, onChange, className = '', visibleLabel }) {
  return (
    <div className={`app-search-field ${className}`.trim()}>
      {visibleLabel && <span className="app-search-field__label">{visibleLabel}</span>}
      <label className="app-search">
        <svg aria-hidden='true' viewBox='0 0 24 24' fill='none'>
          <circle cx='10.8' cy='10.8' r='6.3' stroke='currentColor' strokeWidth='1.8' />
          <path d='m15.4 15.4 4.1 4.1' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        </svg>
        <input
          type='search'
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          maxLength='100'
        />
      </label>
      <small className="character-count" aria-label={`${String(value ?? '').length} of 100 characters`}>
        {String(value ?? '').length}/100 characters
      </small>
    </div>
  )
}
