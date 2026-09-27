import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { supabase } from '../supabaseClient'
import CustomSelect from '../components/CustomSelect'

export default function Voting() {
  const [data, setData] = useState({ candidates: [], departments: [] })
  const [loading, setLoading] = useState(true)

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
    const fn = type === 'success' ? toast.success : type === 'warn' ? toast.warning : toast.error
    fn(message, { autoClose: 4000 })
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
      showVoteToast("")
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
      const { data: ok, error } = await supabase.rpc('validate_voting_code', {
        p_voting_code: voteId.trim().toUpperCase(),
      })

      if (error || !ok) {
        setIdState('err')
        setIdMsg('ID-gaagu waa khalad ama waa la isticmaalay.')
        showVoteToast('warn', 'ID-gaagu waa khalad ama waa la isticmaalay.')
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
      // 1. Server-side secure RPC: validates the code, locks it against
      //    double-spending, checks candidate + department, and records the
      //    vote + marks the code used in ONE transaction.
      const deptObj = data.departments.find(d => (d.d_name || d.name || d) === deptValue)
      const votePayload = {
        p_voting_code: upperId,
        p_candidate_id: selectedCandidate.id,
        p_department_id: deptObj?.id || deptValue,
        p_gender: genderValue,
      }

      let status
      const edgeUrl = import.meta.env.VITE_CAST_VOTE_URL
      if (edgeUrl) {
        // Rate-limited path: Supabase Edge Function (deploy per docs/SECURITY.md)
        const res = await fetch(edgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(votePayload),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(json.message || 'Khalad ayaa dhacay, isku day markale.')
        }
        status = json.ok === true ? 'ok' : (json.code || 'VOTE_FAILED')
      } else {
        const { data, error } = await supabase.rpc('cast_vote', votePayload)
        if (error) throw error
        status = data
      }

      if (status === 'ok') {
        setSubmitting(false)
        setSuccessCandidate(selectedCandidate.m_name || '')
        setConfirmModal(false)
        setSuccessModal(true)
        showVoteToast('success', `Waxaad u codeysay: ${selectedCandidate.m_name || ''}`)
        return
      }

      setSubmitting(false)
      setConfirmModal(false)
      setVoteModal(true)
      const statusMsg = {
        INVALID_VOTING_CODE: 'Vote ID-kagu kuma jiro nidaamka.',
        VOTING_CODE_ALREADY_USED: 'Vote ID-gaas horay ayaa loo isticmaalay.',
        INVALID_CANDIDATE: 'Musharaxa lama helin.',
        CANDIDATE_NOT_ALLOWED: 'Musharaxan cod laguma qaadi karo.',
        INVALID_DEPARTMENT: 'Waaxda (waxaha) lama helin.',
        INVALID_GENDER: 'Jinsiga lama aqoonsan.',
        VOTE_FAILED: 'Khalad ayaa dhacay, isku day markale.',
      }
      const msg = statusMsg[status] || 'Khalad ayaa dhacay, isku day markale.'
      setIdState('err')
      setIdMsg(msg)
      showVoteToast('error', msg)
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
