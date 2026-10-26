import { useState } from 'react'
import { signIn } from '../lib/api.js'
import './Login.css'

<<<<<<< HEAD
export default function Login({ onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
=======
export default function Login({ onAuthenticated, mustChangePassword = false, sessionUser }) {
  const [mode, setMode] = useState(mustChangePassword ? 'password' : 'login')
  const [form, setForm] = useState({ identifier: '', password: '', activationCode: '', newPassword: '', currentPassword: '' })
  const [busy, setBusy] = useState(false)
>>>>>>> parent of c6490db (feat: add structured results and workflow improvements)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
<<<<<<< HEAD
      const user = await signIn({ email, password })
      onAuthenticated(user)
    } catch (signInError) {
      setError(signInError.message)
=======
      if (mode === 'login') {
        const result = await api.auth.login({ identifier: form.identifier, password: form.password })
        onAuthenticated(result.user)
      } else if (mode === 'activate') {
        const result = await api.auth.activate({ identifier: form.identifier, activationCode: form.activationCode, newPassword: form.newPassword })
        onAuthenticated(result.user)
      } else {
        await api.auth.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
        const result = await api.auth.me()
        onAuthenticated(result)
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect. Check the API server and try again.')
>>>>>>> parent of c6490db (feat: add structured results and workflow improvements)
    } finally {
      setIsSubmitting(false)
    }
  }

<<<<<<< HEAD
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
=======
  const title = mode === 'login' ? 'Sign in to Labstream' : mode === 'activate' ? 'Activate your account' : 'Set a new password'
  return (
    <main className="login-page">
      <section className="login-page__panel" aria-labelledby="login-title">
        <p className="login-page__brand">LABSTREAM</p>
        <h1 id="login-title">{title}</h1>
        <p className="login-page__intro">{mode === 'login' ? 'Use your account credentials.' : mode === 'activate' ? 'Enter the one-time code provided by the laboratory, then choose a password.' : `Choose a new password for ${sessionUser?.username ?? 'your account'}.`}</p>
        <form className="login-page__form" onSubmit={submit}>
          {mode !== 'password' && <label>{mode === 'login' ? 'Username or PID' : 'Username or PID'}<LimitedInput name="identifier" value={form.identifier} onChange={update} required autoComplete="username" maxLength={80} /></label>}
          {mode === 'login' && <label>Password<LimitedInput name="password" type="password" value={form.password} onChange={update} required autoComplete="current-password" maxLength={128} /></label>}
          {mode === 'activate' && <label>Activation code<LimitedInput name="activationCode" value={form.activationCode} onChange={update} required autoComplete="one-time-code" maxLength={32} /></label>}
          {mode === 'password' && <label>Current password<LimitedInput name="currentPassword" type="password" value={form.currentPassword} onChange={update} required autoComplete="current-password" maxLength={128} /></label>}
          {(mode === 'activate' || mode === 'password') && <label>New password<LimitedInput name="newPassword" type="password" value={form.newPassword} onChange={update} required minLength={12} autoComplete="new-password" maxLength={128} /><small>Use at least 12 characters.</small></label>}
          {error && <p className="login-page__error" role="alert">{error}</p>}
          <button className="login-page__submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'activate' ? 'Activate Account' : 'Update Password'}</button>
        </form>
        {!mustChangePassword && <div className="login-page__mode-switch">{mode === 'login' ? <button type="button" onClick={() => { setMode('activate'); setError('') }}>Have an activation code?</button> : mode === 'activate' ? <button type="button" onClick={() => { setMode('login'); setError('') }}>Back to sign in</button> : null}</div>}
>>>>>>> parent of c6490db (feat: add structured results and workflow improvements)
      </section>
    </main>
  )
}
