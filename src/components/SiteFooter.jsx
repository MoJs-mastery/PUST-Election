import { useNavigate } from 'react-router-dom'

export default function SiteFooter() {
  const navigate = useNavigate()

  return (
    <footer className="landing-footer">
      <div className="lf-grid">
        <div className="lf-brand">
          <div className="lf-logo">
            <i className="fa-solid fa-check-to-slot" />
          </div>
          <h4>PUST Elections</h4>
          <p>
            Official online voting platform for Puntland University of Science &amp; Technology student
            elections. Secure, fast and accessible from anywhere on campus.
          </p>
        </div>

        <div className="lf-col">
          <h4>Elections</h4>
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
                <i className="fa-solid fa-user-tie" /> Candidate Login
              </button>
            </li>
            <li>
              <button className="lf-link" onClick={() => navigate('/login/admin')}>
                <i className="fa-solid fa-user-shield" /> Admin Login
              </button>
            </li>
          </ul>
        </div>

        <div className="lf-col">
          <h4>Contact</h4>
          <ul>
            <li>
              <a href="tel:+252906821920">
                <i className="fa-solid fa-phone" /> +252 90 682 1920
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
        © {new Date().getFullYear()} Puntland University of Science &amp; Technology. All rights reserved.
      </div>
    </footer>
  )
}
