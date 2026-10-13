// Pure helpers for the student importer. Kept free of React / Supabase / XLSX
// imports so they can be unit-tested directly (see studentsImport.test.js).

// Accepted column headers (compared after normalisation: lowercased, with
// spaces, underscores, dashes, dots and slashes removed).
export const HEADER_ALIASES = {
  student_name: ['studentname', 'student', 'name', 'fullname', 'magac', 'magaca'],
  department: ['department', 'dept', 'faculty', 'college', 'waax', 'waaxda', 'waxaha'],
  semester: ['semester', 'semister', 'sem', 'semesterka', 'sanad', 'year'],
}

export function normalizeHeader(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s_\-./\\]+/g, '')
    .trim()
}

// Collapse ALL whitespace (spaces, tabs, non-breaking spaces, ...) to a single
// space, then trim + lowercase. Spreadsheet cells and hand-entered department
// names hide NBSPs / double spaces that a plain trim() misses.
export function normCompare(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Used as a fallback when no exact alias matched: any header CONTAINING one of
// these keywords is accepted (e.g. "Department Name", "Magaca Ardayga",
// "Semester (1-8)"). Assigned in priority order with index exclusion so a
// verbose header like "Department Name" can't also be claimed as the name.
const STRONG_KEYWORDS = {
  department: ['depart', 'dept', 'waax', 'waxah', 'faculty', 'college'],
  semester: ['semes', 'semister', 'sanad'],
  student_name: ['name', 'magac', 'student'],
}

function assignColumns(headers) {
  const used = new Set()
  const result = { student_name: -1, department: -1, semester: -1 }

  for (const field of ['department', 'semester', 'student_name']) {
    const aliases = HEADER_ALIASES[field].map(normalizeHeader)
    let idx = headers.findIndex((h, i) => !used.has(i) && aliases.includes(h))
    if (idx < 0) {
      const keys = STRONG_KEYWORDS[field]
      idx = headers.findIndex((h, i) => !used.has(i) && keys.some((k) => h.includes(k)))
    }
    if (idx >= 0) used.add(idx)
    result[field] = idx
  }

  return result
}

// Convert a sheet matrix (array of rows, first row = header) into student rows.
// Returns { rows, missing, cols } where `missing` lists required columns that
// were not found, and `cols` reports the resolved column indices. `forced`
// (optional) pins specific indices, used whenever the header row is unclear and
// the user picks the columns manually.
export function rowsFromMatrix(matrix, forced = {}) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return { rows: [], missing: ['name', 'department'], cols: { student_name: -1, department: -1, semester: -1 } }
  }

  const header = (matrix[0] || []).map(normalizeHeader)
  const auto = assignColumns(header)
  const cols = {
    student_name:
      Number.isInteger(forced.student_name) && forced.student_name >= 0
        ? forced.student_name
        : auto.student_name,
    department:
      Number.isInteger(forced.department) && forced.department >= 0
        ? forced.department
        : auto.department,
    semester:
      Number.isInteger(forced.semester) && forced.semester >= 0
        ? forced.semester
        : auto.semester,
  }
  const nameIdx = cols.student_name
  const deptIdx = cols.department
  const semIdx = cols.semester

  const missing = []
  if (nameIdx < 0) missing.push('name')
  if (deptIdx < 0) missing.push('department')

  const rows = []
  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] || []
    const student_name = String(raw[nameIdx] ?? '').replace(/\s+/g, ' ').trim()
    const department = deptIdx >= 0 ? String(raw[deptIdx] ?? '').replace(/\s+/g, ' ').trim() : ''
    const semester = semIdx >= 0 ? String(raw[semIdx] ?? '').replace(/\s+/g, ' ').trim() : ''

    // Skip entirely blank lines (trailing rows in most spreadsheets).
    if (!student_name && !department && !semester) continue

    // `row` = the real spreadsheet line number (1-based, header is line 1),
    // so reports point the user at the exact line to fix.
    rows.push({ student_name, department, semester, row: i + 1 })
  }

  return { rows, missing, cols }
}

// Split rows into importable ones and rejected ones. A row is valid when it
// has a name and its department matches an existing system department.
export function validateRows(rows, departmentNames) {
  const lookup = new Map((departmentNames || []).map((d) => [normCompare(d), d]))

  const valid = []
  const invalid = []

  for (const row of rows || []) {
    const student_name = String(row.student_name ?? '').trim()
    const department = String(row.department ?? '').trim()
    const semester = String(row.semester ?? '').trim()

    if (!student_name) {
      invalid.push({ ...row, student_name, department, semester, reason: 'missing_name' })
      continue
    }
    if (!department) {
      invalid.push({ ...row, student_name, department: '', semester, reason: 'missing_department' })
      continue
    }
    const canonical = lookup.get(normCompare(department))
    if (!canonical) {
      invalid.push({ ...row, student_name, department, semester, reason: 'department_not_found' })
      continue
    }
    valid.push({ ...row, student_name, department: canonical, semester })
  }

  return { valid, invalid }
}

// Build a default `{ fileDepartment: systemDepartment }` map. Departments whose
// spelling already matches the system (ignoring case/space) are auto-mapped;
// everything else defaults to '' meaning "skip".
export function autoMapDepartments(fileDepartments, systemNames) {
  const lookup = new Map((systemNames || []).map((d) => [normCompare(d), d]))
  const map = {}
  for (const d of fileDepartments || []) {
    map[d] = lookup.get(normCompare(d)) || ''
  }
  return map
}

// Resolve the user-chosen mapping into importable rows. Department is optional
// — if the file has no department column (department is '') the row is valid
// and is imported without a department. Rows that DO have a department in the
// file are still required to be mapped to a real system department.
export function applyDepartmentMapping(rows, mapping, systemNames) {
  const known = new Set((systemNames || []).map(normCompare))
  const valid = []
  const invalid = []

  for (const row of rows || []) {
    const student_name = String(row.student_name ?? '').trim()
    const department = String(row.department ?? '').trim()

    if (!student_name) {
      invalid.push({ ...row, student_name, reason: 'missing_name' })
      continue
    }
    if (!department) {
      // No department in the file — import the row without one
      valid.push({ ...row, student_name, department: '' })
      continue
    }
    const target = mapping?.[department]
    if (!target || !known.has(normCompare(target))) {
      invalid.push({ ...row, department, reason: 'department_skipped' })
      continue
    }
    valid.push({ ...row, student_name, department: target })
  }

  return { valid, invalid }
}

export const REASON_LABELS = {
  missing_name: 'Magaca ardayga maqan',
  missing_department: 'Waaxda maqan',
  department_not_found: 'Waaxda lama helin',
  department_skipped: 'Waaxda lama xulin (skip)',
  duplicate_code: 'ID-ga isku dhacay',
  server_error: 'Khalad server',
}

export function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason
}

// Search terms are embedded in a PostgREST `.or(a.ilike.%q%,b.ilike.%q%)`
// filter. Strip the characters that would break that syntax (or turn into
// unintended SQL wildcards) so a stray comma/parenthesis can't corrupt it.
export function sanitizeSearchTerm(term) {
  return String(term ?? '')
    .replace(/[,()%*\\"]/g, '')
    .trim()
}
