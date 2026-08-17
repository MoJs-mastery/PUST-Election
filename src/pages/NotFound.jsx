import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="nf-page">
      <div className="nf-code">404</div>
      <h1>Ma Page ayaa laga waayay</h1>
      <p>Bogga aad raadinayso ma jiro ama waa la dhaqaaqiyay.</p>
      <Link to="/" className="nf-btn">
        <i className="fa-solid fa-house" /> Home
      </Link>
    </div>
  )
}
