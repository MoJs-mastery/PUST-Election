import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import CustomSelect from '../components/CustomSelect'

export default function Voting() {
  const [data, setData] = useState({ candidates: [], departments: [] })
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [voteModal, setVoteModal] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)
  const [successModal, setSuccessModal] = useState(false)
  const [successCandidate, setSuccessCandidate] = useState('')

  const [voteId, setVoteId] = useState('')
  const [idState, setIdState] = useState('')
  const [idMsg, setIdMsg] = useState('')
  const [idVerified, setIdVerified] = useState(false)
  const [deptValue, setDeptValue] = useState('')
  const [genderValue, setGenderValue] = useState('')
  const [deptErr, setDeptErr] = useState(false)
  const [genderErr, setGenderErr] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadPublicData()
  }, [])

  async function loadPublicData() {
    setLoading(true)
    try {
      const [
        { data: candidates, error: err1 },
        { data: departments, error: err2 }
      ] = await Promise.all([
        supabase.from('musharax_musharax_db').select('*').order('id', { ascending: true }),
        supabase.from('depadrments_depadrments_db').select('*').order('d_name', { ascending: true })
      ])

      if (err1 || err2) throw (err1 || err2)

      const formattedCandidates = (candidates || [])
        .filter(c => c.m_if_allowed !== false)
        .map(c => ({ ...c }))

      setData({
        candidates: formattedCandidates,
        departments: departments || []
      })
    } catch (err) {
      showVoteToast('error', 'Waa khalad, isku day markale')
    } finally {
      setLoading(false)
    }
  }

  function showVoteToast(type, message) {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }

  function closeVoteModal() {
    setVoteModal(false)
    resetVoteFields()
  }

  function resetVoteFields() {
    setVoteId('')
    setIdState('')
    setIdMsg('')
    setIdVerified(false)
  }

  function handleIdInput(value) {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (cleaned !== value) {
      showVoteToast('warn', 'Fadlan soo geli tiro iyo xarfo kaliya.')
    }
    setVoteId(cleaned)
    setIdState('')
    setIdMsg('')
    setIdVerified(false)
  }

  async function verifyId() {
    if (!voteId.trim()) {
      resetVoteFields()
      return
    }
    setIdState('spin')
    setIdMsg('')
    try {
      const { data: vRecord, error } = await supabase
        .from('voiteid_id_db')
        .select('*')
        .eq('c_id', voteId.trim().toUpperCase())
        .maybeSingle()

      if (error || !vRecord) {
        setIdState('err')
        setIdMsg('Ma aha ID cod bixin oo sax ah.')
        showVoteToast('error', 'Ma aha ID cod bixin oo sax ah.')
        return
      }

      if (vRecord.is_used) {
        setIdState('err')
        setIdMsg('Codkii hore ayaa la adeegsaday.')
        showVoteToast('warn', 'Codkii hore ayaa la adeegsaday.')
        return
      }

      setIdState('ok')
      setIdVerified(true)
    } catch (err) {
      setIdState('err')
      showVoteToast('error', 'Waa khalad, isku day markale.')
    }
  }

  function openVoteModal(candidate) {
    setSelectedCandidate(candidate)
    resetVoteFields()
    setVoteModal(true)
  }

  function proceedToConfirm() {
    let hasErr = false
    if (!idVerified) {
      setIdState('err')
      setIdMsg('Xaqiiji ID-gaaga')
      hasErr = true
    }
    if (!deptValue) {
      setDeptErr(true)
      hasErr = true
    }
    if (!genderValue) {
      setGenderErr(true)
      hasErr = true
    }
    if (hasErr) return
    setVoteModal(false)
    setConfirmModal(true)
  }

  function selectAnother() {
    setConfirmModal(false)
    setVoteModal(true)
    resetVoteFields()
    showVoteToast('warn', 'Dooro musharax kale oo taabo badhanka "Codi".')
  }

  async function submitVote() {
    setSubmitting(true)
    const upperId = voteId.trim().toUpperCase()
    try {
      // 1. Atomically mark ID as used (prevents double-voting race condition)
      const { data: markedRows, error: markErr } = await supabase
        .from('voiteid_id_db')
        .update({ is_used: true })
        .eq('c_id', upperId)
        .eq('is_used', false)
        .select()

      if (markErr || !markedRows || markedRows.length === 0) {
        setSubmitting(false)
        setConfirmModal(false)
        setVoteModal(true)
        setIdState('err')
        setIdMsg('Vote ID is invalid or already used.')
        showVoteToast('error', 'Vote ID is invalid or already used.')
        return
      }

      // 2. Insert vote into codbixiye_codbixiye_db
      const deptObj = data.departments.find(d => (d.d_name || d.name || d) === deptValue)
      const votePayload = {
        c_id_id: upperId,
        c_musharax_id: selectedCandidate.id,
        c_department_id: deptObj?.id || deptValue,
        c_gender: genderValue,
      }
      const { error: voteErr } = await supabase
        .from('codbixiye_codbixiye_db')
        .insert([votePayload])

      if (voteErr) throw voteErr

      setSubmitting(false)
      setSuccessCandidate(selectedCandidate.m_name || '')
      setConfirmModal(false)
      setSuccessModal(true)
      showVoteToast('success', `Waxaad u codeysay: ${selectedCandidate.m_name || ''}`)
    } catch (err) {
      setSubmitting(false)
      setConfirmModal(false)
      setVoteModal(true)
      showVoteToast('error', err.message || 'Khalad ayaa dhacay, isku day markale.')
    }
  }

  function handleTxn() {
    window.location.reload()
  }

  function selectDept(dept) {
    setDeptValue(dept)
    setDeptErr(false)
  }

  function selectGender(gender) {
    setGenderValue(gender)
    setGenderErr(false)
  }

  if (loading) {
    return (
      <div className="vote-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="nav-chip">
          <i className="fa-solid fa-spinner fa-spin" /> Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="vote-page">
      <div className="vote-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`vote-toast ${t.type}`}>
            <i className={`fa-solid ${t.type === 'success' ? 'fa-circle-check' : t.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-xmark'}`} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      <nav className="navbar">
        <Link to="/" className="nav-brand" style={{ textDecoration: 'none', cursor: 'pointer', color: 'inherit' }}>
          <div className="nav-logo">
            <i className="fa-solid fa-check-to-slot" />
          </div>
          <span>PUST-Election</span>
        </Link>
        <div className="nav-stats">
          <Link to="/" className="nav-chip" style={{ textDecoration: 'none', background: 'rgba(40, 85, 206, 0.15)', color: 'var(--color-accent)', fontWeight: 600 }}>
            <i className="fa-solid fa-house" /> <span>Home</span>
          </Link>
          <Link to="/dashboard" className="nav-chip" style={{ textDecoration: 'none' }}>
            <i className="fa-solid fa-user-shield" /> <span>Admin</span>
          </Link>
          <div className="nav-chip">
            <i className="fa-solid fa-user-tie" /> <span>{data.candidates.length}</span>
          </div>
          <div className="nav-chip">
            <i className="fa-solid fa-users" /> <span>{data.departments.length}</span>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-badge">
          <span className="dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#2cb22b' }} />
          Cod bixin &nbsp;•&nbsp; 2026
        </div>
        <h1>Codee Musharaxaadka</h1>
        <p>Fadlan dooro musharaxa aad rabto inaad u codsato. Ka dibna xaqiiji ID-gaaga si codkaagu u dhaqangalo.</p>
      </header>

      <main className="container">
        <div className="section-label">
          <i className="fa-solid fa-user-tie" /> Musharixiinta &nbsp;({data.candidates.length})
        </div>
        <div className="candidates-grid">
          {data.candidates.map((c) => (
            <div className="cand-card" key={c.id}>
              <div className="cand-body">
                <div className="cand-avatar">
                  {c.m_image ? (
                    <img src={c.m_image} alt={c.m_name} />
                  ) : (
                    <div className="cand-placeholder">
                      <i className="fa-solid fa-user-tie" />
                    </div>
                  )}
                </div>
                <h3 className="cand-name">{c.m_name}</h3>
                <div className="cand-dept">
                  <i className="fa-solid fa-building-columns" />
                  {data.departments.find((d) => d.id === c.m_depadrments_id)?.d_name || ''}
                </div>
                <button className="btn-vote" onClick={() => openVoteModal(c)}>
                  <i className="fa-solid fa-check-to-slot" /> Codeeh
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* VOTE MODAL */}
      <div className={`overlay ${voteModal ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-head">
            <div className="modal-title">
              <i className="fa-solid fa-check-to-slot" /> Ucodeeh
            </div>
            <button className="btn-x" onClick={closeVoteModal}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="cand-mini">
            <div className="cand-mini-avatar">
              {selectedCandidate?.m_image ? (
                <img src={selectedCandidate.m_image} alt="" />
              ) : (
                <i className="fa-solid fa-user-tie" />
              )}
            </div>
            <div>
              <div className="cand-mini-name">{selectedCandidate?.m_name}</div>
              <div className="cand-mini-dept">
                {data.departments.find((d) => d.id === selectedCandidate?.m_depadrments_id)?.d_name || '—'}
              </div>
            </div>
          </div>

          <div className="fgroup">
            <label className="flabel">
              <i className="fa-solid fa-id-card" /> Voting ID
            </label>
            <div className="finput-wrap">
              <i className="ficon fa-solid fa-id-card" />
              <input
                type="text"
                className={`finput ${idState === 'err' ? 'err' : idState === 'ok' ? 'ok' : ''}`}
                placeholder="Geli Voting ID-gaaga"
                value={voteId}
                maxLength={8}
                onChange={(e) => handleIdInput(e.target.value)}
                onBlur={verifyId}
              />
              {idState === 'spin' && (
                <i className="id-status fa-solid fa-spinner fa-spin" style={{ color: 'var(--color-accent)' }} />
              )}
              {idState === 'ok' && (
                <i className="id-status fa-solid fa-circle-check" style={{ color: '#2cb22b' }} />
              )}
              {idState === 'err' && (
                <i className="id-status fa-solid fa-circle-xmark" style={{ color: '#ef4444' }} />
              )}
            </div>
            {idMsg && (
              <div className={`field-msg ${idState === 'ok' ? 'ok' : ''}`}>
                <i className={`fa-solid ${idState === 'ok' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} />
                {idMsg}
              </div>
            )}
          </div>

          <div className="fgroup">
            <label className="flabel">
              <i className="fa-solid fa-building-columns" /> Waaxdaada
            </label>
            <CustomSelect
              placeholder="Dooro waaxdaada"
              options={data.departments.map(d => typeof d === 'object' ? (d.d_name || d.name || d) : d)}
              value={deptValue}
              onSelect={selectDept}
              error={deptErr}
            />
          </div>

          <div className="fgroup">
            <label className="flabel">
              <i className="fa-solid fa-venus-mars" /> Jinsigaaga
            </label>
            <CustomSelect
              placeholder="Dooro jinsigaaga"
              options={['Male', 'Female']}
              value={genderValue}
              onSelect={selectGender}
              error={genderErr}
            />
          </div>

          <button className="btn-submit" onClick={proceedToConfirm}>
            <i className="fa-solid fa-arrow-right-to-bracket" /> Continue
          </button>
        </div>
      </div>

      {/* CONFIRM MODAL */}
      <div className={`overlay ${confirmModal ? 'active' : ''}`}>
        <div className="modal">
          <div className="confirm-icon">
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
          <h3 className="confirm-title">Xaqiiji Codkaaga</h3>
          <p className="confirm-sub">
            Ma hubtaa inaad ucodaynasoh
            <br />
            <span className="confirm-cand">{selectedCandidate?.m_name}</span>?
          </p>
          <div className="confirm-btns">
            <button className="btn-another" onClick={selectAnother}>
              <i className="fa-solid fa-repeat" />Ka laabo
            </button>
            <button className="btn-confirm-vote" onClick={submitVote} disabled={submitting}>
              <i className={`fa-solid ${submitting ? 'fa-spinner fa-spin' : 'fa-check'}`} /> {submitting ? 'Processing...' : 'Haa, Ucodee'}
            </button>
          </div>
        </div>
      </div>

      {/* SUCCESS MODAL */}
      <div className={`overlay ${successModal ? 'active' : ''}`}>
        <div className="modal">
          <div className="success-lottie">
            <i className="fa-solid fa-circle-check" />
          </div>
          <h3 className="success-title">Mahadsanid!</h3>
          <p className="success-sub">Codkaaga si guul leh ayaa loo dhaafsiyay</p>
          <div className="success-cand">
            <i className="fa-solid fa-user-tie" /> {successCandidate}
          </div>
          <button className="btn-done" onClick={handleTxn}>
            <i className="fa-solid fa-check" /> Done
          </button>
        </div>
      </div>
    </div>
  )
}
