import './DialogCloseButton.css'

export default function DialogCloseButton({ onClick, label = 'Close dialog', disabled = false }) {
  return (
    <button
      className="dialog-close-button"
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m5 5 10 10M15 5 5 15" />
      </svg>
    </button>
  )
}
