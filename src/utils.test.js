import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, GENDER_LABEL } from './utils'

describe('formatDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })

  it('formats ISO date', () => {
    const result = formatDate('2026-08-13T14:38:57.694Z')
    expect(result).toMatch(/Aug/)
    expect(result).toMatch(/13/)
    expect(result).toMatch(/2026/)
  })
})

describe('formatDateTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDateTime(null)).toBe('')
  })

  it('returns date and time separated by " - "', () => {
    const result = formatDateTime('2026-09-12T10:00:00.000Z')
    expect(result).toContain(' - ')
    expect(result).toMatch(/Sep/)
    expect(result).toMatch(/12/)
    expect(result).toMatch(/2026/)
  })
})

describe('GENDER_LABEL', () => {
  it('maps Somali gender codes to English labels', () => {
    expect(GENDER_LABEL.lab).toBe('Male')
    expect(GENDER_LABEL.dhadig).toBe('Female')
    expect(GENDER_LABEL.male).toBe('Male')
    expect(GENDER_LABEL.female).toBe('Female')
  })
})