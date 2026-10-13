import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

const BASE_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'fa-chart-pie', end: true },
  { to: '/dashboard/codbixiye', label: 'Codbixiye', icon: 'fa-users' },
  { to: '/dashboard/musharax', label: 'Musharax', icon: 'fa-user-tie' },
  { to: '/dashboard/voiteid', label: 'Vote ID', icon: 'fa-id-card' },
  { to: '/dashboard/students', label: 'Students', icon: 'fa-user-graduate' },
  { to: '/dashboard/departments', label: 'Waxaha', icon: 'fa-building' },
]

export default function AdminLayout() {
  const { user, is_superuser, superUserChecked, loading, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  const initials = useMemo(() => {
    const raw = user?.username || user?.email || 'A'
    const parts = raw.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
    if (!parts.length) return 'A'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }, [user])

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/')
  }

  const NAV_ITEMS = is_superuser
    ? [
        BASE_NAV_ITEMS[0],
        { to: '/dashboard/manageadmin', label: 'Manage Admin', icon: 'fa-user-shield' },
        ...BASE_NAV_ITEMS.slice(1),
      ]
    : BASE_NAV_ITEMS

  if (loading || !superUserChecked) {
    return (
      <div className="admin-loading">
        <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--color-accent)' }} />
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login/admin" state={{ from: location }} replace />
  }

  if (!is_superuser) {
    return (
      <div className="no-access-screen">
        <div className="no-access-card">
          <span className="no-access-pill">
            <i className="fa-solid fa-lock" /> 403 / Forbidden
          </span>
          <div className="no-access-icon">
            <i className="fa-solid fa-user-shield" />
          </div>
          <h2>Ma ogola</h2>
          <p className="no-access-msg">
            Account-kaagu ma leh ogolaansho maamul — meeshan ma ka gali kartid.
          </p>
          <p className="no-access-hint">Haddii aad u baahan tahay gacan, la xiriir maamulka ururka.</p>
          <div className="no-access-actions">
            <Link to="/" className="btn btn-primary">
              <i className="fa-solid fa-house" /> Bogga Hore
            </Link>
            <button
              className="btn btn-outline"
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              <i className="fa-solid fa-right-from-bracket" /> Dib u gal
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src="/pust-logo-ref.png" alt="PUST Logo" className="sidebar-logo-img" />
          <h2>PUST Elections</h2>
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
                <span className="tooltip" aria-hidden="true">{item.label}</span>
              </NavLink>
            </li>
          ))}
          <li className="nav-item">
            <Link to="/vote" className="nav-link" onClick={() => setMobileOpen(false)}>
              <i className="fa-solid fa-check-to-slot nav-icon" style={{ color: 'var(--color-accent-2)' }} />
              <span className="nav-text" style={{ color: 'var(--color-accent-2)' }}>
                Tag Codaynta
              </span>
              <span className="tooltip" aria-hidden="true">Tag Codaynta</span>
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
              <img src="/pust-logo-ref.png" alt="PUST Logo" className="top-brand-logo-img" />
              <b>PUST Elections</b>
            </Link>
          </div>

          <div className="header-right">
            <Link to="/" className="toggle-btn" title="Back to Home" aria-label="Back to Home">
              <i className="fa-solid fa-house" />
            </Link>
            <button className="toggle-btn" title="Notifications" aria-label="Notifications">
              <i className="fa-regular fa-bell" />
            </button>

            <div className="user-menu" ref={menuRef}>
              <button
                className="user-menu-trigger"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <div className="avatar">{initials}</div>
                <span className="user-menu-meta">
                  <span className="user-name">{user.username || 'Admin'}</span>
                  <span className="user-role">{is_superuser ? 'Super Admin' : 'Admin'}</span>
                </span>
                <i className={`fa-solid fa-chevron-down chevron${menuOpen ? ' open' : ''}`} />
              </button>

              {menuOpen && (
                <div className="user-dropdown" role="menu">
                  <div className="user-dropdown-head">
                    <div className="avatar lg">{initials}</div>
                    <div className="user-dropdown-id">
                      <b>{user.username || 'Admin'}</b>
                      <span>{user.email || '—'}</span>
                    </div>
                  </div>
                  <div className="user-dropdown-links">
                    <button role="menuitem" onClick={() => { setMenuOpen(false); navigate('/dashboard') }}>
                      <i className="fa-solid fa-gauge-high" /> Dashboard
                    </button>
                    <button role="menuitem" onClick={() => { setMenuOpen(false); navigate('/dashboard/manageadmin') }}>
                      <i className="fa-solid fa-user-shield" /> Manage Admin
                    </button>
                    <button role="menuitem" onClick={() => { setMenuOpen(false); navigate('/') }}>
                      <i className="fa-solid fa-house" /> Bogga Hore
                    </button>
                  </div>
                  <div className="user-dropdown-foot">
                    <button className="logout" role="menuitem" onClick={handleLogout}>
                      <i className="fa-solid fa-right-from-bracket" /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

