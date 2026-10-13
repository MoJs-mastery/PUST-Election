import { describe, it, expect } from 'vitest'
import {
  normalizeHeader,
  rowsFromMatrix,
  validateRows,
  autoMapDepartments,
  applyDepartmentMapping,
  reasonLabel,
  sanitizeSearchTerm,
} from './studentsImport'

describe('normalizeHeader', () => {
  it('lowercases and strips separators', () => {
    expect(normalizeHeader('Student_Name')).toBe('studentname')
    expect(normalizeHeader(' Student Name ')).toBe('studentname')
    expect(normalizeHeader('Department')).toBe('department')
  })
})

describe('rowsFromMatrix', () => {
  it('maps recognised headers and trims values', () => {
    const matrix = [
      ['Student Name', 'Department', 'Semester'],
      ['  Ali Yusuf ', ' IT ', ' 1 '],
    ]
    const { rows, missing } = rowsFromMatrix(matrix)
    expect(missing).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      student_name: 'Ali Yusuf',
      department: 'IT',
      semester: '1',
      row: 2,
    })
  })

  it('accepts alternative header spellings', () => {
    const matrix = [
      ['magaca', 'waaxda', 'sem'],
      ['Hodan', 'Nursing', '2'],
    ]
    const { rows, missing } = rowsFromMatrix(matrix)
    expect(missing).toEqual([])
    expect(rows[0].student_name).toBe('Hodan')
    expect(rows[0].department).toBe('Nursing')
  })

  it('reports missing required columns', () => {
    const { missing } = rowsFromMatrix([['Name', 'Semester'], ['Ali', '1']])
    expect(missing).toContain('department')
  })

  it('skips blank rows and numbers lines including the header', () => {
    const matrix = [
      ['Name', 'Department', 'Semester'],
      [''],
      ['Ali', 'IT', '1'],
      ['', '', ''],
      ['Hodan', 'IT', '2'],
    ]
    const { rows } = rowsFromMatrix(matrix)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.row)).toEqual([3, 5])
  })

  it('tolerates a semester column being absent', () => {
    const { rows } = rowsFromMatrix([['Name', 'Department'], ['Ali', 'IT']])
    expect(rows[0].semester).toBe('')
  })

  it('matches verbose/trailing-text headers by keyword', () => {
    const matrix = [
      ['Student Full Name', 'Department Name', 'Semester (1-8)'],
      ['Ali Yusuf', 'IT', '1'],
    ]
    const { rows, missing } = rowsFromMatrix(matrix)
    expect(missing).toEqual([])
    expect(rows[0]).toMatchObject({ student_name: 'Ali Yusuf', department: 'IT', semester: '1' })
  })

  it('matches Somali headers', () => {
    const matrix = [
      ['Magaca Ardayga', 'Waaxda Ardayga', 'Sanadka'],
      ['Hodan', 'Nursing', '2'],
    ]
    const { rows, missing } = rowsFromMatrix(matrix)
    expect(missing).toEqual([])
    expect(rows[0]).toMatchObject({
      student_name: 'Hodan',
      department: 'Nursing',
      semester: '2',
    })
  })

  it('does not claim "Department Name" as the student name column', () => {
    const matrix = [['Department Name', 'Full Name'], ['IT', 'Ali Yusuf']]
    const { rows, missing } = rowsFromMatrix(matrix)
    expect(missing).toEqual([])
    expect(rows[0]).toMatchObject({ department: 'IT', student_name: 'Ali Yusuf' })
  })

  it('auto-maps departments that already match (ignoring case/space)', () => {
    const map = autoMapDepartments(['it', 'Nursing', 'Unknown'], ['IT', 'Nursing'])
    expect(map).toEqual({ it: 'IT', Nursing: 'Nursing', Unknown: '' })
  })

  it('auto-maps departments hiding non-breaking or doubled spaces', () => {
    const map = autoMapDepartments(
      ['Business\u00a0Administration', 'Computer  Science'],
      ['Business Administration', 'Computer Science']
    )
    expect(map).toEqual({
      'Business\u00a0Administration': 'Business Administration',
      'Computer  Science': 'Computer Science',
    })
  })

  it('collapses hidden whitespace inside parsed cells', () => {
    const matrix = [['Name', 'Department'], ['Ali  Yusuf', 'Business\u00a0Administration']]
    const { rows } = rowsFromMatrix(matrix)
    expect(rows[0].student_name).toBe('Ali Yusuf')
    expect(rows[0].department).toBe('Business Administration')
  })

  it('honours a forced column mapping when the header is unclear', () => {
    const matrix = [
      ['Student Name', '', 'Semester'],
      ['Ali Yusuf', 'Information Technology', '1'],
    ]
    const { rows, missing } = rowsFromMatrix(matrix, {
      student_name: 0,
      department: 1,
      semester: 2,
    })
    expect(missing).toEqual([])
    expect(rows[0]).toMatchObject({
      student_name: 'Ali Yusuf',
      department: 'Information Technology',
      semester: '1',
    })
  })

  it('applies the mapping and rejects skipped departments', () => {
    const rows = [
      { student_name: 'Ali', department: 'Information Technology', semester: '1', row: 2 },
      { student_name: 'Hodan', department: 'Business Administration', semester: '2', row: 3 },
    ]
    const mapping = { 'Information Technology': 'IT', 'Business Administration': '' }
    const { valid, invalid } = applyDepartmentMapping(rows, mapping, ['IT', 'Nursing'])
    expect(valid).toHaveLength(1)
    expect(valid[0]).toMatchObject({ student_name: 'Ali', department: 'IT' })
    expect(invalid).toHaveLength(1)
    expect(invalid[0].reason).toBe('department_skipped')
  })
})

