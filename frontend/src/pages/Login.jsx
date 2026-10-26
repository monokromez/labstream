import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { LimitedInput } from '../components/forms/LimitedInput.jsx'
import './Login.css'

export default function Login({ onAuthenticated, mustChangePassword = false, sessionUser }) {
  const [mode, setMode] = useState(mustChangePassword ? 'password' : 'login')
  const [form, setForm] = useState({ identifier: '', password: '', activationCode: '', resetCode: '', newPassword: '', currentPassword: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mustChangePassword) setMode('password')
  }, [mustChangePassword])

  const update = (event) => setForm((value) => ({ ...value, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') {
        const result = await api.auth.login({ identifier: form.identifier, password: form.password })
        onAuthenticated(result.user)
      } else if (mode === 'activate') {
        const result = await api.auth.activate({ identifier: form.identifier, activationCode: form.activationCode, newPassword: form.newPassword })
        onAuthenticated(result.user)
      } else if (mode === 'reset') {
        const result = await api.auth.resetPassword({ identifier: form.identifier, resetCode: form.resetCode, newPassword: form.newPassword })
        onAuthenticated(result.user)
      } else {
        await api.auth.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
        const result = await api.auth.me()
        onAuthenticated(result)
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect. Check the API server and try again.')
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'login' ? 'Sign in to Labstream' : mode === 'activate' ? 'Activate your account' : mode === 'reset' ? 'Reset patient password' : 'Set a new password'
  return (
    <main className="login-page">
      <section className="login-page__panel" aria-labelledby="login-title">
        <p className="login-page__brand">LABSTREAM</p>
        <h1 id="login-title">{title}</h1>
        <p className="login-page__intro">{mode === 'login' ? 'Use your account credentials.' : mode === 'activate' ? 'Enter the one-time code provided by the laboratory, then choose a password.' : mode === 'reset' ? 'Ask a cashier to verify your identity and issue a one-time reset code.' : `Choose a new password for ${sessionUser?.username ?? 'your account'}.`}</p>
        <form className="login-page__form" onSubmit={submit}>
          {mode !== 'password' && <label>{mode === 'reset' ? 'Patient PID' : 'Username or PID'}<LimitedInput name="identifier" value={form.identifier} onChange={update} required autoComplete="username" maxLength={80} /></label>}
          {mode === 'login' && <label>Password<LimitedInput name="password" type="password" value={form.password} onChange={update} required autoComplete="current-password" maxLength={128} /></label>}
          {mode === 'activate' && <label>Activation code<LimitedInput name="activationCode" value={form.activationCode} onChange={update} required autoComplete="one-time-code" maxLength={64} /></label>}
          {mode === 'reset' && <label>Cashier-issued reset code<LimitedInput name="resetCode" value={form.resetCode} onChange={update} required autoComplete="one-time-code" maxLength={64} /></label>}
          {mode === 'password' && <label>Current password<LimitedInput name="currentPassword" type="password" value={form.currentPassword} onChange={update} required autoComplete="current-password" maxLength={128} /></label>}
          {(mode === 'activate' || mode === 'reset' || mode === 'password') && <label>New password<LimitedInput name="newPassword" type="password" value={form.newPassword} onChange={update} required minLength={12} autoComplete="new-password" maxLength={128} /><small>Use at least 12 characters.</small></label>}
          {error && <p className="login-page__error" role="alert">{error}</p>}
          <button className="login-page__submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'activate' ? 'Activate Account' : mode === 'reset' ? 'Reset Password' : 'Update Password'}</button>
        </form>
        {!mustChangePassword && <div className="login-page__mode-switch">{mode === 'login' ? <><button type="button" onClick={() => { setMode('activate'); setError('') }}>Have an activation code?</button><button type="button" onClick={() => { setMode('reset'); setError('') }}>Reset patient password</button></> : mode === 'activate' || mode === 'reset' ? <button type="button" onClick={() => { setMode('login'); setError('') }}>Back to sign in</button> : null}</div>}
      </section>
    </main>
  )
}
