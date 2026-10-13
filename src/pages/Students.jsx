import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../toast'
import { formatDateTime } from '../utils'
import Pager from '../components/Pager.jsx'
import CustomSelect from '../components/CustomSelect.jsx'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx'
import {
  rowsFromMatrix,
  autoMapDepartments,
  applyDepartmentMapping,
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
  const [deptMapping, setDeptMapping] = useState({})
  const [parseError, setParseError] = useState('')
  const [rawMatrix, setRawMatrix] = useState(null)
  const [pick, setPick] = useState({ student_name: -1, department: -1, semester: -1 })
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState(null)
  const [assignMode, setAssignMode] = useState('single') // 'single' | 'distribute'
  const [selectedSingleDept, setSelectedSingleDept] = useState('')
  const [deptDist, setDeptDist] = useState({}) // { deptName: count } when file has no dept column
  const [rowDeptOverrides, setRowDeptOverrides] = useState({}) // { [rowIndex]: deptName }
  const fileRef = useRef(null)

  const [editStudent, setEditStudent] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(null) // 'students' | 'usedIds'
  const [saving, setSaving] = useState(false)

  const deptName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.d_name])),
    [departments]
  )

  const systemDeptNames = useMemo(() => departments.map((d) => d.d_name), [departments])

  const fileDepartments = useMemo(
    () =>
      [...new Set(rawRows.map((r) => r.department).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [rawRows]
  )

  const { valid: parsedRows, invalid: issues } = useMemo(
    () => applyDepartmentMapping(rawRows, deptMapping, systemDeptNames),
    [rawRows, deptMapping, systemDeptNames]
  )

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

  async function loadDepartments() {
    const { data, error } = await supabase
      .from('depadrments_depadrments_db')
      .select('id, d_name')
      .order('d_name')
    if (!error && data) {
      setDepartments(data)
      setSelectedSingleDept((prev) => prev || (data[0]?.d_name ?? ''))
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
    setDeptMapping({})
    setParseError('')
    setRawMatrix(null)
    setPick({ student_name: -1, department: -1, semester: -1 })
    setAssignMode('single')
    setSelectedSingleDept(departments[0]?.d_name || '')
    setDeptDist({})
    setRowDeptOverrides({})
    setReport(null)
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function openImport() {
    resetImport()
    setImportOpen(true)
  }

  function setMapping(fileDept, systemDept) {
    setDeptMapping((prev) => ({ ...prev, [fileDept]: systemDept }))
  }

  function reparsePicked() {
    if (!rawMatrix) return
    const forced = {}
    if (pick.student_name >= 0) forced.student_name = pick.student_name
    if (pick.department >= 0) forced.department = pick.department
    if (pick.semester >= 0) forced.semester = pick.semester

    const { rows, missing } = rowsFromMatrix(rawMatrix, forced)
    // `missing` now only contains 'name' (department is optional). Block only
    // when student_name is still unresolved or no data rows were found.
    if (missing.length || !rows.length) {
      showToast('warn', 'Wali ma la heli karo tiirka Student Name — dooro tiirka saxda ah.')
      return
    }

    const fileDepts = [...new Set(rows.map((r) => r.department).filter(Boolean))]
    setRawRows(rows)
    setDeptMapping(autoMapDepartments(fileDepts, systemDeptNames))
    if (!fileDepts.length && departments.length) {
      const init = {}
      departments.forEach((d) => { init[d.d_name] = 0 })
      setDeptDist(init)
    }
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
        for (const key of ['student_name', 'semester']) {
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
            const fileDepts = [
              ...new Set(retry.rows.map((r) => r.department).filter(Boolean)),
            ]
            setRawRows(retry.rows)
            setDeptMapping(autoMapDepartments(fileDepts, systemDeptNames))
            setParseError('')
            setRawMatrix(null)
            return
          }
        }

        const headers = (matrix[0] || [])
          .map((h) => String(h ?? '').trim())
          .filter(Boolean)
        setParseError(
          `File-ka waa ka maqan tiirka: ${missing
            .map((m) => (m === 'name' ? 'Student Name' : 'Semester'))
            .join(', ')}. Tiirarka la helay: ${headers.join(', ') || '(midna)'}`
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

      const fileDepts = [...new Set(rows.map((r) => r.department).filter(Boolean))]
      setRawRows(rows)
      setDeptMapping(autoMapDepartments(fileDepts, systemDeptNames))
      // If the file had no department column at all, init distribution (all 0)
      if (!fileDepts.length && departments.length) {
        const init = {}
        departments.forEach((d) => { init[d.d_name] = 0 })
        setDeptDist(init)
      }
      setRawMatrix(null)
    } catch (err) {
      setParseError(err.message || 'Khalad ayaa dhacay akhrinta file-ka.')
    }
  }

  // Computed from deptDist: ordered list of { dept, count } for payload building
  const distEntries = Object.entries(deptDist).filter(([, n]) => Number(n) > 0)
  const distTotal = distEntries.reduce((s, [, n]) => s + Number(n), 0)
  const noDeptInFile = rawRows.length > 0 && rawRows.every((r) => !r.department)

  function distributeEqually() {
    if (!departments.length || !parsedRows.length) return
    const total = parsedRows.length
    const numDepts = departments.length
    const base = Math.floor(total / numDepts)
    const remainder = total % numDepts
    const nextDist = {}
    departments.forEach((dep, idx) => {
      nextDist[dep.d_name] = base + (idx < remainder ? 1 : 0)
    })
    setDeptDist(nextDist)
  }

  function getAssignedDeptForRow(rowIndex) {
    if (rowDeptOverrides[rowIndex]) {
      return rowDeptOverrides[rowIndex]
    }
    if (assignMode === 'single') {
      return selectedSingleDept
    }
    // Distribute mode: calculate cumulative offset
    let cum = 0
    for (const [dept, rawCount] of distEntries) {
      cum += Number(rawCount) || 0
      if (rowIndex < cum) return dept
    }
    return selectedSingleDept || departments[0]?.d_name || ''
  }

  async function confirmImport() {
    if (!parsedRows.length) {
      showToast('warn', 'Ma jiro saf sax ah oo la soo gelin karo.')
      return
    }
    if (noDeptInFile) {
      if (assignMode === 'single') {
        if (!selectedSingleDept) {
          showToast('warn', 'Fadlan dooro waaxda ardayda.')
          return
        }
      } else {
        if (distTotal === 0) {
          showToast('warn', 'Fadlan qaybso ardayda waaxaha.')
          return
        }
        if (distTotal !== parsedRows.length) {
          showToast('warn', `Wadarta qaybinta (${distTotal}) waa inay la mid tahay tirada ardayda (${parsedRows.length}).`)
          return
        }
      }
    }
    setImporting(true)
    try {
      let payload
      if (noDeptInFile) {
        payload = parsedRows.map((r, idx) => ({
          student_name: r.student_name,
          department: getAssignedDeptForRow(idx),
          semester: r.semester,
        }))
      } else {
        payload = parsedRows.map(({ student_name, department, semester }) => ({
          student_name, department, semester,
        }))
      }

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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={downloadTemplate}>
            <i className="fa-solid fa-file-csv" /> Template
          </button>
          <button
            className="btn btn-danger"
            onClick={() => setBulkDeleteTarget('students')}
            disabled={serverStats.total === 0}
          >
            <i className="fa-solid fa-trash" /> Delete All Students
          </button>
          <button className="btn btn-primary" onClick={openImport}>
            <i className="fa-solid fa-file-import" /> Import Students
          </button>
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
                    File-ku waa inuu leeyahay tiirka <b>Student Name</b> iyo <b>Semester</b>.
                    Tiirka <b>Department</b> waa ikhtiyaari — haddii aanu ku jirin file-ka,
                    waxaad si fudud ugu qaybin kartaa waaxaha hoos ka muuqda. Nidaamku wuxuu si otomaatig ah arday kasta ugu samaynayaa Voting ID gaar ah.
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
                        // Department is optional — show a softer message if no column available
                        if (!options.length) {
                          if (f.key === 'department') {
                            return (
                              <div key={f.key} className="cell-sub" style={{ marginBottom: 8 }}>
                                <i className="fa-solid fa-circle-info" />{' '}
                                <b>{f.label}:</b> file-ka tiir Department kuma jiro — ardaydii waxaa dambe loo doori karaa waaxdooda.
                              </div>
                            )
                          }
                          return (
                            <div key={f.key} className="cell-sub" style={{ marginBottom: 8 }}>
                              <i className="fa-solid fa-circle-exclamation" />{' '}
                              <b>{f.label}:</b> file-ka ma laha tiir kale oo u habboon. Haddii uu
                              dhamaayo, isticmaal faylka tiirka {f.label} ku jiro.
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
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <span className={`badge ${parsedRows.length ? 'green' : 'red'}`}>
                          <i
                            className={`fa-solid ${
                              parsedRows.length ? 'fa-check' : 'fa-circle-xmark'
                            }`}
                          />{' '}
                          {parsedRows.length} diyaar
                        </span>
                        {issues.length > 0 && (
                          <span className="badge amber">
                            <i className="fa-solid fa-triangle-exclamation" /> {issues.length} la
                            boodi doono
                          </span>
                        )}
                      </div>

                      {fileDepartments.length > 0 ? (
                        <div className={`import-map ${issues.length ? 'has-gaps' : ''}`}>
                          <p className="cell-sub" style={{ marginTop: 0, marginBottom: 10 }}>
                            Waaxda file-ka hoos ku qoran, dooro waaxda nidaamka u dhigma. Haddii aadan
                            dooran, ardaydaas waa la boodi doonaa.
                          </p>
                          {fileDepartments.map((d) => {
                            const unmapped = !deptMapping[d]
                            return (
                              <div key={d} className="dept-map-row">
                                <span className="dept-map-src" title={d}>
                                  {d}
                                </span>
                                <i className="fa-solid fa-arrow-right dept-map-arrow" />
                                <select
                                  className="form-input"
                                  style={{ borderColor: unmapped ? 'var(--pust-danger)' : undefined }}
                                  value={deptMapping[d] || ''}
                                  onChange={(e) => setMapping(d, e.target.value)}
                                  aria-label={`Map ${d} to a system department`}
                                >
                                  <option value="">— Ha soo gelin —</option>
                                  {departments.map((dep) => (
                                    <option key={dep.id} value={dep.d_name}>
                                      {dep.d_name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )
                          })}
                          {!departments.length && (
                            <p className="cell-sub" style={{ marginBottom: 0 }}>
                              Nidaamku waax ma laha. Marka hore ku dar waaxaha (Waxaha).
                            </p>
                          )}
                        </div>
                      ) : departments.length > 0 ? (
                        /* File has no department column — easy department selection */
                        <div
                            style={{
                              background: 'var(--pust-bg, #f8fafc)',
                              border: '1.5px solid var(--pust-border, #e2e8f0)',
                              borderRadius: 14,
                              padding: '18px 22px',
                              marginBottom: 18,
                            }}
                          >
                            {/* Header with Title and Mode Switcher */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 12,
                                marginBottom: 16,
                              }}
                            >
                              <div>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <i className="fa-solid fa-building-columns" style={{ color: 'var(--pust-primary, #2563eb)' }} />
                                  Dooro Waaxda Ardayda ({parsedRows.length} arday)
                                </h4>
                                <p className="cell-sub" style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
                                  File-ku tiir Department kuma jiro. Dooro habka aad ugu qoondeynayso:
                                </p>
                              </div>

                              {/* Mode Switcher */}
                              <div
                                style={{
                                  display: 'flex',
                                  background: 'var(--pust-surface, #ffffff)',
                                  border: '1px solid var(--pust-border, #e2e8f0)',
                                  borderRadius: 10,
                                  padding: 3,
                                  gap: 4,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setAssignMode('single')}
                                  style={{
                                    border: 'none',
                                    borderRadius: 7,
                                    padding: '7px 14px',
                                    fontSize: '0.88rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    background: assignMode === 'single' ? 'var(--pust-primary, #2563eb)' : 'transparent',
                                    color: assignMode === 'single' ? '#ffffff' : 'var(--pust-text)',
                                  }}
                                >
                                  <i className="fa-solid fa-check-double" style={{ marginRight: 6 }} />
                                  Dhammaan Hal Waax (Easy)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssignMode('distribute')
                                    if (distTotal === 0) distributeEqually()
                                  }}
                                  style={{
                                    border: 'none',
                                    borderRadius: 7,
                                    padding: '7px 14px',
                                    fontSize: '0.88rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    background: assignMode === 'distribute' ? 'var(--pust-primary, #2563eb)' : 'transparent',
                                    color: assignMode === 'distribute' ? '#ffffff' : 'var(--pust-text)',
                                  }}
                                >
                                  <i className="fa-solid fa-arrows-split-up-and-left" style={{ marginRight: 6 }} />
                                  U Qaybi Waaxaha
                                </button>
                              </div>
                            </div>

                            {/* MODE 1: Single Department (1-Click Selection) */}
                            {assignMode === 'single' && (
                              <div>
                                <p style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--pust-text)' }}>
                                  Guji waaxda ardayda oo dhan ({parsedRows.length}) la siinayo:
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                                  {departments.map((d) => {
                                    const isSelected = selectedSingleDept === d.d_name
                                    return (
                                      <button
                                        key={d.id}
                                        type="button"
                                        onClick={() => setSelectedSingleDept(d.d_name)}
                                        style={{
                                          padding: '10px 18px',
                                          borderRadius: 10,
                                          border: isSelected ? '2px solid var(--pust-primary, #2563eb)' : '1px solid var(--pust-border, #cbd5e1)',
                                          background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--pust-surface, #ffffff)',
                                          color: isSelected ? 'var(--pust-primary, #2563eb)' : 'var(--pust-text)',
                                          fontWeight: isSelected ? 700 : 500,
                                          fontSize: '0.92rem',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          transition: 'all 0.15s ease',
                                          boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                                        }}
                                      >
                                        <i
                                          className={`fa-solid ${isSelected ? 'fa-circle-check' : 'fa-building-columns'}`}
                                          style={{ color: isSelected ? 'var(--pust-primary, #2563eb)' : 'inherit', opacity: isSelected ? 1 : 0.6 }}
                                        />
                                        {d.d_name}
                                      </button>
                                    )
                                  })}
                                </div>

                                {selectedSingleDept && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '10px 14px',
                                      borderRadius: 8,
                                      background: 'rgba(34, 197, 94, 0.1)',
                                      border: '1px solid rgba(34, 197, 94, 0.25)',
                                      color: '#15803d',
                                      fontSize: '0.9rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    <i className="fa-solid fa-circle-check" />
                                    <span>
                                      Dhammaan <b>{parsedRows.length} arday</b> waxay toos u noqonayaan waaxda <b>"{selectedSingleDept}"</b>
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* MODE 2: Distribute Across Departments */}
                            {assignMode === 'distribute' && (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                                  <p className="cell-sub" style={{ margin: 0 }}>
                                    Geli tirada ardayda waax kasta ama guji "Si siman u qaybi":
                                  </p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <button
                                      type="button"
                                      className="btn btn-outline"
                                      style={{ padding: '6px 14px', fontSize: 13, height: 'auto', fontWeight: 600, borderRadius: 8 }}
                                      onClick={distributeEqually}
                                    >
                                      <i className="fa-solid fa-arrows-split-up-and-left" /> Si siman u qaybi
                                    </button>
                                    <span
                                      className={`badge ${distTotal === parsedRows.length && parsedRows.length > 0 ? 'green' : distTotal > parsedRows.length ? 'red' : 'amber'}`}
                                      style={{ fontVariantNumeric: 'tabular-nums', padding: '6px 12px', fontSize: '0.88rem' }}
                                    >
                                      <i className={`fa-solid ${distTotal === parsedRows.length && parsedRows.length > 0 ? 'fa-check' : 'fa-scale-balanced'}`} />
                                      {' '}{distTotal} / {parsedRows.length} la qaybisey
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {departments.map((dep) => {
                                    const val = deptDist[dep.d_name] ?? 0
                                    const isOver = distTotal > parsedRows.length
                                    return (
                                      <div
                                        key={dep.id}
                                        className="dept-map-row"
                                        style={{
                                          alignItems: 'center',
                                          padding: '8px 14px',
                                          borderRadius: 8,
                                          background: Number(val) > 0 ? 'rgba(37, 99, 235, 0.05)' : 'var(--pust-surface, #ffffff)',
                                          border: '1px solid',
                                          borderColor: Number(val) > 0 ? 'rgba(37, 99, 235, 0.25)' : 'var(--pust-border, #e2e8f0)',
                                        }}
                                      >
                                        <span className="dept-map-src" style={{ flex: 1, fontSize: '0.95rem' }}>
                                          <i className="fa-solid fa-building-columns" style={{ marginRight: 8, opacity: 0.6 }} />
                                          {dep.d_name}
                                        </span>
                                        <i className="fa-solid fa-arrow-right dept-map-arrow" />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            style={{ width: 28, height: 28, padding: 0, borderRadius: 6, fontSize: 14 }}
                                            onClick={() =>
                                              setDeptDist((prev) => ({
                                                ...prev,
                                                [dep.d_name]: Math.max(0, (prev[dep.d_name] ?? 0) - 1),
                                              }))
                                            }
                                          >
                                            -
                                          </button>
                                          <input
                                            type="number"
                                            min={0}
                                            max={parsedRows.length}
                                            className="form-input"
                                            style={{
                                              width: 75,
                                              height: 38,
                                              textAlign: 'center',
                                              fontSize: 16,
                                              borderColor: isOver
                                                ? 'var(--pust-danger)'
                                                : Number(val) > 0
                                                ? 'var(--pust-success, #22c55e)'
                                                : undefined,
                                              fontWeight: Number(val) > 0 ? 700 : undefined,
                                            }}
                                            value={val}
                                            onChange={(e) =>
                                              setDeptDist((prev) => ({
                                                ...prev,
                                                [dep.d_name]: Math.max(0, Number(e.target.value) || 0),
                                              }))
                                            }
                                            aria-label={`Number of students for ${dep.d_name}`}
                                          />
                                          <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            style={{ width: 28, height: 28, padding: 0, borderRadius: 6, fontSize: 14 }}
                                            onClick={() =>
                                              setDeptDist((prev) => ({
                                                ...prev,
                                                [dep.d_name]: (prev[dep.d_name] ?? 0) + 1,
                                              }))
                                            }
                                          >
                                            +
                                          </button>
                                          <span className="cell-sub" style={{ minWidth: 44, margin: 0, fontWeight: 500 }}>
                                            arday
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>

                                {distTotal > 0 && distTotal !== parsedRows.length && (
                                  <p className="cell-sub" style={{ marginTop: 10, marginBottom: 0, color: 'var(--pust-danger)', fontWeight: 600 }}>
                                    <i className="fa-solid fa-triangle-exclamation" />{' '}
                                    {distTotal > parsedRows.length
                                      ? `${distTotal - parsedRows.length} arday ayaa ka badan intii loo baahnaa.`
                                      : `${parsedRows.length - distTotal} arday ayaa weli dhiman in la qoondeeyo.`}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ) : null}


                      {parsedRows.length === 0 && (
                        <div className="import-diag">
                          <p className="import-diag-title">
                            <i className="fa-solid fa-triangle-exclamation" /> Ma jiro saf la aqbali
                            karo — {rawRows.length} saf ayaa la boodi doonaa.
                          </p>
                          <p className="cell-sub" style={{ marginTop: 0 }}>
                            Kor ku qoran waa safafka waaxaha file-ka — dooro mid kasta waaxda
                            nidaamka u dhigma. Qaabka kale, sax tiirka Department ee file-ka.
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
                                      {noDeptInFile ? (
                                        <select
                                          className="form-input"
                                          style={{ height: 32, fontSize: 13, padding: '2px 8px', maxWidth: 200 }}
                                          value={getAssignedDeptForRow(r.row - 1) || ''}
                                          onChange={(e) =>
                                            setRowDeptOverrides((prev) => ({
                                              ...prev,
                                              [r.row - 1]: e.target.value,
                                            }))
                                          }
                                        >
                                          {departments.map((dep) => (
                                            <option key={dep.id} value={dep.d_name}>
                                              {dep.d_name}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        r.department || '—'
                                      )}
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

                      {issues.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <p className="cell-sub" style={{ marginBottom: 6 }}>
                            Safafka la boodi doono:
                          </p>
                          <div style={{ maxHeight: 140, overflow: 'auto' }}>
                            {issues.slice(0, 30).map((r, idx) => (
                              <div key={idx} className="cell-sub">
                                <b>Line {r.row}:</b> {r.student_name || '(no name)'} —{' '}
                                {reasonLabel(r.reason)}
                                {r.reason.startsWith('department') && r.department
                                  ? ` (${r.department})`
                                  : ''}
                              </div>
                            ))}
                            {issues.length > 30 && (
                              <p className="cell-sub">+ {issues.length - 30} kale...</p>
                            )}
                          </div>
                        </div>
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
                  disabled={
                    importing ||
                    !parsedRows.length ||
                    (noDeptInFile && assignMode === 'single' && !selectedSingleDept) ||
                    (noDeptInFile && assignMode === 'distribute' && distTotal !== parsedRows.length)
                  }
                >
                  <i className={`fa-solid ${importing ? 'fa-spinner fa-spin' : 'fa-file-import'}`} />
                  {importing
                    ? 'Importing...'
                    : noDeptInFile && assignMode === 'distribute' && distTotal !== parsedRows.length
                    ? `Qaybi ardayda (${distTotal}/${parsedRows.length})`
                    : `Import ${parsedRows.length || ''}`}
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
