import { useNavigate } from 'react-router-dom'

export default function SiteFooter() {
  const navigate = useNavigate()

  return (
    <footer className="landing-footer">
      <div className="lf-grid">
        <div className="lf-brand">
          <div className="lf-brand-row">
            <div className="lf-logo">
              <img src="/pust-logo-ref.png" alt="PUST Logo" className="brand-logo-img" />
            </div>
            <div className="lf-brand-divider" aria-hidden="true" />
            <div className="lf-wordmark">
              <span className="lf-wordmark-primary">PUST</span>
              <span className="lf-wordmark-secondary">University</span>
            </div>
          </div>
          <p className="lf-tagline">Setting Trends in Higher Education, Research and Innovation</p>
          <p className="lf-desc">
            Official digital election platform for student union representation.
            Secure, transparent and verified academic governance.
          </p>
          <div className="lf-socials">
            <a
              className="lf-social facebook"
              href="https://www.facebook.com/PUSTUNIVERSITY"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              title="PUST Facebook"
            >
              <i className="fa-brands fa-facebook-f" />
            </a>
            <a
              className="lf-social whatsapp"
              href="https://wa.me/252906821919?text=Hello%20PUST%20University!%20%F0%9F%91%8B%0AI%20would%20like%20to%20learn%20more%20about%20your%20programs.%0AThank%20you."
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              title="PUST WhatsApp"
            >
              <i className="fa-brands fa-whatsapp" />
            </a>
            <a
              className="lf-social tiktok"
              href="https://www.tiktok.com/@pust_university"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              title="PUST TikTok"
            >
              <i className="fa-brands fa-tiktok" />
            </a>
          </div>
        </div>

        <div className="lf-col">
          <h4>Quick Links</h4>
          <ul>
            <li>
              <button className="lf-link" onClick={() => navigate('/')}>
                <i className="fa-solid fa-house" /> Home
              </button>
            </li>
            <li>
              <button className="lf-link" onClick={() => navigate('/vote')}>
                <i className="fa-solid fa-check-to-slot" /> Vote Now
              </button>
            </li>
            <li>
              <button className="lf-link" onClick={() => navigate('/login')}>
                <i className="fa-solid fa-user-tie" /> Candidate Portal
              </button>
            </li>
            <li>
              <button className="lf-link" onClick={() => navigate('/login/admin')}>
                <i className="fa-solid fa-user-shield" /> Admin Dashboard
              </button>
            </li>
          </ul>
        </div>

        <div className="lf-col">
          <h4>Contact Us</h4>
          <ul>
            <li>
              <a href="tel:+252906821919">
                <i className="fa-solid fa-phone" /> +252 906 821919
              </a>
            </li>
            <li>
              <a href="tel:+252907616678">
                <i className="fa-solid fa-phone" /> +252 907 616678
              </a>
            </li>
            <li>
              <a href="mailto:info@pust.edu.so">
                <i className="fa-solid fa-envelope" /> info@pust.edu.so
              </a>
            </li>
            <li>
              <a href="https://www.pust.edu.so" target="_blank" rel="noopener noreferrer">
                <i className="fa-solid fa-globe" /> www.pust.edu.so
              </a>
            </li>
          </ul>
          <div className="lf-address">
            <i className="fa-solid fa-location-dot" />
            <span>
              PUST Main Campus<br />
              Jama Biixi Road, Sinay - Israac<br />
              Galkayo, Puntland, Somalia
            </span>
          </div>
        </div>
      </div>

      <div className="lf-bottom">
        <div className="lf-bottom-inner">
          <span>© {new Date().getFullYear()} Puntland University of Science &amp; Technology. All rights reserved.</span>
          <span className="lf-bottom-sep" aria-hidden="true">|</span>
          <span>Official Campus Election System</span>
        </div>
      </div>
    </footer>
  )
}
