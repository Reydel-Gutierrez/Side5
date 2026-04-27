import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import { useMockApp } from '../../context/MockAppContext'

function LoginMain() {
  const navigate = useNavigate()
  const { login, currentUserId } = useMockApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')

  if (currentUserId) return <Navigate to="/" replace />

  const onSubmit = (event) => {
    event.preventDefault()
    setError('')
    const result = login(username, password)
    if (!result.ok) {
      setError(result.reason)
      return
    }
    if (!rememberMe) {
      window.localStorage.removeItem('side5-current-user-id')
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Log In" onBack={() => navigate('/login')}>
      <div className="auth-brand">
        <img
          src="/src/assets/transparentlogo.png"
          alt="Side5 logo"
          className="auth-brand-logo"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
        <p className="auth-brand-tagline">DRAFT YOUR SIDE. RUN THE GAME.</p>
        <h2 className="auth-wordmark">
          SIDE<span>5</span>
        </h2>
        <p className="auth-heading">Welcome back</p>
        <p className="auth-subtext">Log in to your account</p>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-input-wrap">
          <span className="auth-input-icon">◌</span>
          <input
            className="auth-input"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </label>

        <label className="auth-input-wrap">
          <span className="auth-input-icon">◌</span>
          <input
            className="auth-input auth-input--password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          <span className="auth-input-eye" aria-hidden="true">
            ◔
          </span>
        </label>

        <div className="auth-row">
          <label className="auth-check">
            <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe((value) => !value)} />
            <span>Remember me</span>
          </label>
          <Link className="auth-link" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}

        <button className="auth-button" type="submit">
          Log In
        </button>
      </form>

      <p className="auth-footer-text">
        Don&apos;t have an account?{' '}
        <Link className="auth-link" to="/signup">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}

export default LoginMain
