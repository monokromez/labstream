import { useEffect } from 'react'
import './AdminDialog.css'

export default function AdminDialog({ title, description, onClose, children, footer, size = 'medium' }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="admin-dialog__backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`admin-dialog admin-dialog--${size}`} role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
        <header className="admin-dialog__header">
          <div>
            <h2 id="admin-dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="admin-dialog__close" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <div className="admin-dialog__body">{children}</div>
        {footer && <footer className="admin-dialog__footer">{footer}</footer>}
      </section>
    </div>
  )
}
