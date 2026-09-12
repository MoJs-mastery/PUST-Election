import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Landing() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div className="landing-nav-logo">
            <i className="fa-solid fa-check-to-slot" />
          </div>
          <span>PUST-Election</span>
        </div>
        <div className="landing-nav-links">
          {user ? (
            <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
              <i className="fa-solid fa-user-shield" /> <span className="landing-nav-btn-text">Go to Dashboard</span>
            </button>
          ) : (
            <button className="btn btn-outline" onClick={() => navigate('/dashboard/login')}>
              <i className="fa-solid fa-right-to-bracket" /> <span className="landing-nav-btn-text">Admin Login</span>
            </button>
          )}
          <button className="btn btn-primary landing-vote-btn" onClick={() => navigate('/vote')}>
            <i className="fa-solid fa-check-to-slot" /> <span className="landing-nav-btn-text">Vote Now</span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="landing-hero">
        <div className="landing-glow" />

        <div className="landing-hero-content">
          <div className="landing-badge">
            <span className="landing-badge-dot" />
            Official PUST Campus Voting
          </div>

          <h1>
            Secure & Transparent <br />
            <span className="landing-hero-gradient">
              Digital Elections
            </span>
          </h1>

          <p className="landing-hero-desc">
            Welcome to the Puntland University of Science & Technology official electronic voting platform. Cast your vote securely and seamlessly.
          </p>

          <div className="landing-hero-actions">
            <button className="btn btn-primary landing-cta-btn" onClick={() => navigate('/vote')}>
              Start Voting <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="landing-features">
        <div className="landing-features-grid">

          <div className="landing-feature-card">
            <div className="landing-feature-icon" style={{ background: 'rgba(74, 136, 198, 0.15)', color: 'var(--color-accent)' }}>
              <i className="fa-solid fa-shield-halved" />
            </div>
            <h3>Secure System</h3>
            <p>Advanced encryption and verified voting IDs ensure that every vote is protected and completely anonymous.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon" style={{ background: 'rgba(99, 154, 68, 0.15)', color: 'var(--color-accent-2)' }}>
              <i className="fa-solid fa-bolt" />
            </div>
            <h3>Fast & Easy</h3>
            <p>A streamlined interface designed for everyone. Vote from anywhere on campus using your mobile device.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon" style={{ background: 'rgba(73, 133, 196, 0.15)', color: 'var(--color-accent)' }}>
              <i className="fa-solid fa-chart-pie" />
            </div>
            <h3>Real-time Analytics</h3>
            <p>Administrators can monitor live voting progress with comprehensive dashboard analytics and visual charts.</p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        © {new Date().getFullYear()} Puntland University of Science & Technology. All rights reserved.
      </footer>
    </div>
  )
}
