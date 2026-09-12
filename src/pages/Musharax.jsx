import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../toast'
import { GENDER_LABEL } from '../utils'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx'
import CustomSelect from '../components/CustomSelect'

export default function Musharax() {
  const { showToast } = useToast()
  const [data, setData] = useState({ candidates: [], departments: [] })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  const [modal, setModal] = useState(null) // 'add' | 'edit' | null
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    m_name: '',
    m_email: '',
    m_gender: '',
    m_depadrments: '',
    m_image: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [
        { data: cands, error: err1 },
        { data: depts, error: err2 },
        { data: votes, error: err3 }
      ] = await Promise.all([
        supabase.from('musharax_musharax_db').select('*').order('id', { ascending: false }),
        supabase.from('depadrments_depadrments_db').select('*'),
        supabase.from('codbixiye_codbixiye_db').select('*')
      ])

      if (err1) throw err1

      const totalVotes = votes?.length || 0
      const totalMaleVotes = votes?.filter(v => v.c_gender?.toLowerCase() === 'male' || v.c_gender?.toLowerCase() === 'lab').length || 0
      const totalFemaleVotes = votes?.filter(v => v.c_gender?.toLowerCase() === 'female' || v.c_gender?.toLowerCase() === 'dhedig').length || 0

      // Map candidates
      let candidatesList = (cands || []).map(c => {
        const cVotes = (votes || []).filter(v => v.c_musharax_id === c.id)
        const vCount = cVotes.length
        const male = cVotes.filter(v => v.c_gender?.toLowerCase() === 'male' || v.c_gender?.toLowerCase() === 'lab').length
        const female = cVotes.filter(v => v.c_gender?.toLowerCase() === 'female' || v.c_gender?.toLowerCase() === 'dhedig').length

        // Dept stats for this candidate
        const deptVotes = {}
        cVotes.forEach(v => {
          const deptId = v.c_department_id
          if (deptId) deptVotes[deptId] = (deptVotes[deptId] || 0) + 1
        })
        const dept_stats = (depts || []).filter(d => deptVotes[d.id]).map(d => ({
          name: d.d_name,
          votes: deptVotes[d.id]
        }))

        return {
          id: c.id,
          m_name: c.m_name,
          m_email: c.m_email,
          m_gender: c.m_gender,
          dept_id: c.m_depadrments_id,
          dept_name: depts?.find(d => d.id === c.m_depadrments_id)?.d_name || 'Unknown',
          m_image: c.m_image,
          m_if_allowed: c.m_if_allowed,
          vote_count: vCount,
          vote_percentage: totalVotes ? ((vCount / totalVotes) * 100).toFixed(1) : 0,
          analytics: {
            total_votes: vCount,
            male,
            female,
            male_pct: vCount ? ((male / vCount) * 100).toFixed(1) : 0,
            female_pct: vCount ? ((female / vCount) * 100).toFixed(1) : 0,
            sys_male_pct: totalMaleVotes ? ((male / totalMaleVotes) * 100).toFixed(1) : 0,
            sys_female_pct: totalFemaleVotes ? ((female / totalFemaleVotes) * 100).toFixed(1) : 0,
            dept_stats
          }
        }
      })

      // Sort by vote count for ranking
      candidatesList.sort((a, b) => b.vote_count - a.vote_count)

      let maxVotes = 0
      candidatesList.forEach((c, index) => {
        c.rank = index + 1
        if (c.vote_count > maxVotes) maxVotes = c.vote_count
        c.is_winner = c.vote_count === maxVotes && c.vote_count > 0 && index === 0
      })

      setData({
        candidates: candidatesList,
        departments: depts || []
      })
    } catch (e) {
      showToast('error', 'Waa khalad, isku day markale.')
      setData({ candidates: [], departments: [] })
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let list = data.candidates
    if (filter !== 'all') list = list.filter((c) => c.m_gender === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) => c.m_name.toLowerCase().includes(q) || (c.m_email || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [data.candidates, filter, search])

  function openAdd() {
    setForm({ m_name: '', m_email: '', m_gender: '', m_depadrments: '', m_image: '' })
    setEditing(null)
    setModal('add')
  }

  function openEdit(c) {
    setEditing(c)
    setForm({
      m_name: c.m_name,
      m_email: c.m_email,
      m_gender: c.m_gender,
      m_depadrments: c.dept_id || '',
      m_image: c.m_image || '',
    })
    setModal('edit')
  }

  async function handleSave() {
    if (!form.m_name.trim() || !form.m_email.trim() || !form.m_gender || !form.m_depadrments) {
      showToast('warn', 'Fadlan buuxi dhammaan goobaha.')
      return
    }
    setSaving(true)

    // Build payload — never include `id` (auto-generated by Supabase)
    const payload = {
      m_name: form.m_name.trim(),
      m_email: form.m_email.trim(),
      m_gender: form.m_gender,
      m_depadrments_id: parseInt(form.m_depadrments),
      m_image: form.m_image.trim(),
    }
    if (modal === 'add') {
      payload.m_joined = new Date().toISOString()
    }

    try {
      if (modal === 'add') {
        const { error } = await supabase.from('musharax_musharax_db').insert([payload])
        if (error) throw error
        showToast('success', 'Musharax waa la kudaray!')
      } else {
        const { error } = await supabase.from('musharax_musharax_db').update(payload).eq('id', editing.id)
        if (error) throw error
        showToast('success', 'Musharax waa la cusbooneysiiyey!')
      }
      setModal(null)
      loadData()
    } catch (e) {
      showToast('error', e.message || 'Waa khalad, isku day markale.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAllow(c) {
    try {
      const { error } = await supabase.from('musharax_musharax_db').update({ m_if_allowed: !c.m_if_allowed }).eq('id', c.id)
      if (error) throw error
      showToast('success', 'Xaaladda waa la bedelay')
      loadData()
    } catch (e) {
      showToast('error', e.message || 'Waa khalad, isku day markale.')
    }
  }

  async function confirmDelete() {
    setSaving(true)
    try {
      const { error } = await supabase.from('musharax_musharax_db').delete().eq('id', deleteTarget.id)
      if (error) throw error
      showToast('success', 'Musharax waa la tirtiray')
      setDeleteTarget(null)
      loadData()
    } catch (e) {
      showToast('error', e.message || 'Waa khalad, isku day markale.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data.candidates.length) {
    return (
      <div className="spinner-center">
        <i className="fa-solid fa-spinner fa-spin" />
      </div>
    )
  }

  const maxVotes = Math.max(0, ...data.candidates.map((c) => c.vote_count))

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <i className="fa-solid fa-user-tie" /> Musharixiinta
          </h2>
          <p className="page-subtitle">Waxaad halkan ku maamuli kartaa dhammaan musharixiinta.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <i className="fa-solid fa-plus" /> Add Candidate
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="filter-pills">
            <button className={`filter-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              All ({data.candidates.length})
            </button>
            <button className={`filter-pill ${filter === 'lab' ? 'active' : ''}`} onClick={() => setFilter('lab')}>
              Male ({data.candidates.filter((c) => c.m_gender === 'lab').length})
            </button>
            <button className={`filter-pill ${filter === 'dhadig' ? 'active' : ''}`} onClick={() => setFilter('dhadig')}>
              Female ({data.candidates.filter((c) => c.m_gender === 'dhadig').length})
            </button>
          </div>
        </div>
        <div className="toolbar-right">
          <div className="search-box">
            <i className="fa-solid fa-magnifying-glass" />
            <input placeholder="Search candidates..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="section-card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Candidate</th>
                <th>Gender</th>
                <th>Department</th>
                <th>Votes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => setExpanded(expanded === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className={`rank-badge ${c.rank === 1 ? 'rank-1' : c.rank === 2 ? 'rank-2' : c.rank === 3 ? 'rank-3' : 'rank-other'}`}>
                      {c.rank}
                    </span>
                  </td>
                  <td>
                    <div className="avatar-row">
                      <div className="avatar-sm">
                        {c.m_image ? <img src={c.m_image} alt="" /> : <i className="fa-solid fa-user-tie" />}
                      </div>
                      <div>
                        <div className="cell-main">
                          {c.m_name} {c.is_winner && <i className="fa-solid fa-crown" style={{ color: '#f59e0b', marginLeft: 4 }} />}
                        </div>
                        <div className="cell-sub">{c.m_email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.m_gender === 'lab' ? 'blue' : 'purple'}`}>
                      <i className={`fa-solid ${c.m_gender === 'lab' ? 'fa-mars' : 'fa-venus'}`} /> {GENDER_LABEL[c.m_gender] || c.m_gender}
                    </span>
                  </td>
                  <td className="cell-main">{c.dept_name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="progress-track" style={{ maxWidth: 80 }}>
                        <div
                          className="progress-fill"
                          style={{ width: `${maxVotes ? (c.vote_count / maxVotes) * 100 : 0}%` }}
                        />
                      </div>
                      <b>{c.vote_count}</b>
                      <span className="cell-sub">({c.vote_percentage}%)</span>
                    </div>
                  </td>
                  <td>
                    {c.m_if_allowed ? (
                      <span className="badge green">
                        <i className="fa-solid fa-circle" style={{ fontSize: 6 }} /> Active
                      </span>
                    ) : (
                      <span className="badge red">
                        <i className="fa-solid fa-circle" style={{ fontSize: 6 }} /> Blocked
                      </span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-xs btn-outline" onClick={() => openEdit(c)} title="Edit">
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button
                        className={`btn btn-xs ${c.m_if_allowed ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleAllow(c)}
                        title={c.m_if_allowed ? 'Block' : 'Allow'}
                      >
                        <i className={`fa-solid ${c.m_if_allowed ? 'fa-ban' : 'fa-check'}`} />
                      </button>
                      <button className="btn btn-xs btn-danger" onClick={() => setDeleteTarget(c)} title="Delete">
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <i className="fa-solid fa-users" />
                      <p>Musharax laba helin.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytics drawer */}
      {expanded !== null &&
        (() => {
          const c = data.candidates.find((x) => x.id === expanded)
          if (!c) return null
          const a = c.analytics || {}
          const maxDept = Math.max(0, ...(a.dept_stats || []).map((d) => d.votes))
          return (
            <div className="section-card" style={{ marginTop: -10 }}>
              <div className="card-header">
                <h3>
                  <i className="fa-solid fa-chart-column" /> Analytics — {c.m_name}
                </h3>
                <span className="badge blue">{a.total_votes ?? 0} votes</span>
              </div>
              <div className="grid-2">
                <div>
                  <p className="cell-sub" style={{ marginBottom: 12 }}>
                    <b>Gender breakdown:</b>
                  </p>
                  <div className="dept-row">
                    <div className="dept-name">Male</div>
                    <div className="dept-bar-track">
                      <div
                        className="dept-bar-fill"
                        style={{ width: `${a.total_votes ? (a.male / a.total_votes) * 100 : 0}%`, background: 'linear-gradient(90deg,var(--color-accent),var(--color-accent-2))' }}
                      />
                    </div>
                    <div className="dept-count">{a.male ?? 0} ({a.male_pct ?? 0}%)</div>
                  </div>
                  <div className="dept-row">
                    <div className="dept-name">Female</div>
                    <div className="dept-bar-track">
                      <div
                        className="dept-bar-fill"
                        style={{ width: `${a.total_votes ? (a.female / a.total_votes) * 100 : 0}%`, background: 'linear-gradient(90deg,var(--color-accent-2),var(--color-accent-2))' }}
                      />
                    </div>
                    <div className="dept-count">{a.female ?? 0} ({a.female_pct ?? 0}%)</div>
                  </div>
                  <p className="cell-sub" style={{ marginTop: 12 }}>
                    <b>System share:</b> {a.sys_male_pct ?? 0}% of all male votes, {a.sys_female_pct ?? 0}% of all female votes.
                  </p>
                </div>
                <div>
                  <p className="cell-sub" style={{ marginBottom: 12 }}>
                    <b>Votes by department:</b>
                  </p>
                  {a.dept_stats?.length ? (
                    a.dept_stats.map((d) => (
                      <div className="dept-row" key={d.name}>
                        <div className="dept-name">{d.name}</div>
                        <div className="dept-bar-track">
                          <div className="dept-bar-fill" style={{ width: `${maxDept ? (d.votes / maxDept) * 100 : 0}%` }} />
                        </div>
                        <div className="dept-count">{d.votes}</div>
                      </div>
                    ))
                  ) : (
                    <p className="cell-sub">Wali wax coddad ah lama helin.</p>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

      {/* Add / Edit modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal-container wide">
            <div className="modal-head">
              <h3>
                <i className={`fa-solid ${modal === 'add' ? 'fa-user-plus' : 'fa-pen'}`} />
                {modal === 'add' ? 'Add New Candidate' : `Edit — ${editing?.m_name}`}
              </h3>
              <button className="modal-x" onClick={() => setModal(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Candidate Name <span>*</span>
                  </label>
                  <input
                    className="form-input"
                    value={form.m_name}
                    onChange={(e) => setForm({ ...form, m_name: e.target.value })}
                    placeholder="e.g. Axmed Cali"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Email <span>*</span>
                  </label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.m_email}
                    onChange={(e) => setForm({ ...form, m_email: e.target.value })}
                    placeholder="axmed@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Gender <span>*</span>
                  </label>
                  <CustomSelect
                    placeholder="Select gender"
                    options={[
                      { value: 'lab', label: 'Male' },
                      { value: 'dhadig', label: 'Female' },
                    ]}
                    value={form.m_gender}
                    onSelect={(val) => setForm({ ...form, m_gender: val })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Department <span>*</span>
                  </label>
                  <CustomSelect
                    placeholder="Select department"
                    options={data.departments.map((d) => ({ value: String(d.id), label: d.d_name }))}
                    value={form.m_depadrments}
                    onSelect={(val) => setForm({ ...form, m_depadrments: val })}
                  />
                </div>
                <div className="form-group full">
                  <label className="form-label">Image URL</label>
                  <input
                    className="form-input"
                    value={form.m_image}
                    onChange={(e) => setForm({ ...form, m_image: e.target.value })}
                    placeholder="https://..."
                  />
                  {form.m_image && (
                    <div style={{ marginTop: 8 }}>
                      <img className="preview-avatar" src={form.m_image} alt="preview" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-outline" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                {saving ? 'Saving...' : modal === 'add' ? 'Add Candidate' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete candidate?"
          description="Ma hubtaa inaad tirtirayso"
          itemName={deleteTarget.m_name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          saving={saving}
        />
      )}
    </div>
  )
}
