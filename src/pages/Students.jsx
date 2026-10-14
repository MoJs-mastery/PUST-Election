import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../toast'
import { formatDateTime } from '../utils'
import Pager from '../components/Pager.jsx'
import CustomSelect from '../components/CustomSelect.jsx'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx'
import {
  rowsFromMatrix,
  validateRows,
  reasonLabel,
  sanitizeSearchTerm,
} from '../studentsImport'

const PAGE_SIZES = [10, 25, 50, 100]

const PICK_FIELDS = [
  { key: 'student_name', label: 'Student Name (Magaca)' },
  { key: 'department', label: 'Department (Waaxda)' },
  { key: 'semester', label: 'Semester' },
]

function isMigrationError(message) {
  return /student_name|student_department_id|semester|students_stats|column|function|does not exist|schema cache/i.test(
    message || ''
  )
}

export default function Students() {
  const { showToast } = useToast()
  const [students, setStudents] = useState([])
  const [count, setCount] = useState(0)
  const [departments, setDepartments] = useState([])
  const [serverStats, setServerStats] = useState({ total: 0, voted: 0, not_voted: 0, departments: 0 })
  const [loading, setLoading] = useState(true)
  const [bootDone, setBootDone] = useState(false)
  const [migrationMissing, setMigrationMissing] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)

  const [importOpen, setImportOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rawRows, setRawRows] = useState([])
  const [parseError, setParseError] = useState('')
  const [rawMatrix, setRawMatrix] = useState(null)
  const [pick, setPick] = useState({ student_name: -1, department: -1, semester: -1 })
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState(null)
  const fileRef = useRef(null)

  const [editStudent, setEditStudent] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(null) // 'students' | 'usedIds'
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const deptName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.d_name])),
    [departments]
  )

  const systemDeptNames = useMemo(() => departments.map((d) => d.d_name), [departments])

  const { valid: parsedRows, invalid: issues } = useMemo(
    () => validateRows(rawRows, systemDeptNames),
    [rawRows, systemDeptNames]
  )

  const [addingDepts, setAddingDepts] = useState(false)

  const missingDepts = useMemo(() => {
    return [
      ...new Set(
        issues
          .filter((r) => r.reason === 'department_not_found' && r.department)
          .map((r) => r.department)
      ),
    ]
  }, [issues])

  async function handleAddMissingDepartments() {
    if (!missingDepts.length) return
    setAddingDepts(true)
    try {
      const records = missingDepts.map((d_name) => ({ d_name: d_name.trim() }))
      const { error } = await supabase.from('depadrments_depadrments_db').insert(records)
      if (error) throw error
      showToast('success', `${records.length} waaxood ayaa lagu daray nidaamka.`)
      await loadDepartments()
    } catch (err) {
      showToast('error', err.message || 'Khalad ayaa dhacay ku darista waaxyaha.')
    } finally {
      setAddingDepts(false)
    }
  }

  useEffect(() => {
    loadDepartments()
    loadStats()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, deptFilter, debouncedSearch])

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    function onEsc(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  async function loadDepartments() {
    const { data, error } = await supabase
      .from('depadrments_depadrments_db')
      .select('id, d_name')
      .order('d_name')
    if (!error && data) {
      setDepartments(data)
    }
  }

  async function loadStats() {
    const { data, error } = await supabase.rpc('students_stats')
    if (error) {
      if (isMigrationError(error.message)) setMigrationMissing(true)
      return
    }
    if (data) {
      setServerStats({
        total: Number(data.total) || 0,
        voted: Number(data.voted) || 0,
        not_voted: Number(data.not_voted) || 0,
        departments: Number(data.departments) || 0,
      })
    }
  }

  async function loadPage() {
    setLoading(true)
    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('voiteid_id_db')
        .select('*', { count: 'exact' })
        .not('student_name', 'is', null)
        .order('id', { ascending: false })
        .range(from, to)

      if (statusFilter === 'used') query = query.eq('is_used', true)
      else if (statusFilter === 'unused') query = query.not('is_used', 'is', true)

      if (deptFilter !== 'all') query = query.eq('student_department_id', deptFilter)

      const term = sanitizeSearchTerm(debouncedSearch)
      if (term) query = query.or(`student_name.ilike.%${term}%,c_id.ilike.%${term}%`)

      const { data: rows, count: total, error } = await query
      if (error) throw error

      const formatted = (rows || []).map((r) => ({
        id: r.id,
        c_id: r.c_id,
        is_used: Boolean(r.is_used),
        student_name: r.student_name || '',
        department_id: r.student_department_id ?? null,
        semester: r.semester || '',
        created_at: r.c_created_at || r.created_at,
      }))

      const totalCount = total ?? 0
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      if (page > totalPages) {
        setPage(totalPages)
        return
      }

      setStudents(formatted)
      setCount(totalCount)
      setMigrationMissing(false)
    } catch (err) {
      if (isMigrationError(err.message)) {
        setMigrationMissing(true)
      } else {
        showToast('error', err.message || 'Waa khalad, isku day markale.')
      }
      setStudents([])
      setCount(0)
    } finally {
      setLoading(false)
      setBootDone(true)
    }
  }

  function refresh() {
    loadStats()
    loadPage()
  }

  function resetImport() {
    setFileName('')
    setRawRows([])
    setParseError('')
    setRawMatrix(null)
    setPick({ student_name: -1, department: -1, semester: -1 })
    setReport(null)
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function openImport() {
    resetImport()
    setImportOpen(true)
  }

  function reparsePicked() {
    if (!rawMatrix) return
    const forced = {}
    if (pick.student_name >= 0) forced.student_name = pick.student_name
    if (pick.department >= 0) forced.department = pick.department
    if (pick.semester >= 0) forced.semester = pick.semester

    const { rows, missing } = rowsFromMatrix(rawMatrix, forced)
    if (missing.length || !rows.length) {
      const missingLabels = missing.map((m) =>
        m === 'name' ? 'Student Name' : m === 'department' ? 'Department' : m
      )
      showToast('warn', `Wali ma la heli karo tiirka: ${missingLabels.join(', ')} — dooro tiirka saxda ah.`)
      return
    }

    setRawRows(rows)
    setParseError('')
    setRawMatrix(null)
  }

  function pickerOptions(matrix) {
    if (!matrix) return []
    const colCount = matrix.reduce((m, r) => Math.max(m, (r || []).length), 0)
    return Array.from({ length: colCount }, (_, idx) => {
      const header = String(matrix[0]?.[idx] ?? '').trim()
      let sample = ''
      for (let i = 1; i < Math.min(matrix.length, 6); i++) {
        const v = String(matrix[i]?.[idx] ?? '').trim()
        if (v) {
          sample = v.length > 24 ? `${v.slice(0, 24)}...` : v
          break
        }
      }
      const label = header
        ? `#${idx + 1} — ${header}`
        : `#${idx + 1}${sample ? ` — e.g. "${sample}"` : ''}`
      return { value: idx, label }
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    resetImport()
    setFileName(file.name)

    try {
      // Lazy-loaded so the ~1MB spreadsheet parser is only fetched when an
      // admin actually imports, never on first page load.
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        setParseError('File-ka ma lahayn xaashiyo (sheets) la akhriyi karo.')
        return
      }
      const sheet = workbook.Sheets[sheetName]
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })

      const { rows, missing, cols } = rowsFromMatrix(matrix)
      if (missing.length) {
        // Try to recover automatically: if a column wasn't recognised but there
        // is EXACTLY ONE unclaimed column left, that is almost certainly the
        // missing field (e.g. a header cell that is simply blank). Only hand
        // over to the manual picker when it is genuinely ambiguous.
        const colCount = matrix.reduce((m, r) => Math.max(m, (r || []).length), 0)
        const assigned = new Set(
          ['student_name', 'department', 'semester'].map((k) => cols[k]).filter((i) => i >= 0)
        )
        const forced = {}
        for (const key of ['student_name', 'department', 'semester']) {
          if (cols[key] >= 0) continue
          const free = Array.from({ length: colCount }, (_, i) => i).filter(
            (i) => !assigned.has(i)
          )
          if (free.length === 1) {
            forced[key] = free[0]
            assigned.add(free[0])
          }
        }

        if (Object.keys(forced).length) {
          const retry = rowsFromMatrix(matrix, forced)
          if (!retry.missing.length && retry.rows.length) {
            setRawRows(retry.rows)
            setParseError('')
            setRawMatrix(null)
            return
          }
        }

        const headers = (matrix[0] || [])
          .map((h) => String(h ?? '').trim())
          .filter(Boolean)
        const missingLabels = missing.map((m) =>
          m === 'name' ? 'Student Name' : m === 'department' ? 'Department' : m
        )
        setParseError(
          `File-ka waa ka maqan tiirka: ${missingLabels.join(', ')}. Tiirarka la helay: ${headers.join(', ') || '(midna)'}`
        )
        setRawMatrix(matrix)
        setPick({
          student_name: cols.student_name,
          department: cols.department,
          semester: cols.semester,
        })
        return
      }
      if (!rows.length) {
        setParseError('File-ka wax saf ah oo xog leh lama helin.')
        return
      }

      setRawRows(rows)
      setRawMatrix(null)
    } catch (err) {
      setParseError(err.message || 'Khalad ayaa dhacay akhrinta file-ka.')
    }
  }

  async function confirmImport() {
    if (!parsedRows.length) {
      showToast('warn', 'Ma jiro saf sax ah oo la soo gelin karo.')
      return
    }
    setImporting(true)
    try {
      const payload = parsedRows.map(({ student_name, department, semester }) => ({
        student_name,
        department,
        semester,
      }))

      const { data, error } = await supabase.rpc('import_students', { p_students: payload })
      if (error) throw error

      const skipped = (data?.skipped || []).map((s) => ({
        row: parsedRows[s.index]?.row ?? '?',
        name: s.name || '',
        reason: reasonLabel(s.reason),
      }))

      setReport({
        received: data?.received ?? payload.length,
        inserted: data?.inserted ?? 0,
        skipped,
      })

      if ((data?.inserted ?? 0) > 0) {
        showToast('success', `${data.inserted} arday ayaa la soo geliyay.`)
      } else {
        showToast('warn', 'Ardayna lama soo gelin.')
      }
      refresh()
    } catch (err) {
      const msg = err.message || 'Waa khalad, isku day markale.'
      if (isMigrationError(msg)) {
        showToast('error', 'import_students() lama helin. Fadlan socodsii migration-ka students import.')
      } else {
        showToast('error', msg)
      }
    } finally {
      setImporting(false)
    }
  }

  async function saveStudentEdit() {
    if (!editStudent) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('voiteid_id_db')
        .update({
          student_name: editStudent.student_name.trim(),
          student_department_id: editStudent.department_id ? Number(editStudent.department_id) : null,
          semester: (editStudent.semester || '').trim(),
        })
        .eq('c_id', editStudent.c_id)

      if (error) throw error
      showToast('success', 'Xogta ardayga waa la cusboonaysiiyay.')
      setEditStudent(null)
      loadPage()
      loadStats()
    } catch (err) {
      showToast('error', err.message || 'Khalad ayaa dhacay.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { error } = await supabase.from('voiteid_id_db').delete().eq('c_id', deleteTarget.c_id)
      if (error) throw error
      showToast('success', 'Ardayga waa la tirtiray.')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      showToast('error', err.message || 'Waa khalad, isku day markale.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAllStudents() {
    setSaving(true)
    try {
      // Remove every row that has a student attached (wipe name/dept/semester)
      const { error } = await supabase
        .from('voiteid_id_db')
        .delete()
        .not('student_name', 'is', null)
      if (error) throw error
      showToast('success', 'Dhammaan ardayda waa la tirtiray.')
      setBulkDeleteTarget(null)
      refresh()
    } catch (err) {
      showToast('error', err.message || 'Waa khalad, isku day markale.')
    } finally {
      setSaving(false)
    }
  }

  function downloadTemplate() {
    const rows = [
      'Student Name,Department,Semester',
      `Ali Yusuf,${departments[0]?.d_name || 'IT'},1`,
      `Hodan Ahmed,${departments[1]?.d_name || departments[0]?.d_name || 'Nursing'},2`,
    ]
    const csv = 'data:text/csv;charset=utf-8,' + rows.join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csv))
    link.setAttribute('download', 'students_template.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    showToast('success', 'Template-ka waa la soo dejiyay.')
  }

  async function fetchAllStudents() {
    const BATCH = 1000
    const all = []
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('voiteid_id_db')
        .select('c_id, student_name, student_department_id, semester, is_used, c_created_at')
        .not('student_name', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + BATCH - 1)
      if (error) throw error
      all.push(...(data || []))
      if (!data || data.length < BATCH) break
      from += BATCH
    }
    return all
  }

  async function exportStudents() {
    if (exporting) return
    setExporting(true)
    try {
      // Lazy-load the spreadsheet writer only when the admin exports.
      const XLSX = await import('xlsx')
      const rows = await fetchAllStudents()
      if (!rows.length) {
        showToast('warn', 'Arday lama helin si loo dhoofiyo.')
        return
      }

      const header = ['Student Name', 'Department', 'Semester', 'Voting ID', 'Status', 'Added']
      const aoa = [
        header,
        ...rows.map((r) => [
          r.student_name || '',
          r.student_department_id != null ? deptName.get(r.student_department_id) || '' : '',
          r.semester || '',
          r.c_id || '',
          r.is_used ? 'Voted' : 'Not Voted',
          formatDateTime(r.c_created_at),
        ]),
      ]

      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Students')
      const stamp = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `students_${stamp}.xlsx`)
      showToast('success', `${rows.length} arday ayaa la dhoofiyay.`)
    } catch (err) {
      showToast('error', err.message || 'Waa khalad, isku day markale.')
    } finally {
      setExporting(false)
    }
  }

  if (!bootDone) {
    return (
      <div className="spinner-center">
        <i className="fa-solid fa-spinner fa-spin" />
      </div>
    )
  }

  if (migrationMissing) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">
              <i className="fa-solid fa-user-graduate" /> Students
            </h2>
            <p className="page-subtitle">Soo geli oo maamul ardayda codbixinta.</p>
          </div>
        </div>
        <div className="section-card">
          <div className="empty-state">
            <i className="fa-solid fa-database" />
            <p>
              Miiska ardayda lama diyaarin. Fadlan socodsii
              <b> supabase/migrations/202610130001_students_import.sql </b>
              ee Supabase SQL Editor.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const firstOnPage = count === 0 ? 0 : (page - 1) * pageSize + 1
  const deptOptions = [
    { value: 'all', label: 'All Departments' },
    ...departments.map((d) => ({ value: d.id, label: d.d_name })),
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <i className="fa-solid fa-user-graduate" /> Students
          </h2>
          <p className="page-subtitle">Soo geli oo maamul ardayda codbixinta (Excel ama CSV).</p>
        </div>
        <div className="hdr-actions">
          <button className="btn btn-primary" onClick={openImport}>
            <i className="fa-solid fa-file-import" /> Import Students
          </button>
          <div className="actions-menu" ref={menuRef}>
            <button
              className="icon-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="More actions"
            >
              <i className="fa-solid fa-ellipsis-vertical" />
            </button>
            {menuOpen && (
              <div className="actions-dropdown" role="menu">
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    downloadTemplate()
                  }}
                >
                  <i className="fa-solid fa-file-csv" /> Download Template
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    exportStudents()
                  }}
                  disabled={exporting || serverStats.total === 0}
                >
                  <i className={`fa-solid ${exporting ? 'fa-spinner fa-spin' : 'fa-file-export'}`} />{' '}
                  Export All Students
                </button>
                <div className="actions-divider" />
                <button
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setMenuOpen(false)
                    setBulkDeleteTarget('students')
                  }}
                  disabled={serverStats.total === 0}
                >
                  <i className="fa-solid fa-trash" /> Delete All Students
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon indigo">
            <i className="fa-solid fa-user-graduate" />
          </div>
          <div>
            <div className="stat-value">{serverStats.total}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <i className="fa-solid fa-check-to-slot" />
          </div>
          <div>
            <div className="stat-value">{serverStats.voted}</div>
            <div className="stat-label">Voted</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <i className="fa-solid fa-hourglass-half" />
          </div>
          <div>
            <div className="stat-value">{serverStats.not_voted}</div>
            <div className="stat-label">Not Voted</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <i className="fa-solid fa-building-columns" />
          </div>
          <div>
            <div className="stat-value">{serverStats.departments}</div>
            <div className="stat-label">Departments</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="filter-pills">
            <button
              className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('all')
                setPage(1)
              }}
            >
              All ({serverStats.total})
            </button>
            <button
              className={`filter-pill ${statusFilter === 'used' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('used')
                setPage(1)
              }}
            >
              Voted ({serverStats.voted})
            </button>
            <button
              className={`filter-pill ${statusFilter === 'unused' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('unused')
                setPage(1)
              }}
            >
              Not Voted ({serverStats.not_voted})
            </button>
          </div>
        </div>
        <div className="toolbar-right">
          <div style={{ minWidth: 190 }}>
            <CustomSelect
              placeholder="All Departments"
              options={deptOptions}
              value={deptFilter}
              onSelect={(v) => {
                setDeptFilter(v)
                setPage(1)
              }}
            />
          </div>
          <select
            className="form-input"
            style={{ width: 110 }}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <div className="search-box">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              placeholder="Search name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="section-card" style={{ padding: 0, opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student Name</th>
                <th>Voting ID</th>
                <th>Department</th>
                <th>Semester</th>
                <th>Status</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.c_id}>
                  <td>{firstOnPage + i}</td>
                  <td>
                    <div className="avatar-row">
                      <div className="avatar-sm">
                        <i className="fa-solid fa-user-graduate" />
                      </div>
                      <span className="cell-main">{s.student_name || '—'}</span>
                    </div>
                  </td>
                  <td className="cell-main" style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                    {s.c_id}
                  </td>
                  <td>{s.department_id != null ? deptName.get(s.department_id) || '—' : '—'}</td>
                  <td>{s.semester || '—'}</td>
                  <td>
                    {s.is_used ? (
                      <span className="badge red">
                        <i className="fa-solid fa-circle" style={{ fontSize: 6 }} /> Voted
                      </span>
                    ) : (
                      <span className="badge green">
                        <i className="fa-solid fa-circle" style={{ fontSize: 6 }} /> Not Voted
                      </span>
                    )}
                  </td>
                  <td>{formatDateTime(s.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        className="btn btn-xs btn-outline"
                        onClick={() => setEditStudent({ ...s })}
                        title="Wax ka beddel ardayga"
                      >
                        <i className="fa-solid fa-pen" />
                      </button>
                      {!s.is_used && (
                        <button
                          className="btn btn-xs btn-danger"
                          onClick={() => setDeleteTarget(s)}
                          title="Tirtir ardayga"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!students.length && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <i className="fa-solid fa-user-graduate" />
                      <p>Arday lama helin. Isticmaal "Import Students" si aad u soo geliso.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          total={count}
          pageSize={pageSize}
        />
      </div>

      {importOpen && (
        <div className="modal-overlay">
          <div className="modal-container xl import-modal">
            <div className="modal-head" style={{ padding: '20px 28px' }}>
              <h3 style={{ fontSize: '1.25rem', gap: 10 }}>
                <i className="fa-solid fa-file-import" /> Import Students
              </h3>
              <button className="modal-x" onClick={() => setImportOpen(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '24px 28px' }}>
              {!report && (
                <>
                  <p className="cell-sub" style={{ marginTop: 0, fontSize: '0.92rem', lineHeight: '1.5', marginBottom: 18 }}>
                    File-ku waa inuu leeyahay tiirarka <b>Student Name</b>, <b>Department</b>, iyo <b>Semester</b>.
                    Waaxda (Department) waa inay la mid tahay mid ka mid ah waaxyaha nidaamka ku jira. Nidaamku wuxuu si otomaatig ah arday kasta ugu samaynayaa Voting ID gaar ah.
                  </p>

                  <div className="form-group" style={{ marginBottom: 18 }}>
                    <label className="form-label" style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8, display: 'block' }}>
                      Excel ama CSV File
                    </label>
                    <div
                      className="import-upload-zone"
                      onClick={() => fileRef.current?.click()}
                    >
                      <input
                        ref={fileRef}
                        type="file"
                        style={{ display: 'none' }}
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFile}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: 'var(--pust-primary, #2563eb)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 22,
                          }}
                        >
                          <i className="fa-solid fa-cloud-arrow-up" />
                        </div>
                        {fileName ? (
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--pust-text)' }}>
                              <i className="fa-solid fa-file-excel" style={{ color: '#16a34a', marginRight: 6 }} />
                              {fileName}
                            </p>
                            <p className="cell-sub" style={{ margin: '4px 0 0' }}>
                              Guji halkan haddii aad rabto inaad beddesho file-ka
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem', color: 'var(--pust-text)' }}>
                              Riix halkan si aad u soo geliso file-ka (Excel ama CSV)
                            </p>
                            <p className="cell-sub" style={{ margin: '4px 0 0' }}>
                              Faylasha la ogol yahay: <b>.xlsx, .xls, .csv</b>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {rawMatrix ? (
                    <div className="import-map has-gaps">
                      <p className="import-diag-title">
                        <i className="fa-solid fa-triangle-exclamation" /> {parseError}
                      </p>
                      <p className="cell-sub" style={{ marginTop: 0, marginBottom: 10 }}>
                        Dooro tiirka saxda ah ee mid kasta — ama 'Auto' si nidaamku u sawiro.
                      </p>
                      {PICK_FIELDS.map((f) => {
                        const usedElsewhere = new Set(
                          PICK_FIELDS.filter((o) => o.key !== f.key).map((o) => pick[o.key])
                        )
                        const options = pickerOptions(rawMatrix).filter(
                          (o) => !usedElsewhere.has(o.value)
                        )
                        if (!options.length) {
                          return (
                            <div key={f.key} className="cell-sub" style={{ marginBottom: 8 }}>
                              <i className="fa-solid fa-circle-exclamation" />{' '}
                              <b>{f.label}:</b> file-ka ma laha tiir kale oo u habboon. Fadlan isticmaal fayl ay ku jiraan tiirarka loo baahan yahay.
                            </div>
                          )
                        }
                        return (
                          <div key={f.key} className="dept-map-row">
                            <span className="dept-map-src">{f.label}</span>
                            <i className="fa-solid fa-arrow-right dept-map-arrow" />
                            <select
                              className="form-input"
                              value={pick[f.key] ?? -1}
                              onChange={(e) =>
                                setPick((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
                              }
                              aria-label={f.label}
                            >
                              <option value={-1}>— Auto —</option>
                              {options.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={reparsePicked}>
                          <i className="fa-solid fa-rotate" /> Re-parse
                        </button>
                      </div>
                    </div>
                  ) : (
                    parseError && (
                      <div className="badge red" style={{ display: 'block', padding: '10px 12px' }}>
                        <i className="fa-solid fa-triangle-exclamation" /> {parseError}
                      </div>
                    )
                  )}

                  {!parseError && rawRows.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                        <span className={`badge ${parsedRows.length ? 'green' : 'red'}`}>
                          <i
                            className={`fa-solid ${
                              parsedRows.length ? 'fa-check' : 'fa-circle-xmark'
                            }`}
                          />{' '}
                          {parsedRows.length} diyaar ah
                        </span>
                        {issues.length > 0 && (
                          <span className="badge red">
                            <i className="fa-solid fa-triangle-exclamation" /> {issues.length} khalad ku jira
                          </span>
                        )}
                      </div>

                      {issues.length > 0 && (
                        <div
                          style={{
                            background: 'rgba(239, 68, 68, 0.06)',
                            border: '1.5px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 12,
                            padding: '14px 18px',
                            marginBottom: 16,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 10,
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                color: 'var(--pust-danger, #ef4444)',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                              }}
                            >
                              <i className="fa-solid fa-circle-exclamation" />
                              <span>Khaladaadka Waaxda / Xaqiijinta ({issues.length} saf lama soo gelin karo)</span>
                            </div>
                            {missingDepts.length > 0 && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{
                                  fontSize: '0.84rem',
                                  padding: '6px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                                onClick={handleAddMissingDepartments}
                                disabled={addingDepts}
                              >
                                <i className={`fa-solid ${addingDepts ? 'fa-spinner fa-spin' : 'fa-plus'}`} />
                                {addingDepts ? 'Ku darayaa...' : `Ku dar ${missingDepts.length} waaxood nidaamka`}
                              </button>
                            )}
                          </div>
                          <p className="cell-sub" style={{ margin: '0 0 10px', color: 'var(--pust-text)', fontSize: '0.86rem' }}>
                            Ardayda hoose lama soo gelin karo sababtoo ah waaxdoodu kama jirto nidaamka ama waa maqan tahay. Waaxdu waa inay ku jirtaa liiska waaxyaha (Departments).
                          </p>
                          <div style={{ maxHeight: 150, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {issues.map((r, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '7px 12px',
                                  background: 'var(--pust-surface, #ffffff)',
                                  borderRadius: 8,
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  fontSize: '0.86rem',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span className="badge amber" style={{ fontSize: '0.76rem', padding: '2px 7px' }}>
                                    Line {r.row}
                                  </span>
                                  <b>{r.student_name || '(Magac la\'aan)'}</b>
                                </div>
                                <div style={{ color: 'var(--pust-danger, #ef4444)', fontWeight: 600 }}>
                                  {r.reason === 'department_not_found'
                                    ? `Waaxda "${r.department}" lama helin`
                                    : r.reason === 'missing_department'
                                    ? 'Waaxdu waa maqan tahay'
                                    : reasonLabel(r.reason)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {parsedRows.length === 0 && (
                        <div className="import-diag">
                          <p className="import-diag-title">
                            <i className="fa-solid fa-triangle-exclamation" /> Ma jiro saf la aqbali
                            karo — dhammaan {rawRows.length} saf ayaa khalad ku jira.
                          </p>
                          <p className="cell-sub" style={{ marginTop: 0 }}>
                            Fadlan hubi in magacyada waaxyaha ku jira file-ka ay la mid yihiin waaxyaha nidaamka ka diiwaangashan.
                          </p>
                        </div>
                      )}

                      {parsedRows.length > 0 && (
                        <>
                          <div
                            style={{
                              maxHeight: 240,
                              overflow: 'auto',
                              border: '1px solid var(--pust-border)',
                              borderRadius: 10,
                            }}
                          >
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Line</th>
                                  <th>Name</th>
                                  <th>Department</th>
                                  <th>Semester</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsedRows.slice(0, 25).map((r) => (
                                  <tr key={r.row}>
                                    <td>{r.row}</td>
                                    <td className="cell-main">{r.student_name}</td>
                                    <td>
                                      <span
                                        className="badge"
                                        style={{
                                          background: 'rgba(37, 99, 235, 0.1)',
                                          color: 'var(--pust-primary, #2563eb)',
                                          border: '1px solid rgba(37, 99, 235, 0.25)',
                                          fontWeight: 600,
                                        }}
                                      >
                                        <i className="fa-solid fa-building-columns" style={{ marginRight: 5, fontSize: 11 }} />
                                        {r.department}
                                      </span>
                                    </td>
                                    <td>{r.semester || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {parsedRows.length > 25 && (
                            <p className="cell-sub">+ {parsedRows.length - 25} kale...</p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {report && (
                <>
                  <div className="success-lottie" style={{ margin: '0 auto' }}>
                    <i className="fa-solid fa-circle-check" />
                  </div>
                  <h3 className="success-title" style={{ textAlign: 'center' }}>
                    Soo gelinta waa dhammaystiran
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      marginBottom: 12,
                    }}
                  >
                    <span className="badge green">
                      <i className="fa-solid fa-user-plus" /> {report.inserted} la soo geliyay
                    </span>
                    <span className="badge amber">
                      <i className="fa-solid fa-forward" /> {report.skipped.length} la booday
                    </span>
                  </div>
                  {report.skipped.length > 0 && (
                    <div style={{ maxHeight: 180, overflow: 'auto' }}>
                      {report.skipped.map((s, i) => (
                        <div key={i} className="cell-sub">
                          <b>Line {s.row}:</b> {s.name || '(no name)'} — {s.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-foot" style={{ padding: '18px 28px' }}>
              <button
                className="btn btn-outline"
                style={{ padding: '10px 20px', fontSize: '0.95rem' }}
                onClick={() => setImportOpen(false)}
                disabled={importing}
              >
                {report ? 'Close' : 'Cancel'}
              </button>
              {!report && (
                <button
                  className="btn btn-primary"
                  style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 600 }}
                  onClick={confirmImport}
                  disabled={importing || !parsedRows.length}
                >
                  <i className={`fa-solid ${importing ? 'fa-spinner fa-spin' : 'fa-file-import'}`} />
                  {importing ? 'Importing...' : `Import ${parsedRows.length || ''} Students`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete student?"
          description="Ma hubtaa inaad tirtirayso"
          itemName={deleteTarget.student_name || deleteTarget.c_id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          saving={saving}
        />
      )}

      {bulkDeleteTarget === 'students' && (
        <ConfirmDeleteModal
          title="Delete ALL Students?"
          description={`Tani waxay tirtirtaa dhammaan ardayda (${serverStats.total}). Ficilkan lama celcelin karo.`}
          itemName=""
          confirmIcon="fa-users-slash"
          confirmLabel={`Delete All ${serverStats.total} Students`}
          onCancel={() => setBulkDeleteTarget(null)}
          onConfirm={deleteAllStudents}
          saving={saving}
        />
      )}
      {editStudent && (
        <div className="modal-overlay">
          <div className="modal-container sm">
            <div className="modal-head">
              <h3>
                <i className="fa-solid fa-pen-to-square" /> Wax ka beddel Ardayga
              </h3>
              <button className="modal-x" onClick={() => setEditStudent(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Magaca Ardayga (Student Name)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editStudent.student_name || ''}
                  onChange={(e) => setEditStudent((prev) => ({ ...prev, student_name: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Waaxda (Department)</label>
                <select
                  className="form-input"
                  value={editStudent.department_id || ''}
                  onChange={(e) =>
                    setEditStudent((prev) => ({
                      ...prev,
                      department_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                >
                  <option value="">— Waax la'aan (None) —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.d_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Semester</label>
                <input
                  type="text"
                  className="form-input"
                  value={editStudent.semester || ''}
                  onChange={(e) => setEditStudent((prev) => ({ ...prev, semester: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-outline" onClick={() => setEditStudent(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveStudentEdit} disabled={saving || !editStudent.student_name?.trim()}>
                <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} />
                {saving ? 'Keydinayaa...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
