import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../toast'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx'

export default function Departments() {
  const { showToast } = useToast()
  const [data, setData] = useState({ departments: [], total_departments: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [modal, setModal] = useState(null) // 'add' | 'edit' | null
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dName, setDName] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [
        { data: depts, error: err1 },
        { data: candidates, error: err2 },
        { data: votes, error: err3 }
      ] = await Promise.all([
        supabase.from('depadrments_depadrments_db').select('*').order('d_name'),
        supabase.from('musharax_musharax_db').select('id, m_depadrments_id'),
        supabase.from('codbixiye_codbixiye_db').select('*')
      ])

      if (err1) throw err1

      const deptsAggregated = (depts || []).map(d => {
        const cands = (candidates || []).filter(c => c.m_depadrments_id === d.id)
        const dVotes = (votes || []).filter(v => v.c_department_id === d.id)
        
        return {
          id: d.id,
          d_name: d.d_name,
          candidates_count: cands.length,
          total_voters: dVotes.length,
          male_voters: dVotes.filter(v => v.c_gender?.toLowerCase() === 'male' || v.c_gender?.toLowerCase() === 'lab').length,
          female_voters: dVotes.filter(v => v.c_gender?.toLowerCase() === 'female' || v.c_gender?.toLowerCase() === 'dhedig' || v.c_gender?.toLowerCase() === 'dhadig').length,
        }
      })

      setData({
        departments: deptsAggregated,
        total_departments: deptsAggregated.length
      })
    } catch (e) {
      showToast('error', 'Waa khalad, isku day markale.')
      setData({ departments: [], total_departments: 0 })
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return data.departments
    return data.departments.filter((d) => d.d_name.toLowerCase().includes(search.toLowerCase()))
  }, [data.departments, search])

  function openAdd() {
    setDName('')
    setEditing(null)
    setModal('add')
  }

  function openEdit(d) {
    setEditing(d)
    setDName(d.d_name)
    setModal('edit')
  }

  async function handleSave() {
    if (!dName.trim()) {
      showToast('warn', 'Magaca waaxda waa loo baahan yahay.')
      return
    }
    setSaving(true)
    
    try {
      if (modal === 'add') {
        // Do NOT include `id` — Supabase auto-generates it
        const { error } = await supabase.from('depadrments_depadrments_db').insert([{ d_name: dName.trim() }])
        if (error) throw error
        showToast('success', 'Waaxda waa la kudaray!')
      } else {
        // Do NOT include `id` in the update body
        const { error } = await supabase.from('depadrments_depadrments_db').update({ d_name: dName.trim() }).eq('id', editing.id)
        if (error) throw error
        showToast('success', 'Waaxda waa la cusbooneysiiyey!')
      }
      setModal(null)
      loadData()
    } catch (e) {
      showToast('error', e.message || 'Waa khalad, isku day markale.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    setSaving(true)
    try {
      const { error } = await supabase.from('depadrments_depadrments_db').delete().eq('id', deleteTarget.id)
      if (error) throw error
      showToast('success', 'Waaxda waa la tirtiray!')
      setDeleteTarget(null)
      loadData()
    } catch (e) {
      showToast('error', e.message || 'Waa khalad, isku day markale.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data.departments.length) {
    return (
      <div className="spinner-center">
        <i className="fa-solid fa-spinner fa-spin" />
      </div>
    )
  }

  const maxVoters = Math.max(0, ...data.departments.map((d) => d.total_voters))

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <i className="fa-solid fa-building-columns" /> Waaxaha (Departments)
          </h2>
          <p className="page-subtitle">Maamul waaxaha codbixinta nidaamka.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <i className="fa-solid fa-plus" /> Add Department
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <span className="badge indigo" style={{ background: 'rgba(73, 133, 196, 0.12)', color: 'var(--color-accent)' }}>
            <i className="fa-solid fa-building-columns" /> {data.total_departments ?? 0} departments
          </span>
        </div>
        <div className="toolbar-right">
          <div className="search-box">
            <i className="fa-solid fa-magnifying-glass" />
            <input placeholder="Search departments..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="section-card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Department</th>
                <th>Candidates</th>
                <th>Votes</th>
                <th>Male</th>
                <th>Female</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id}>
                  <td>{i + 1}</td>
                  <td>
                    <div className="avatar-row">
                      <div className="avatar-sm">
                        <i className="fa-solid fa-building" />
                      </div>
                      <span className="cell-main">{d.d_name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge purple">
                      <i className="fa-solid fa-user-tie" /> {d.candidates_count}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="progress-track" style={{ maxWidth: 80 }}>
                        <div
                          className="progress-fill"
                          style={{ width: `${maxVoters ? (d.total_voters / maxVoters) * 100 : 0}%` }}
                        />
                      </div>
                      <b>{d.total_voters}</b>
                    </div>
                  </td>
                  <td className="cell-main">
                    <i className="fa-solid fa-mars" style={{ color: 'var(--color-accent)', marginRight: 5 }} />
                    {d.male_voters}
                  </td>
                  <td className="cell-main">
                    <i className="fa-solid fa-venus" style={{ color: '#e879f9', marginRight: 5 }} />
                    {d.female_voters}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-xs btn-outline" onClick={() => openEdit(d)}>
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button className="btn btn-xs btn-danger" onClick={() => setDeleteTarget(d)}>
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
                      <i className="fa-solid fa-building-columns" />
                      <p>Waax lama helin.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal-container sm">
            <div className="modal-head">
              <h3>
                <i className={`fa-solid ${modal === 'add' ? 'fa-building-circle-plus' : 'fa-pen'}`} />
                {modal === 'add' ? 'Add Department' : `Edit — ${editing?.d_name}`}
              </h3>
              <button className="modal-x" onClick={() => setModal(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  Department Name <span>*</span>
                </label>
                <input
                  className="form-input"
                  value={dName}
                  onChange={(e) => setDName(e.target.value)}
                  placeholder="e.g. IT, Business..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-outline" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                {saving ? 'Saving...' : modal === 'add' ? 'Add Department' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete department?"
          description="Ma hubtaa inaad tirtirayso"
          itemName={deleteTarget.d_name}
          descriptionExtra="Musharixiinta ku xiran waxay noqon doonaan kuwo aan waax lahayn."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          saving={saving}
        />
      )}
    </div>
  )
}
