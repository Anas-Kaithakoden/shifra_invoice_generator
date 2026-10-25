import { describe, expect, it } from 'vitest';
import { formatDateDDMMYYYY, isValidISODate, todayISO } from './date';

describe('isValidISODate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidISODate('2026-10-25')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2026-12-31')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    expect(isValidISODate('2023-02-29')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-04-31')).toBe(false);
    expect(isValidISODate('25-10-2026')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });
});

describe('formatDateDDMMYYYY', () => {
  it('converts a valid ISO date to the template format', () => {
    expect(formatDateDDMMYYYY('2026-10-25')).toBe('25/10/2026');
    expect(formatDateDDMMYYYY('2024-02-29')).toBe('29/02/2024');
  });

  it('returns an empty string for invalid dates', () => {
    expect(formatDateDDMMYYYY('2023-02-29')).toBe('');
    expect(formatDateDDMMYYYY('not-a-date')).toBe('');
  });
});

describe('todayISO', () => {
  it('returns a valid local ISO date', () => {
    const value = todayISO();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isValidISODate(value)).toBe(true);
  });
});
