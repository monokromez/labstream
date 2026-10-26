import { useState } from 'react'
import { signIn } from '../lib/api.js'
import './Login.css'

export default function Login({ onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      const user = await signIn({ email, password })
      onAuthenticated(user)
    } catch (signInError) {
      setError(signInError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-page__panel" aria-labelledby="login-title">
        <div className="login-page__brand"><span aria-hidden="true">L</span><div><strong>Labstream</strong><small>Diagnostic laboratory portal</small></div></div>
        <h1 id="login-title">Staff sign in</h1>
        <p className="login-page__intro">Sign in with your laboratory account to access your role workspace.</p>
        <form className="login-page__form" onSubmit={handleSubmit}>
          <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="login-page__error" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="login-page__help">Access is limited to active staff accounts.</p>
      </section>
    </main>
  )
}
