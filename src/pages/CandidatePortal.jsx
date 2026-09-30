import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import SiteFooter from '../components/SiteFooter'
import { GENDER_LABEL } from '../utils'

const ALLOWED_IMAGE = /^https:\/\//i

export default function CandidatePortal() {
  const { user, is_superuser, logout } = useAuth()
  const navigate = useNavigate()

  const [state, setState] = useState({ status: 'loading' })
  const [votes, setVotes] = useState([])
  const [depts, setDepts] = useState([])

  useEffect(() => {
    if (!user) return
    let active = true

    ;(async () => {
      const [{ data: cand, error: err1 }, { data: deptList, error: err2 }] = await Promise.all([
        supabase.from('musharax_musharax_db').select('*').eq('auth_id', user.id).maybeSingle(),
        supabase.from('depadrments_depadrments_db').select('id, d_name').order('d_name'),
      ])

      if (!active) return
      if (err1 || err2 || !cand) {
        setState({ status: 'no_candidate' })
        return
      }

      const { data: myVotes, error: err3 } = await supabase
        .from('codbixiye_codbixiye_db')
        .select('id, c_gender, c_department_id')
        .eq('c_musharax_id', cand.id)
      if (!active) return
      if (err3) {
        setState({ status: 'no_candidate' })
        return
      }

      setVotes(myVotes || [])
      setDepts(deptList || [])
      setState({ status: 'ready', candidate: cand })
    })()

    return () => {
      active = false
    }
  }, [user])

  const stats = useMemo(() => {
    if (!votes.length) return { total: 0, male: 0, female: 0 }
    return votes.reduce(
      (acc, v) => {
        const g = (v.c_gender || '').toLowerCase()
        if (g === 'male' || g === 'lab') acc.male++
        else acc.female++
        acc.total++
        return acc
      },
      { total: 0, male: 0, female: 0 }
    )
  }, [votes])

  const byDept = useMemo(() => {
    const map = new Map()
    votes.forEach((v) => {
      map.set(v.c_department_id, (map.get(v.c_department_id) || 0) + 1)
    })
    return [...map.entries()]
      .map(([id, count]) => ({
        name: (depts.find((d) => d.id === id) || {}).d_name || 'Unknown',
        count,
      }))
      .sort((a, b) => b.count - a.count)
  }, [votes, depts])

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (is_superuser) {
    return <Navigate to="/dashboard" replace />
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page-with-footer">
    <div className="login-page" style={{ overflowY: 'auto' }}>
      <div className="login-card" style={{ width: 'min(640px, 92vw)', maxWidth: 640 }}>
        <Link to="/" className="login-logo" title="Back to Home" aria-label="PUST Elections — back to home">
          <i className="fa-solid fa-chart-simple" />
        </Link>
        <h1>PUST Elections</h1>
        <p className="login-sub">Codadkii Musharaxa</p>

        {state.status === 'loading' && (
          <div className="cand-portal-center">
            <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--color-accent)', fontSize: 24 }} />
            &nbsp; Loading...
          </div>
        )}

        {state.status === 'no_candidate' && (
          <div className="cand-portal-center">
            <p>Akaunkaaga wax looqaba ma xidhin musharax. La xiriir maamulka.</p>
            <button className="btn login-btn-style" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket" /> Logout
            </button>
          </div>
        )}

        {state.status === 'ready' && state.candidate && (
          <div className="cand-portal">
            <div className="cand-portal-profile">
              {state.candidate.m_image && ALLOWED_IMAGE.test(state.candidate.m_image) ? (
                <img src={state.candidate.m_image} alt={state.candidate.m_name} className="cand-portal-avatar" />
              ) : (
                <div className="cand-portal-avatar cand-portal-avatar-fallback">
                  <i className="fa-solid fa-user-tie" />
                </div>
              )}
              <div>
                <h2>{state.candidate.m_name}</h2>
                <p className="cand-portal-email">{state.candidate.m_email}</p>
                <span className={`badge ${state.candidate.m_gender === 'lab' ? 'blue' : 'purple'}`}>
                  <i className={`fa-solid ${state.candidate.m_gender === 'lab' ? 'fa-mars' : 'fa-venus'}`} />{' '}
                  {GENDER_LABEL[state.candidate.m_gender] || state.candidate.m_gender}
                </span>{' '}
                <span className={`badge ${state.candidate.m_if_allowed ? 'green' : 'red'}`}>
                  <i className={`fa-solid ${state.candidate.m_if_allowed ? 'fa-circle-check' : 'fa-circle-xmark'}`} />{' '}
                  {state.candidate.m_if_allowed ? 'Active' : 'Blocked'}
                </span>
              </div>
            </div>

            <div className="cand-portal-stats">
              <div className="stat-card">
                <div className="stat-label">Codkagga (Votes)</div>
                <div className="stat-value">{stats.total}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Ragga (Male)</div>
                <div className="stat-value" style={{ color: 'var(--color-accent)' }}>{stats.male}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Dumarka (Female)</div>
                <div className="stat-value" style={{ color: '#b45309' }}>{stats.female}</div>
              </div>
            </div>

            {byDept.length > 0 && (
              <div className="cand-portal-dept">
                <h3>Codka Waxaha (by Department)</h3>
                {byDept.map((d) => (
                  <div className="cand-portal-dept-row" key={d.name}>
                    <span>{d.name}</span>
                    <div className="cand-portal-dept-bar">
                      <div
                        style={{
                          width: `${Math.max((d.count / stats.total) * 100, d.count > 0 ? 4 : 0)}%`,
                        }}
                      />
                    </div>
                    <b>{d.count}</b>
                  </div>
                ))}
              </div>
            )}

            <div className="cand-portal-actions">
              <button className="btn btn-outline" onClick={() => navigate('/')}>
                <i className="fa-solid fa-house" /> Home
              </button>
              <button className="btn login-btn-style" onClick={handleLogout}>
                <i className="fa-solid fa-right-from-bracket" /> Logout
              </button>
            </div>

            <p className="login-footer">
              <i className="fa-solid fa-shield-halved" /> Kaliya waxaa laguu tusinayaa codadkaaga gaarka ah
            </p>
          </div>
        )}
      </div>
    </div>
    <SiteFooter />
    </div>
  )
}
