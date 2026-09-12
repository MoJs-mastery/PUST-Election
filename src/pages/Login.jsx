import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../toast'

export default function Login() {
  const { user, login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true })
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
      .then((res) => {
        showToast('success', `Soo dhawoow, ${res.username || 'admin'}!`)
        navigate('/dashboard', { replace: true })
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
          <i className="fa-solid fa-user-shield" />
        </div>
        <h1>PUST-Election</h1>
        <p className="login-sub">Admin Dashboard</p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Email or Username</label>
            <div className="login-input-wrap">
              <i className="fa-solid fa-envelope" />
              <input
                type="text"
                placeholder="Enter email or username"
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

          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Remember me</span>
          </label>

          <button type="submit" className="login-btn" disabled={submitting}>
            <i className={`fa-solid ${submitting ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'}`} />
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="login-footer">
          <i className="fa-solid fa-shield-halved" /> PUST-Election Admin Panel
        </p>
      </div>
    </div>
  )
}
