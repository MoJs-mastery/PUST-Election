import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx'
import { formatDateTime } from '../utils'

export default function ManageAdmin() {
  const { user, is_superuser } = useAuth()
  const { showToast } = useToast()
  const [data, setData] = useState({ admins: [] })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [modal, setModal] = useState(null) // 'add' | 'edit' | null
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  if (user && !is_superuser) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <h3>Ma haysato ogolaansho</h3>
        <p>Kaliya superuser ayaa maamuli kara admin-ka.</p>
      </div>
    )
  }

  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    is_superuser: false,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Fetch admins from Supabase profiles or fallback current active session admin
      const { data: profiles, error } = await supabase.from('profiles').select('*')
      if (error || !profiles || !profiles.length) {
        // Return current user as primary admin
        setData({
          admins: [
            {
              id: user?.id || 1,
              username: user?.username || 'admin',
              email: user?.email || '',
              first_name: 'Admin',
              last_name: 'User',
              is_superuser: true,
              date_joined: new Date().toISOString(),
            },
          ],
        })
      } else {
        setData({ admins: profiles })
      }
    } catch {
      setData({
        admins: [
          {
            id: user?.id || 1,
            username: user?.username || 'admin',
            email: user?.email || 'admin@pelection.com',
            first_name: 'Admin',
            last_name: 'User',
            is_superuser: true,
            date_joined: new Date().toISOString(),
          },
        ],
      })
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return data.admins
    const q = search.toLowerCase()
    return data.admins.filter(
      (a) =>
        (a.username || '').toLowerCase().includes(q) ||
        (a.first_name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q)
    )
  }, [data.admins, search])

  function openAdd() {
    setForm({ username: '', email: '', first_name: '', last_name: '', password: '', is_superuser: false })
    setEditing(null)
    setModal('add')
  }

  function openEdit(a) {
    setEditing(a)
    setForm({
      username: a.username,
      email: a.email || '',
      first_name: a.first_name || '',
      last_name: a.last_name || '',
      password: '',
      is_superuser: Boolean(a.is_superuser),
    })
    setModal('edit')
  }

  async function handleSave() {
    if (!form.username.trim()) {
      showToast('warn', 'Username waa loo baahan yahay.')
      return
    }
    if (modal === 'add' && !form.password) {
      showToast('warn', 'Password waa loo baahan yahay.')
      return
    }
    setSaving(true)
    try {
      if (modal === 'add') {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: form.email.trim() || `${form.username.trim()}@pelection.com`,
          password: form.password,
          options: {
            data: {
              username: form.username.trim(),
              first_name: form.first_name,
              last_name: form.last_name,
              is_superuser: form.is_superuser,
            },
          },
        })
        if (signUpErr) throw signUpErr
        
        if (signUpData?.user) {
          const { error: profileErr } = await supabase.from('profiles').insert([{
            id: signUpData.user.id,
            username: form.username.trim(),
            email: form.email.trim() || `${form.username.trim()}@pelection.com`,
            first_name: form.first_name,
            last_name: form.last_name,
            is_superuser: form.is_superuser
          }])
          if (profileErr) throw profileErr
        }
        
        showToast('success', 'Admin cusub waa la meel mariyay.')
      } else {
        const { error: updateErr } = await supabase.from('profiles').update({
          username: form.username.trim(),
          email: form.email.trim() || `${form.username.trim()}@pelection.com`,
          first_name: form.first_name,
          last_name: form.last_name,
          is_superuser: form.is_superuser
        }).eq('id', editing.id)
        if (updateErr) throw updateErr
        
        showToast('success', 'Admin-ka waa la cusboonaysiiyay.')
      }
      setModal(null)
      loadData()
    } catch (err) {
      showToast('error', err.message || 'Waa khalad, isku day markale.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { error: delErr } = await supabase.from('profiles').delete().eq('id', deleteTarget.id)
      if (delErr) throw delErr
      
      showToast('success', 'Admin-ka waa la tirtiray.')
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      showToast('error', err.message || 'Waa khalad, isku day markale.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data.admins.length) {
    return (
      <div className="spinner-center">
        <i className="fa-solid fa-spinner fa-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <i className="fa-solid fa-user-shield" /> Manage Admins
          </h2>
          <p className="page-subtitle">Maamul dhammaan admin-ka nidaamka.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <i className="fa-solid fa-plus" /> Add Admin
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon indigo">
            <i className="fa-solid fa-users-gear" />
          </div>
          <div>
            <div className="stat-value">{data.admins?.length ?? 0}</div>
            <div className="stat-label">Total Admins</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <i className="fa-solid fa-crown" />
          </div>
          <div>
            <div className="stat-value">{data.admins?.filter(a => a.is_superuser).length ?? 0}</div>
            <div className="stat-label">Superusers</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan">
            <i className="fa-solid fa-user-tie" />
          </div>
          <div>
            <div className="stat-value">{data.admins?.filter(a => !a.is_superuser).length ?? 0}</div>
            <div className="stat-label">Staff</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left" />
        <div className="toolbar-right">
          <div className="search-box">
            <i className="fa-solid fa-magnifying-glass" />
            <input placeholder="Search admins..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="section-card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Admin</th>
                <th>Role</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const isSelf = user?.id === a.id
                return (
                  <tr key={a.id}>
                    <td>{i + 1}</td>
                    <td>
                      <div className="avatar-row">
                        <div className="avatar-sm">
                          <i className="fa-solid fa-user-shield" />
                        </div>
                        <div>
                          <div className="cell-main">
                            {a.username} {isSelf && <span className="badge blue" style={{ marginLeft: 6 }}>You</span>}
                          </div>
                          <div className="cell-sub">
                            {[a.first_name, a.last_name].filter(Boolean).join(' ') || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {a.is_superuser ? (
                        <span className="badge amber">
                          <i className="fa-solid fa-crown" /> Superuser
                        </span>
                      ) : (
                        <span className="badge gray">Staff</span>
                      )}
                    </td>
                    <td>{a.email || '—'}</td>
                    <td>{formatDateTime(a.date_joined)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-xs btn-outline" onClick={() => openEdit(a)}>
                          <i className="fa-solid fa-pen" />
                        </button>
                        {!isSelf && (
                          <button className="btn btn-xs btn-danger" onClick={() => setDeleteTarget(a)}>
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <i className="fa-solid fa-user-shield" />
                      <p>Admin lama helin.</p>
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
          <div className="modal-container wide">
            <div className="modal-head">
              <h3>
                <i className={`fa-solid ${modal === 'add' ? 'fa-user-plus' : 'fa-pen'}`} />
                {modal === 'add' ? 'Add New Admin' : `Edit — ${editing?.username}`}
              </h3>
              <button className="modal-x" onClick={() => setModal(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Username <span>*</span>
                  </label>
                  <input
                    className="form-input"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="username"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="admin@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    className="form-input"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    className="form-input"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {modal === 'edit' ? 'New Password (optional)' : 'Password'} {modal === 'add' && <span>*</span>}
                  </label>
                  <input
                    className="form-input"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={modal === 'edit' ? 'Leave empty to keep current' : 'Password'}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Superuser</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6 }}>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={form.is_superuser}
                        onChange={(e) => setForm({ ...form, is_superuser: e.target.checked })}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <span className="cell-sub">
                      {form.is_superuser ? 'Grant full superuser access' : 'Staff (limited access)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-outline" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                {saving ? 'Saving...' : modal === 'add' ? 'Add Admin' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Remove admin?"
          description="Ma hubtaa inaad saarayso"
          itemName={deleteTarget.username}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          saving={saving}
          confirmIcon="fa-user-slash"
          confirmLabel="Remove"
        />
      )}
    </div>
  )
}
