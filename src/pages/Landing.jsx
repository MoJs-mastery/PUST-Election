import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Landing() {
  const navigate = useNavigate()
  const { user, is_superuser } = useAuth()

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
            <button
              className="btn btn-outline"
              onClick={() => navigate(is_superuser ? '/dashboard' : '/candidate')}
            >
              <i className={`fa-solid ${is_superuser ? 'fa-user-shield' : 'fa-chart-simple'}`} />{' '}
              <span className="landing-nav-btn-text">{is_superuser ? 'Go to Dashboard' : 'My Results'}</span>
            </button>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => navigate('/login')}>
                <i className="fa-solid fa-user-tie" /> <span className="landing-nav-btn-text">Candidate Login</span>
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/login/admin')}>
                <i className="fa-solid fa-right-to-bracket" /> <span className="landing-nav-btn-text">Admin Login</span>
              </button>
            </>
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
            <div className="landing-feature-icon" style={{ background: 'rgba(40, 85, 206, 0.15)', color: 'var(--color-accent)' }}>
              <i className="fa-solid fa-shield-halved" />
            </div>
            <h3>Secure System</h3>
            <p>Advanced encryption and verified voting IDs ensure that every vote is protected and completely anonymous.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon" style={{ background: 'rgba(44, 178, 43, 0.15)', color: 'var(--color-accent-2)' }}>
              <i className="fa-solid fa-bolt" />
            </div>
            <h3>Fast & Easy</h3>
            <p>A streamlined interface designed for everyone. Vote from anywhere on campus using your mobile device.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon" style={{ background: 'rgba(40, 85, 206, 0.15)', color: 'var(--color-accent)' }}>
              <i className="fa-solid fa-chart-pie" />
            </div>
            <h3>Real-time Analytics</h3>
            <p>Administrators can monitor live voting progress with comprehensive dashboard analytics and visual charts.</p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="lf-grid">
          <div className="lf-brand">
            <div className="lf-logo">
              <i className="fa-solid fa-check-to-slot" />
            </div>
            <h4>PUST-Election</h4>
            <p>
              Official online voting platform for Puntland University of Science & Technology student
              elections. Secure, fast and accessible from anywhere on campus.
            </p>
          </div>

          <div className="lf-col">
            <h4>Contact</h4>
            <ul>
              <li>
                <a href="tel:+252906821919">
                  <i className="fa-solid fa-phone" /> +252 906821919
                </a>
              </li>
              <li>
                <a href="tel:+252907616678">
                  <i className="fa-solid fa-phone" /> +252 90 7616678
                </a>
              </li>
              <li>
                <a href="https://www.pust.edu.so" target="_blank" rel="noopener noreferrer">
                  <i className="fa-solid fa-globe" /> www.pust.edu.so
                </a>
              </li>
              <li>
                <a href="mailto:info@pust.edu.so">
                  <i className="fa-solid fa-envelope" /> info@pust.edu.so
                </a>
              </li>
            </ul>
          </div>

          <div className="lf-col">
            <h4>Follow Us</h4>
            <p className="lf-socials-label">Stay connected with PUST on social media.</p>
            <div className="lf-socials">
              <a
                className="lf-social facebook"
                href="https://www.pust.edu.so"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                title="Facebook"
              >
                <i className="fa-brands fa-facebook-f" />
              </a>
              <a
                className="lf-social instagram"
                href="https://www.pust.edu.so"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                title="Instagram"
              >
                <i className="fa-brands fa-instagram" />
              </a>
              <a
                className="lf-social twitter"
                href="https://www.pust.edu.so"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                title="Twitter"
              >
                <i className="fa-brands fa-twitter" />
              </a>
            </div>
          </div>
        </div>

        <div className="lf-bottom">
          © {new Date().getFullYear()} Puntland University of Science & Technology. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
