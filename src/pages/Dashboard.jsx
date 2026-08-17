import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const [
        { count: total_candidates },
        { count: total_ids },
        { count: used_ids },
        { count: total_departments },
        { data: all_votes },
        { data: all_candidates },
        { data: all_departments }
      ] = await Promise.all([
        supabase.from('musharax_musharax_db').select('*', { count: 'exact', head: true }),
        supabase.from('voiteid_id_db').select('*', { count: 'exact', head: true }),
        supabase.from('voiteid_id_db').select('*', { count: 'exact', head: true }).eq('is_used', true),
        supabase.from('depadrments_depadrments_db').select('*', { count: 'exact', head: true }),
        supabase.from('codbixiye_codbixiye_db').select('*').order('id', { ascending: false }),
        supabase.from('musharax_musharax_db').select('*'),
        supabase.from('depadrments_depadrments_db').select('*')
      ])

      const total_voters = all_votes?.length || 0
      const male_count = all_votes?.filter(v => v.c_gender?.toLowerCase() === 'male' || v.c_gender?.toLowerCase() === 'lab').length || 0
      const female_count = all_votes?.filter(v => v.c_gender?.toLowerCase() === 'female' || v.c_gender?.toLowerCase() === 'dhedig').length || 0
      const male_pct = total_voters ? (male_count / total_voters) * 100 : 0
      const female_pct = total_voters ? (female_count / total_voters) * 100 : 0

      // Leaderboard
      const voteCounts = {}
      all_votes?.forEach(v => {
        voteCounts[v.c_musharax_id] = (voteCounts[v.c_musharax_id] || 0) + 1
      })
      const leaderboard = (all_candidates || []).map(c => ({
        id: c.id,
        c_name: c.m_name,
        m_image: c.m_image,
        vote_count: voteCounts[c.id] || 0
      })).sort((a, b) => b.vote_count - a.vote_count)

      // Assign ranks (handle ties if needed, but simple index is fine)
      leaderboard.forEach((c, index) => {
        c.rank = index + 1
      })

      // Recent votes
      const recent_votes = (all_votes || []).slice(0, 5).map(v => {
        const candidate = all_candidates?.find(c => c.id === v.c_musharax_id)
        return {
          id: v.id,
          candidate_name: candidate?.m_name || 'Unknown',
          candidate_image: candidate?.m_image,
          vote_date: v.created_at || new Date().toISOString()
        }
      })

      // Dept stats
      const deptCounts = {}
      all_votes?.forEach(v => {
        const deptId = v.c_department_id
        if (deptId) deptCounts[deptId] = (deptCounts[deptId] || 0) + 1
      })
      const dept_stats = (all_departments || []).map(d => ({
        d_name: d.d_name,
        count: deptCounts[d.id] || 0
      })).sort((a, b) => b.count - a.count)

      setData({
        stats: {
          total_candidates: total_candidates || 0,
          total_voters: total_voters || 0,
          total_ids: total_ids || 0,
          used_ids: used_ids || 0,
          total_departments: total_departments || 0,
          male_count,
          female_count,
          male_pct,
          female_pct
        },
        leaderboard: leaderboard.filter(c => c.vote_count > 0).slice(0, 5),
        recent_votes,
        dept_stats
      })
    } catch (e) {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="spinner-center">
        <i className="fa-solid fa-spinner fa-spin" />
      </div>
    )
  }

  const s = data?.stats || {}

  const malePct = s.male_pct || 0
  const femalePct = s.female_pct || 0
  const ringStyle = {
    background: `conic-gradient(var(--color-accent) 0% ${malePct}%, var(--color-accent-2) ${malePct}% ${malePct + femalePct}%, rgba(255,255,255,0.08) ${malePct + femalePct}% 100%)`,
  }

  const stats = [
    { icon: 'fa-user-tie', cls: 'indigo', label: 'Total Candidates', value: s.total_candidates ?? 0 },
    { icon: 'fa-check-to-slot', cls: 'green', label: 'Total Votes', value: s.total_voters ?? 0 },
    { icon: 'fa-id-card', cls: 'purple', label: 'Voting IDs', value: s.total_ids ?? 0 },
    { icon: 'fa-building-columns', cls: 'amber', label: 'Departments', value: s.total_departments ?? 0 },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <i className="fa-solid fa-chart-pie" /> Dashboard
          </h2>
          <p className="page-subtitle">
            Soo dhawoow, <b>{user?.username || 'Admin'}</b>! Halkan waxaad ka arki kartaa warbixinta codbixinta.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {stats.map((st) => (
          <div className="stat-card" key={st.label}>
            <div className={`stat-icon ${st.cls}`}>
              <i className={`fa-solid ${st.icon}`} />
            </div>
            <div>
              <div className="stat-value">{st.value}</div>
              <div className="stat-label">{st.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Leaderboard */}
        <div className="section-card">
          <div className="card-header">
            <h3>
              <i className="fa-solid fa-ranking-star" /> Hogaanka (Leaderboard)
            </h3>
            <span className="badge blue">Top {data?.leaderboard?.length || 0}</span>
          </div>
          {data?.leaderboard?.length ? (
            data.leaderboard.map((c) => (
              <div className="leaderboard-item" key={c.id || c.c_name}>
                <span className={`rank-badge ${c.rank === 1 ? 'rank-1' : c.rank === 2 ? 'rank-2' : c.rank === 3 ? 'rank-3' : 'rank-other'}`}>
                  {c.rank}
                </span>
                <div className="avatar-row">
                  <div className="avatar-sm">
                    {c.m_image ? (
                      <img src={c.m_image} alt="" />
                    ) : (
                      <i className="fa-solid fa-user-tie" />
                    )}
                  </div>
                  <span className="lb-name">{c.c_name}</span>
                </div>
                <div className="lb-votes">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, (c.vote_count / (data.leaderboard[0]?.vote_count || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="vote-count-badge">{c.vote_count}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <i className="fa-solid fa-trophy" />
              <p>Wali musharix looma codeyn.</p>
            </div>
          )}
        </div>

        {/* Gender ratio */}
        <div className="section-card">
          <div className="card-header">
            <h3>
              <i className="fa-solid fa-venus-mars" /> Qeybta Jinsiga
            </h3>
            <span className="badge gray">Totaal {s.total_voters ?? 0} cod</span>
          </div>
          <div className="chart-ring-wrap">
            <div className="conic-ring" style={ringStyle}>
              <div className="ring-center">
                <div className="val">{s.total_voters ?? 0}</div>
                <div className="lbl">Codad</div>
              </div>
            </div>
            <div className="ring-legend">
              <div className="ring-legend-item">
                <span className="ring-dot" style={{ background: 'var(--color-accent)' }} />
                Male <b>{s.male_count ?? 0} ({malePct.toFixed(1)}%)</b>
              </div>
              <div className="ring-legend-item">
                <span className="ring-dot" style={{ background: 'var(--color-accent-2)' }} />
                Female <b>{s.female_count ?? 0} ({femalePct.toFixed(1)}%)</b>
              </div>
              <div className="ring-legend-item">
                <span className="ring-dot" style={{ background: 'rgba(255,255,255,0.15)' }} />
                <b style={{ color: '#f87171' }}>{s.total_ids - s.used_ids} ID waa la adeegsan</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent votes */}
      <div className="section-card">
        <div className="card-header">
          <h3>
            <i className="fa-solid fa-clock-rotate-left" /> Codad Dhowaan Lagu Daray
          </h3>
          <span className="badge green">Live</span>
        </div>
        {data?.recent_votes?.length ? (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Voter</th>
                  <th>Candidate</th>
                  <th>Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_votes.map((v, i) => (
                  <tr key={v.id}>
                    <td>{i + 1}</td>
                    <td className="cell-main">{v.id}</td>
                    <td>
                      <div className="avatar-row">
                        <div className="avatar-sm">
                          {v.candidate_image ? (
                            <img src={v.candidate_image} alt="" />
                          ) : (
                            <i className="fa-solid fa-user-tie" />
                          )}
                        </div>
                        <span className="cell-main">{v.candidate_name}</span>
                      </div>
                    </td>
                    <td>No date in DB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <i className="fa-solid fa-clock" />
            <p>Wali codad lama darin.</p>
          </div>
        )}
      </div>

      {/* Department stats */}
      <div className="section-card">
        <div className="card-header">
          <h3>
            <i className="fa-solid fa-building-columns" /> Codadka Waaxaha
          </h3>
          <span className="badge purple">{data?.dept_stats?.length || 0} waaxood</span>
        </div>
        {data?.dept_stats?.length ? (
          data.dept_stats.map((d) => {
            const max = Math.max(...data.dept_stats.map((x) => x.count))
            return (
              <div className="dept-row" key={d.d_name}>
                <div className="dept-name">
                  <i className="fa-solid fa-building" style={{ marginRight: 8, color: 'var(--color-accent)' }} />
                  {d.d_name}
                </div>
                <div className="dept-bar-track">
                  <div
                    className="dept-bar-fill"
                    style={{ width: `${max ? (d.count / max) * 100 : 0}%` }}
                  />
                </div>
                <div className="dept-count">{d.count} cod</div>
              </div>
            )
          })
        ) : (
          <div className="empty-state">
            <i className="fa-solid fa-building-columns" />
            <p>Wali codad looma darin waaxaha.</p>
          </div>
        )}
      </div>
    </div>
  )
}
