import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import SiteFooter from '../components/SiteFooter'

export default function Landing() {
  const navigate = useNavigate()
  const { user, is_superuser } = useAuth()

  return (
    <div className="landing-page">
      {/* Topbar */}
      <div className="pust-topbar">
        <div className="pust-topbar-inner">
          <div className="pust-topbar-info">
            <span>
              <i className="fa-solid fa-location-dot" /> Galkayo, Puntland, Somalia
            </span>
            <a href="tel:+252906821920">
              <i className="fa-solid fa-phone" /> +252 90 682 1920
            </a>
            <a href="mailto:info@pust.edu.so">
              <i className="fa-solid fa-envelope" /> info@pust.edu.so
            </a>
          </div>
          <a className="pust-topbar-link" href="https://www.pust.edu.so">
            <i className="fa-solid fa-globe" /> www.pust.edu.so
          </a>
        </div>
      </div>

      {/* Navigation */}
      <nav className="landing-nav">
        <Link to="/" className="landing-nav-brand" aria-label="PUST Elections — home">
          <div className="landing-nav-logo">
            <i className="fa-solid fa-check-to-slot" />
          </div>
          <span className="landing-nav-name">
            PUST <em>Elections</em>
          </span>
        </Link>
        <div className="landing-nav-links">
          {user ? (
            <button
              className="btn btn-outline"
              aria-label="Go to dashboard"
              onClick={() => navigate(is_superuser ? '/dashboard' : '/candidate')}
            >
              <i className={`fa-solid ${is_superuser ? 'fa-user-shield' : 'fa-chart-simple'}`} />{' '}
              <span className="landing-nav-btn-text">{is_superuser ? 'Go to Dashboard' : 'My Results'}</span>
            </button>
          ) : (
            <>
              <button className="btn btn-outline" aria-label="Candidate login" onClick={() => navigate('/login')}>
                <i className="fa-solid fa-user-tie" /> <span className="landing-nav-btn-text">Candidate Login</span>
              </button>
              <button className="btn btn-outline" aria-label="Admin login" onClick={() => navigate('/login/admin')}>
                <i className="fa-solid fa-right-to-bracket" /> <span className="landing-nav-btn-text">Admin Login</span>
              </button>
            </>
          )}
          <button className="btn btn-primary landing-vote-btn" aria-label="Vote now" onClick={() => navigate('/vote')}>
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
            Your Voice. Your Choice. <br />
            <span className="landing-hero-gradient">Your University.</span>
          </h1>

          <div className="landing-hero-rule" />

          <p className="landing-hero-desc">
            Welcome to the official digital voting platform of the Puntland University of
            Science &amp; Technology. Cast your vote securely, anonymously and transparently —
            from anywhere on campus.
          </p>

          <div className="landing-hero-actions">
            <button className="btn landing-cta-btn" onClick={() => navigate('/vote')}>
              Start Voting <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
            <button className="btn landing-second-btn" onClick={() => navigate('/login')}>
              <i className="fa-solid fa-user-tie" style={{ marginRight: 8 }} /> Candidate Login
            </button>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="landing-features" id="features">
        <div className="landing-section-head">
          <span className="tag">Why PUST Elections</span>
          <h2>Built for a Fair, Secure University Vote</h2>
          <p>
            A transparent digital election platform designed for PUST students and administrators.
          </p>
        </div>

        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <i className="fa-solid fa-shield-halved" />
            </div>
            <h3>Secure System</h3>
            <p>Advanced encryption and verified voting IDs ensure that every vote is protected and completely anonymous.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <i className="fa-solid fa-bolt" />
            </div>
            <h3>Fast &amp; Easy</h3>
            <p>A streamlined interface designed for everyone. Vote from anywhere on campus using your mobile device.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <i className="fa-solid fa-chart-pie" />
            </div>
            <h3>Real-time Analytics</h3>
            <p>Administrators can monitor live voting progress with comprehensive dashboard analytics and visual charts.</p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}