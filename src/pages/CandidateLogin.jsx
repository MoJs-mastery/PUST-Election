import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../toast'

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
    <div className="login-page">
      <div className="login-particles">
        <span style={{ left: '10%', animationDelay: '0s' }} />
        <span style={{ left: '25%', animationDelay: '1.5s' }} />
        <span style={{ left: '55%', animationDelay: '3s' }} />
        <span style={{ left: '70%', animationDelay: '0.8s' }} />
        <span style={{ left: '85%', animationDelay: '2s' }} />
        <span style={{ left: '40%', animationDelay: '2.4s' }} />
        <span style={{ left: '90%', animationDelay: '1.2s' }} />
      </div>

      <div className="login-card">
        <div className="login-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')} title="Back to Home">
          <i className="fa-solid fa-user-tie" />
        </div>
        <h1>PUST-Election</h1>
        <p className="login-sub">Musharax Login</p>

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
          <i className="fa-solid fa-shield-halved" /> PUST-Election Musharixiinta
        </p>

        <p className="login-switch">
          Ma amiin baa?{' '}
          <span style={{ cursor: 'pointer', color: 'var(--color-accent)', fontWeight: 600 }} onClick={() => navigate('/login/admin')}>
            Admin Login
          </span>
        </p>
      </div>
    </div>
  )
}