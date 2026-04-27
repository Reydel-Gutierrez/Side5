import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import { useMockApp } from '../../context/MockAppContext'

const positions = ['GK', 'DF', 'MF', 'FW']
const positionMap = {
  GK: 'Goalkeeper',
  DF: 'Defender',
  MF: 'Midfielder',
  FW: 'Forward',
}

function Signup() {
  const navigate = useNavigate()
  const { signup, currentUserId } = useMockApp()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [position, setPosition] = useState('MF')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')

  if (currentUserId) return <Navigate to="/" replace />

  const onSubmit = (event) => {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!acceptedTerms) {
      setError('You must accept the terms to continue.')
      return
    }
    const result = signup({
      fullName,
      username,
      password,
      position: positionMap[position] ?? 'Midfielder',
    })
    if (!result.ok) {
      setError(result.reason)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Create Account" onBack={() => navigate('/login')}>
      <div className="auth-brand auth-brand--signup">
        <img
          src="/src/assets/transparentlogo.png"
          alt="Side5 logo"
          className="auth-brand-logo"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
        <p className="auth-brand-tagline">DRAFT YOUR SIDE. RUN THE GAME.</p>
        <p className="auth-heading">Join Side5</p>
        <p className="auth-subtext">Create your account to get started</p>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        <input className="auth-input auth-input--plain" placeholder="Full Name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <input className="auth-input auth-input--plain" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        <input className="auth-input auth-input--plain" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        <input className="auth-input auth-input--plain" type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />

        <select className="auth-input auth-input--plain auth-select" value={position} onChange={(event) => setPosition(event.target.value)}>
          {positions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label className="auth-check auth-check--terms">
          <input type="checkbox" checked={acceptedTerms} onChange={() => setAcceptedTerms((value) => !value)} />
          <span>
            I agree to the <a className="auth-link" href="#terms">Terms of Service</a> and{' '}
            <a className="auth-link" href="#privacy">Privacy Policy</a>
          </span>
        </label>

        {error ? <p className="auth-error">{error}</p> : null}

        <button className="auth-button" type="submit">
          Create Account
        </button>
      </form>

      <p className="auth-footer-text">
        Already have an account?{' '}
        <Link className="auth-link" to="/login">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}

export default Signup
