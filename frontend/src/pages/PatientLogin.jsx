import { useState } from 'react'
import './PatientLogin.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PATIENT_ID_PATTERN = /^PID-\d{6}$/i

const COPY = {
  login: {
    title: 'Login for Patients',
    intro: 'View and download your released laboratory results.',
  },
  retrieve: {
    title: 'Retrieve Account',
    intro: 'We will email you a link to reset your password.',
  },
  register: {
    title: 'Register Your Account',
    intro: 'For patients who already received a Patient ID from the laboratory. We will email you a link to verify your address.',
  },
  'set-password': {
    title: 'Set Your Password',
    intro: 'Your email is verified. Nominate a password for your account.',
  },
  'reset-password': {
    title: 'Set a New Password',
    intro: 'Nominate a new password for your account.',
  },
  saved: {
    title: 'Password saved',
    intro: 'You can now log in with your new password.',
  },
}

function PasswordField({ id, label, value, onChange, visible, onToggle, autoComplete, error }) {
  return (
    <div className="patient-login__field">
      <label htmlFor={id}>{label}</label>
      <div className="patient-login__password-wrap">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          className="patient-login__reveal"
          type="button"
          onClick={onToggle}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && <span className="patient-login__field-error" id={`${id}-error`}>{error}</span>}
    </div>
  )
}

