import { Link } from 'react-router-dom'
import { useEffect } from 'react'

function AuthLayout({ title, children, onBack }) {
  useEffect(() => {
    document.body.classList.add('login-page')
    return () => document.body.classList.remove('login-page')
  }, [])

  return (
    <div className="auth-layout">
      <div className="auth-layout__bg" />
      <div className="auth-layout__inner">
        <header className="auth-header">
          {onBack ? (
            <button type="button" onClick={onBack} className="auth-header__back" aria-label="Go back">
              ←
            </button>
          ) : (
            <Link to="/login" className="auth-header__back" aria-label="Back to login">
              ←
            </Link>
          )}
          <h1 className="auth-header__title">{title}</h1>
          <span className="auth-header__spacer" aria-hidden="true" />
        </header>
        <section className="auth-card">{children}</section>
      </div>
    </div>
  )
}

export default AuthLayout