describe('validateRows', () => {
  const departments = ['IT', 'Nursing', 'Business']

  it('keeps valid rows and canonicalises the department', () => {
    const { valid, invalid } = validateRows(
      [{ student_name: 'Ali', department: 'it', semester: '1', row: 2 }],
      departments
    )
    expect(invalid).toHaveLength(0)
    expect(valid[0].department).toBe('IT')
  })

  it('rejects rows without a name, without a department, or unknown dept', () => {
    const { valid, invalid } = validateRows(
      [
        { student_name: '', department: 'IT', semester: '1', row: 2 },
        { student_name: 'Ali', department: '', semester: '1', row: 3 },
        { student_name: 'Hodan', department: 'Law', semester: '1', row: 4 },
        { student_name: 'Said', department: 'Business', semester: '', row: 5 },
      ],
      departments
    )
    expect(valid.map((r) => r.student_name)).toEqual(['Said'])
    expect(invalid.map((r) => r.reason)).toEqual([
      'missing_name',
      'missing_department',
      'department_not_found',
    ])
  })

  it('matches departments case-insensitively and ignores extra whitespace', () => {
    const { valid } = validateRows(
      [{ student_name: 'A', department: '  nursing ', semester: '1', row: 2 }],
      departments
    )
    expect(valid[0].department).toBe('Nursing')
  })

  it('assigns each student their row-specific department directly from the file', () => {
    const { valid, invalid } = validateRows(
      [
        { student_name: 'Student One', department: 'IT', semester: '1', row: 2 },
        { student_name: 'Student Two', department: 'Nursing', semester: '2', row: 3 },
        { student_name: 'Student Three', department: 'Business', semester: '3', row: 4 },
      ],
      departments
    )
    expect(invalid).toHaveLength(0)
    expect(valid).toHaveLength(3)
    expect(valid[0]).toMatchObject({ student_name: 'Student One', department: 'IT', semester: '1', row: 2 })
    expect(valid[1]).toMatchObject({ student_name: 'Student Two', department: 'Nursing', semester: '2', row: 3 })
    expect(valid[2]).toMatchObject({ student_name: 'Student Three', department: 'Business', semester: '3', row: 4 })
  })

  it('identifies the affected student and row when department is not found or missing', () => {
    const { valid, invalid } = validateRows(
      [
        { student_name: 'Valid Student', department: 'IT', semester: '1', row: 2 },
        { student_name: 'Invalid Dept Student', department: 'Medicine', semester: '1', row: 3 },
        { student_name: 'Missing Dept Student', department: '', semester: '2', row: 4 },
      ],
      departments
    )
    expect(valid).toHaveLength(1)
    expect(invalid).toHaveLength(2)
    expect(invalid[0]).toMatchObject({
      row: 3,
      student_name: 'Invalid Dept Student',
      department: 'Medicine',
      reason: 'department_not_found',
    })
    expect(invalid[1]).toMatchObject({
      row: 4,
      student_name: 'Missing Dept Student',
      department: '',
      reason: 'missing_department',
    })
  })
})

describe('reasonLabel', () => {
  it('translates known reasons and passes through unknown ones', () => {
    expect(reasonLabel('missing_name')).toBe('Magaca ardayga maqan')
    expect(reasonLabel('something_else')).toBe('something_else')
  })
})

describe('sanitizeSearchTerm', () => {
  it('removes PostgREST filter syntax and SQL wildcards', () => {
    expect(sanitizeSearchTerm('  ali  ')).toBe('ali')
    expect(sanitizeSearchTerm('a,b(c)%*\\"d')).toBe('abcd')
  })

  it('tolerates null and undefined', () => {
    expect(sanitizeSearchTerm(null)).toBe('')
    expect(sanitizeSearchTerm(undefined)).toBe('')
  })
})