export default function PatientLogin({
  initialView = 'login',
  passwordPurpose = 'registration',
  onLogin,
  onRetrieve,
  onRegister,
  onSetPassword,
}) {
  const [view, setView] = useState(initialView)
  const [values, setValues] = useState({ identifier: '', password: '', email: '', patientId: '', dateOfBirth: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showAttemptsError, setShowAttemptsError] = useState(false)

  const update = (key) => (event) => {
    setValues((current) => ({ ...current, [key]: event.target.value }))
    setErrors((current) => ({ ...current, [key]: '' }))
    setMessage('')
  }

  const navigate = (nextView) => {
    setView(nextView)
    setErrors({})
    setMessage('')
    setShowAttemptsError(false)
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    const identifier = values.identifier.trim()
    const nextErrors = {}
    if (!identifier) nextErrors.identifier = 'Enter your Patient ID or email.'
    else if (identifier.includes('@') ? !EMAIL_PATTERN.test(identifier) : !PATIENT_ID_PATTERN.test(identifier)) {
      nextErrors.identifier = 'Enter a valid Patient ID (like PID-000123) or email address.'
    }
    if (!values.password) nextErrors.password = 'Enter your password.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    if (!onLogin) {
      setMessage('Login is not connected to an authentication service yet.')
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      const result = await onLogin({ identifier, password: values.password })
      if (result?.locked) {
        setShowAttemptsError(true)
      } else if (result?.attemptsLeft !== undefined || result?.error) {
        setMessage(`Incorrect Patient ID/email or password.${result?.attemptsLeft !== undefined ? ` ${result.attemptsLeft} attempts left.` : ''}`)
      }
    } catch {
      setMessage('We could not log you in right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetrieve = async (event) => {
    event.preventDefault()
    const email = values.email.trim()
    if (!email) return setErrors({ email: 'Enter your email address.' })
    if (!EMAIL_PATTERN.test(email)) return setErrors({ email: 'Enter a valid email address.' })
    setSubmitting(true)
    try {
      await onRetrieve?.({ email })
      setMessage(`If ${email} is registered, we sent a password reset link to it. The link works once and expires soon.`)
    } catch {
      setMessage('We could not process your request right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    const patientId = values.patientId.trim()
    const email = values.email.trim()
    if (!PATIENT_ID_PATTERN.test(patientId)) nextErrors.patientId = 'Enter your Patient ID, like PID-000123.'
    if (!values.dateOfBirth || new Date(values.dateOfBirth) > new Date()) nextErrors.dateOfBirth = 'Enter your date of birth.'
    if (!EMAIL_PATTERN.test(email)) nextErrors.email = 'Enter a valid email address.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      await onRegister?.({ patientId, dateOfBirth: values.dateOfBirth, email })
      setMessage(`We sent a verification link to ${email}. Open it to confirm your email address and set your password.`)
    } catch {
      setMessage('We could not process your request right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetPassword = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (values.newPassword.length < 8) nextErrors.newPassword = 'Password must be at least 8 characters.'
    if (values.newPassword !== values.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      await onSetPassword?.({ password: values.newPassword, purpose: passwordPurpose })
      navigate('saved')
    } catch {
      setMessage('We could not save your password right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const copy = COPY[view] ?? COPY.login
  const isSetPassword = view === 'set-password' || view === 'reset-password'

  return (
    <main className="patient-login">
      <div className="patient-login__frame">
        <section className="patient-login__form-side" aria-labelledby="patient-login-title">
          <span className="patient-login__brand">Labstream</span>
          <div className="patient-login__form-content">
            <h1 id="patient-login-title">{copy.title}</h1>
            <p className="patient-login__intro">{copy.intro}</p>

            {view === 'login' && (
              <form className="patient-login__form" onSubmit={handleLogin} noValidate>
                <div className="patient-login__field">
                  <label htmlFor="patient-identifier">Patient ID or Email</label>
                  <input
                    id="patient-identifier"
                    name="identifier"
                    type="text"
                    value={values.identifier}
                    onChange={update('identifier')}
                    placeholder="Example: PID-000123 or juan@email.com"
                    autoComplete="username"
                    aria-invalid={Boolean(errors.identifier)}
                    aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                  />
                  {errors.identifier && <span className="patient-login__field-error" id="identifier-error">{errors.identifier}</span>}
                </div>
                <PasswordField id="patient-password" label="Password" value={values.password} onChange={update('password')} visible={showPassword} onToggle={() => setShowPassword((shown) => !shown)} autoComplete="current-password" error={errors.password} />
                <div className="patient-login__forgot-row">
                  <button type="button" className="patient-login__text-link" onClick={() => navigate('retrieve')}>Forgot your password?</button>
                </div>
                <button className="patient-login__submit" type="submit" disabled={submitting}>{submitting ? 'Logging in…' : 'Login'}</button>
                {showAttemptsError && <p className="patient-login__notice patient-login__notice--error" role="alert">Too many failed attempts. Please wait 15 minutes, or reset your password.</p>}
                {message && <p className="patient-login__notice" role="status">{message}</p>}
                <p className="patient-login__switch">Email address not yet registered? <button type="button" className="patient-login__text-link" onClick={() => navigate('register')}>Register here.</button></p>
              </form>
            )}

            {view === 'retrieve' && (
              <form className="patient-login__form" onSubmit={handleRetrieve} noValidate>
                <div className="patient-login__field">
                  <label htmlFor="retrieve-email">Enter the email you registered on your account</label>
                  <input id="retrieve-email" type="email" value={values.email} onChange={update('email')} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'retrieve-email-error' : undefined} />
                  {errors.email && <span className="patient-login__field-error" id="retrieve-email-error">{errors.email}</span>}
                </div>
                <button className="patient-login__submit" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Retrieve'}</button>
                {message && <p className="patient-login__notice" role="status">{message}</p>}
                <p className="patient-login__switch">Email address not yet registered? <button type="button" className="patient-login__text-link" onClick={() => navigate('register')}>Register here.</button></p>
                <button type="button" className="patient-login__back-link" onClick={() => navigate('login')}>Return to Login Page</button>
              </form>
            )}

            {view === 'register' && (
              <form className="patient-login__form" onSubmit={handleRegister} noValidate>
                <div className="patient-login__field">
                  <label htmlFor="register-pid">Patient ID</label>
                  <input id="register-pid" type="text" value={values.patientId} onChange={update('patientId')} placeholder="Printed on your receipt" autoComplete="off" aria-invalid={Boolean(errors.patientId)} aria-describedby={errors.patientId ? 'register-pid-error' : undefined} />
                  {errors.patientId && <span className="patient-login__field-error" id="register-pid-error">{errors.patientId}</span>}
                </div>
                <div className="patient-login__field">
                  <label htmlFor="register-dob">Date of Birth</label>
                  <input id="register-dob" type="date" max={new Date().toISOString().slice(0, 10)} value={values.dateOfBirth} onChange={update('dateOfBirth')} autoComplete="bday" aria-invalid={Boolean(errors.dateOfBirth)} aria-describedby={errors.dateOfBirth ? 'register-dob-error' : undefined} />
                  {errors.dateOfBirth && <span className="patient-login__field-error" id="register-dob-error">{errors.dateOfBirth}</span>}
                </div>
                <div className="patient-login__field">
                  <label htmlFor="register-email">Email address</label>
                  <input id="register-email" type="email" value={values.email} onChange={update('email')} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} />
                  {errors.email && <span className="patient-login__field-error" id="register-email-error">{errors.email}</span>}
                </div>
                <button className="patient-login__submit" type="submit" disabled={submitting}>{submitting ? 'Registering…' : 'Register'}</button>
                {message && <p className="patient-login__notice" role="status">{message}</p>}
                <button type="button" className="patient-login__back-link" onClick={() => navigate('login')}>Return to Login Page</button>
              </form>
            )}

            {isSetPassword && (
              <form className="patient-login__form" onSubmit={handleSetPassword} noValidate>
                <PasswordField id="new-password" label="New password" value={values.newPassword} onChange={update('newPassword')} visible={showNewPassword} onToggle={() => setShowNewPassword((shown) => !shown)} autoComplete="new-password" error={errors.newPassword} />
                <PasswordField id="confirm-password" label="Confirm new password" value={values.confirmPassword} onChange={update('confirmPassword')} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((shown) => !shown)} autoComplete="new-password" error={errors.confirmPassword} />
                <p className="patient-login__hint">At least 8 characters.</p>
                <button className="patient-login__submit" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save password'}</button>
                {message && <p className="patient-login__notice patient-login__notice--error" role="alert">{message}</p>}
              </form>
            )}

            {view === 'saved' && <button className="patient-login__submit" type="button" onClick={() => navigate('login')}>Go to Login</button>}
          </div>
        </section>

        <aside className="patient-login__info" aria-label="Patient login help">
          {view === 'login' ? (
            <div className="patient-login__help">
              <h2>Login tips</h2>
              <ul>
                <li>If you cannot remember your Patient ID or password, <button type="button" className="patient-login__inline-link" onClick={() => navigate('retrieve')}>retrieve your account</button>.</li>
                <li>Still having problems logging in? Please visit the cashier at the laboratory for help.</li>
                <li>Only released results are available online.</li>
              </ul>
              <div className="patient-login__password-help">
                <h3>How to change password?</h3>
                <ol>
                  <li>Log in to your account.</li>
                  <li>For a new account, click <strong>Register</strong> and enter your email address.</li>
                  <li>Open the verification link sent to your email address.</li>
                  <li>Go to <strong>Profile</strong> in the portal.</li>
                  <li>Choose <strong>Change Password</strong> and nominate your new password.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="patient-login__privacy">
              <h2>Need help?</h2>
              <p>Please visit the cashier at the laboratory.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
