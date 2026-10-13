import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import SiteFooter from '../components/SiteFooter'

export default function CandidateLogin() {
  const { user, login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (user) {
      navigate('/candidate', { replace: true })
    }
  }, [user, navigate])

  function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      showToast('warn', 'Fadlan buuxi dhammaan goobaha.')
      return
    }
    setSubmitting(true)
    login(email.trim(), password)
      .then(() => {
        showToast('success', 'Soo dhawoow!')
        navigate('/candidate', { replace: true })
      })
      .catch((err) => {
        showToast('error', err.message || 'Login failed.')
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="page-with-footer">
    <div className="login-page">
      <div className="login-shell">
        <div className="login-brand-panel">
          <div>
            <Link to="/" className="lp-logo-link" title="Back to Home" aria-label="PUST Elections — back to home">
              <div className="lp-logo">
                <img src="/pust-logo-ref.png" alt="PUST Logo" className="brand-logo-img" />
              </div>
              <div className="lp-brand">
                <b>
                  PUST <em>Elections</em>
                </b>
              </div>
            </Link>
            <p className="lp-tag">
              Musharax Login
            </p>
            <p className="lp-text">
              Track your own campaign. Sign in to view your votes and results in real time.
            </p>
            <ul className="lp-points">
              <li>
                <i className="fa-solid fa-shield-halved" /> Private, personal vote dashboard
              </li>
              <li>
                <i className="fa-solid fa-chart-line" /> Live vote totals &amp; departments
              </li>
              <li>
                <i className="fa-solid fa-id-card" /> Official PUST campus elections
              </li>
            </ul>
          </div>
          <div className="lp-foot">
            <i className="fa-solid fa-globe" />
            <a href="https://www.pust.edu.so" target="_blank" rel="noopener noreferrer">
              www.pust.edu.so
            </a>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-card-head">
            <div className="login-icon">
              <i className="fa-solid fa-user-tie" />
            </div>
            <h1>Candidate Login</h1>
            <p className="login-sub">Sign in with your candidate account</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label>Email</label>
              <div className="login-input-wrap">
                <i className="fa-solid fa-envelope" />
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="login-field">
              <label>Password</label>
              <div className="login-input-wrap">
                <i className="fa-solid fa-lock" />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}
                >
                  <i className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={submitting}>
              <i className={`fa-solid ${submitting ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'}`} />
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="login-footer">
            <i className="fa-solid fa-shield-halved" /> PUST Elections Musharixiinta
          </p>

          <p className="login-switch">
            Ma amiin baa?{' '}
            <span style={{ cursor: 'pointer', color: 'var(--pust-blue)', fontWeight: 600 }} onClick={() => navigate('/login/admin')}>
              Admin Login
            </span>
          </p>
        </div>
      </div>
    </div>
    <SiteFooter />
    </div>
  )
}
