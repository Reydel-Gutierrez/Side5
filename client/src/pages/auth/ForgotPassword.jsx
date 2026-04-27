import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'

function ForgotPassword() {
  const navigate = useNavigate()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [message, setMessage] = useState('')

  const onSubmit = (event) => {
    event.preventDefault()
    setMessage('Reset link sent if the account exists.')
    setUsernameOrEmail('')
  }

  return (
    <AuthLayout title="Forgot Password" onBack={() => navigate('/login')}>
      <div className="auth-brand auth-brand--forgot">
        <img
          src="/src/assets/transparentlogo.png"
          alt="Side5 logo"
          className="auth-brand-logo auth-brand-logo--sm"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
        <p className="auth-brand-tagline">DRAFT YOUR SIDE. RUN THE GAME.</p>
        <div className="auth-lock-ring">
          <span className="auth-lock-icon" aria-hidden="true">
            🔒
          </span>
        </div>
        <p className="auth-heading">Reset Your Password</p>
        <p className="auth-subtext">
          Enter your username or email and we&apos;ll send you a link to reset it.
        </p>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        <input
          className="auth-input auth-input--plain"
          placeholder="Username or Email"
          value={usernameOrEmail}
          onChange={(event) => setUsernameOrEmail(event.target.value)}
          autoComplete="username"
        />

        <button className="auth-button" type="submit">
          Send Reset Link
        </button>
      </form>

      {message ? <p className="auth-success">{message}</p> : null}

      <p className="auth-footer-text">
        Remember your password?{' '}
        <Link className="auth-link" to="/login">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}

export default ForgotPassword
