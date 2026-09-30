import { Link } from 'react-router-dom'
import SiteFooter from '../components/SiteFooter'

export default function NotFound() {
  return (
    <div className="page-with-footer">
      <div className="nf-page">
        <div className="nf-code">404</div>
        <h1>Ma Page ayaa la waayay</h1>
        <p>Bogga aad raadinayso ma jiro ama waa la dhaqaaqiyay.</p>
        <Link to="/" className="nf-btn">
          <i className="fa-solid fa-house" /> Home
        </Link>
      </div>
      <SiteFooter />
    </div>
  )
}
