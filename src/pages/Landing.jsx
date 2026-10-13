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
            <span className="topbar-item topbar-loc" title="Campus: Galkayo, Puntland, Somalia">
              <i className="fa-solid fa-location-dot" />
              <span className="topbar-loc-full">Galkayo, Puntland, Somalia</span>
              <span className="topbar-loc-short">Galkayo</span>
            </span>
            <a href="tel:+252906821920" className="topbar-item topbar-phone" title="Call: +252 90 682 1920">
              <i className="fa-solid fa-phone" />
              <span>+252 90 682 1920</span>
            </a>
            <a href="mailto:info@pust.edu.so" className="topbar-item topbar-email" title="Email: info@pust.edu.so">
              <i className="fa-solid fa-envelope" />
              <span>info@pust.edu.so</span>
            </a>
          </div>
          <a
            className="pust-topbar-link"
            href="https://www.pust.edu.so"
            target="_blank"
            rel="noopener noreferrer"
            title="PUST Official Portal"
          >
            <i className="fa-solid fa-globe" />
            <span className="topbar-web-full">www.pust.edu.so</span>
            <span className="topbar-web-short">pust.edu.so</span>
          </a>
        </div>
      </div>

      {/* Navigation */}
      <nav className="landing-nav">
        <Link to="/" className="landing-nav-brand" aria-label="PUST Elections — home">
          <div className="landing-nav-logo">
            <img src="/pust-logo-ref.png" alt="PUST Logo" className="brand-logo-img" />
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

      {/* Hero Section — matches pust.edu.so dark navy hero banner */}
      <main className="landing-hero">
        {/* Navy gradient overlay inspired by pust.edu.so */}
        <div className="landing-hero-overlay" aria-hidden="true" />

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

      {/* How it works section */}
      <section className="landing-steps" id="how-it-works">
        <div className="landing-section-head">
          <span className="landing-eyebrow">How It Works</span>
          <h2>Simple, Secure and Transparent</h2>
          <p>Three easy steps to make your voice heard in the PUST student elections.</p>
        </div>

        <div className="landing-steps-grid">
          <div className="landing-step-card">
            <div className="landing-step-number">1</div>
            <div className="landing-step-icon">
              <i className="fa-solid fa-id-card" />
            </div>
            <h3>Get Your Vote ID</h3>
            <p>Receive your unique, confidential voting ID from the election committee or department admin.</p>
          </div>

          <div className="landing-step-card">
            <div className="landing-step-number">2</div>
            <div className="landing-step-icon">
              <i className="fa-solid fa-user-check" />
            </div>
            <h3>Choose Your Candidate</h3>
            <p>Browse candidates, read their profiles, and select the one who best represents your vision.</p>
          </div>

          <div className="landing-step-card">
            <div className="landing-step-number">3</div>
            <div className="landing-step-icon">
              <i className="fa-solid fa-check-to-slot" />
            </div>
            <h3>Cast Your Vote</h3>
            <p>Confirm your choice and submit. Your vote is encrypted, anonymous, and counted instantly.</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features" id="features">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Why PUST Elections</span>
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