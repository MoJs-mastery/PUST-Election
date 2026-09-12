import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../toast'
import { GENDER_LABEL } from '../utils'
import Pager from '../components/Pager.jsx'

const PER_PAGE = 50

export default function Codbixiye() {
  const { showToast } = useToast()
  const [data, setData] = useState({ voters: [], total_votes: 0, male_votes: 0, female_votes: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [filter, search])

  async function loadData() {
    setLoading(true)
    try {
      const [
        { data: votes, error: err1 },
        { data: cands, error: err2 },
        { data: depts, error: err3 }
      ] = await Promise.all([
        supabase.from('codbixiye_codbixiye_db').select('*').order('id', { ascending: false }),
        supabase.from('musharax_musharax_db').select('*'),
        supabase.from('depadrments_depadrments_db').select('*')
      ])

      if (err1) throw err1

      const candMap = {}
      ;(cands || []).forEach((c) => {
        candMap[c.id] = c.m_name
      })

      const deptMap = {}
      ;(depts || []).forEach((d) => {
        deptMap[d.id] = d.d_name
      })

      const voters = (votes || []).map((v) => {
        let rawGender = (v.c_gender || '').toLowerCase()
        let normGender = rawGender === 'male' || rawGender === 'lab' ? 'lab' : 'dhadig'
        return {
          id: v.id,
          vote_id: v.c_id_id || '',
          candidate: candMap[v.c_musharax_id] || `Candidate #${v.c_musharax_id}`,
          department: deptMap[v.c_department_id] || `Department #${v.c_department_id}`,
          gender: normGender,
        }
      })

      const maleCount = voters.filter((x) => x.gender === 'lab').length
      const femaleCount = voters.filter((x) => x.gender === 'dhadig').length

      setData({
        voters,
        total_votes: voters.length,
        male_votes: maleCount,
        female_votes: femaleCount,
      })
    } catch (err) {
      setData({ voters: [], total_votes: 0, male_votes: 0, female_votes: 0 })
      showToast('error', 'Waa khalad, isku day markale.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let list = data.voters
    if (filter !== 'all') list = list.filter((v) => v.gender === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (v) =>
          String(v.id).toLowerCase().includes(q) ||
          v.candidate.toLowerCase().includes(q) ||
          v.department.toLowerCase().includes(q)
      )
    }
    return list
  }, [data.voters, filter, search])

  if (loading && !data.voters.length) {
    return (
      <div className="spinner-center">
        <i className="fa-solid fa-spinner fa-spin" />
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <i className="fa-solid fa-users" /> Codbixiyeyaal
          </h2>
          <p className="page-subtitle">Liiska dhammaan dadka codkooda bixiyey.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon indigo">
            <i className="fa-solid fa-check-to-slot" />
          </div>
          <div>
            <div className="stat-value">{data.total_votes ?? 0}</div>
            <div className="stat-label">Total Votes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">
            <i className="fa-solid fa-mars" />
          </div>
          <div>
            <div className="stat-value">{data.male_votes ?? 0}</div>
            <div className="stat-label">Male Voters</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <i className="fa-solid fa-venus" />
          </div>
          <div>
            <div className="stat-value">{data.female_votes ?? 0}</div>
            <div className="stat-label">Female Voters</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="filter-pills">
            <button className={`filter-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              All ({data.voters.length})
            </button>
            <button className={`filter-pill ${filter === 'lab' ? 'active' : ''}`} onClick={() => setFilter('lab')}>
              Male ({data.voters.filter((v) => v.gender === 'lab').length})
            </button>
            <button className={`filter-pill ${filter === 'dhadig' ? 'active' : ''}`} onClick={() => setFilter('dhadig')}>
              Female ({data.voters.filter((v) => v.gender === 'dhadig').length})
            </button>
          </div>
        </div>
        <div className="toolbar-right">
          <div className="search-box">
            <i className="fa-solid fa-magnifying-glass" />
            <input placeholder="Search voter, candidate, department..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-outline" onClick={loadData} title="Refresh">
            <i className="fa-solid fa-rotate" />
          </button>
        </div>
      </div>

      <div className="section-card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Vote ID</th>
                <th>Candidate</th>
                <th>Department</th>
                <th>Gender</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((v, i) => (
                <tr key={v.id}>
                  <td>{(page - 1) * PER_PAGE + i + 1}</td>
                  <td className="cell-main" style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                    {v.vote_id || `#${v.id}`}
                  </td>
                  <td className="cell-main">{v.candidate}</td>
                  <td>{v.department}</td>
                  <td>
                    <span className={`badge ${v.gender === 'lab' ? 'blue' : 'purple'}`}>
                      <i className={`fa-solid ${v.gender === 'lab' ? 'fa-mars' : 'fa-venus'}`} /> {GENDER_LABEL[v.gender] || v.gender}
                    </span>
                  </td>
                  <td className="cell-sub">#{v.id}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <i className="fa-solid fa-users" />
                      <p>Wax codbixiye ah lama helin.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <Pager page={page} totalPages={totalPages} onPage={setPage} total={filtered.length} pageSize={PER_PAGE} />
        )}
      </div>
    </div>
  )
}
