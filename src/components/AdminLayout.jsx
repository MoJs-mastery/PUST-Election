import { useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

const BASE_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'fa-chart-pie', end: true },
  { to: '/dashboard/codbixiye', label: 'Codbixiye', icon: 'fa-users' },
  { to: '/dashboard/musharax', label: 'Musharax', icon: 'fa-user-tie' },
  { to: '/dashboard/voiteid', label: 'Vote ID', icon: 'fa-id-card' },
  { to: '/dashboard/departments', label: 'Waxaha', icon: 'fa-building' },
]

export default function AdminLayout() {
  const { user, loading, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const NAV_ITEMS = user?.is_superuser
    ? [
        BASE_NAV_ITEMS[0],
        { to: '/dashboard/manageadmin', label: 'Manage Admin', icon: 'fa-user-shield' },
        ...BASE_NAV_ITEMS.slice(1),
      ]
    : BASE_NAV_ITEMS

  if (loading) {
    return (
      <div className="admin-loading">
        <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--color-accent)' }} />
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/dashboard/login" state={{ from: location }} replace />
  }

  return (
    <div className="admin-shell">
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <i className="fa-solid fa-check-to-slot logo-icon" />
          <h2>PUST-Election</h2>
        </div>

        <ul className="nav-links">
          {NAV_ITEMS.map((item) => (
            <li className="nav-item" key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                onClick={() => setMobileOpen(false)}
              >
                <i className={`fa-solid ${item.icon} nav-icon`} />
                <span className="nav-text">{item.label}</span>
                <span className="tooltip">{item.label}</span>
              </NavLink>
            </li>
          ))}
          <li className="nav-item">
            <Link to="/vote" className="nav-link" onClick={() => setMobileOpen(false)}>
              <i className="fa-solid fa-check-to-slot nav-icon" style={{ color: 'var(--color-accent-2)' }} />
              <span className="nav-text" style={{ color: 'var(--color-accent-2)' }}>
                Tag Codaynta
              </span>
              <span className="tooltip">Tag Codaynta</span>
            </Link>
          </li>
        </ul>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="header-left">
            <button className="toggle-btn sidebar-toggle-desktop" onClick={() => setCollapsed((c) => !c)}>
              <i className="fa-solid fa-bars-staggered" />
            </button>
            <button className="toggle-btn sidebar-toggle-mobile" onClick={() => setMobileOpen((o) => !o)}>
              <i className="fa-solid fa-bars" />
            </button>
            <Link to="/" className="top-brand" title="Back to Home">
              <i className="fa-solid fa-check-to-slot" />
              <b>PUST-Election</b>
            </Link>
          </div>

          <div className="header-right">
            <Link to="/" className="toggle-btn" title="Back to Home" aria-label="Back to Home">
              <i className="fa-solid fa-house" />
            </Link>
            <button className="toggle-btn">
              <i className="fa-regular fa-bell" />
            </button>
            <div className="user-profile">
              <div className="avatar">{(user.username || 'A').charAt(0).toUpperCase()}</div>
              <span>{user.username || 'Admin User'}</span>
              <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.8rem', color: 'var(--color-slate-400)' }} />
            </div>
            <button
              className="toggle-btn"
              title="Logout"
              aria-label="Logout"
              onClick={() => {
                logout()
                navigate('/')
              }}
              style={{ textDecoration: 'none' }}
            >
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </header>

        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
