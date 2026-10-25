import { describe, expect, it } from 'vitest';
import {
  MAX_PAISE,
  formatINR,
  formatINRWithoutSymbol,
  formatIndianNumber,
  parseMoneyInput,
  sumPaise,
} from './money';

describe('parseMoneyInput', () => {
  it('treats blank input as zero by default', () => {
    expect(parseMoneyInput('')).toEqual({ ok: true, paise: 0 });
    expect(parseMoneyInput('   ')).toEqual({ ok: true, paise: 0 });
  });

  it('can require a value', () => {
    expect(parseMoneyInput('', { allowEmpty: false })).toEqual({
      ok: false,
      error: 'Enter an amount.',
    });
  });

  it('parses whole rupees, decimals, symbols, commas and spaces', () => {
    expect(parseMoneyInput('19200')).toEqual({ ok: true, paise: 1_920_000 });
    expect(parseMoneyInput('₹ 19,200.50')).toEqual({ ok: true, paise: 1_920_050 });
    expect(parseMoneyInput(' 1,23,456.7 ')).toEqual({ ok: true, paise: 12_345_670 });
    expect(parseMoneyInput('0.01')).toEqual({ ok: true, paise: 1 });
    expect(parseMoneyInput('0')).toEqual({ ok: true, paise: 0 });
  });

  it('rejects negative, malformed and over-precision amounts', () => {
    expect(parseMoneyInput('-1')).toEqual({
      ok: false,
      error: 'Amount cannot be negative.',
    });
    expect(parseMoneyInput('1.234').ok).toBe(false);
    expect(parseMoneyInput('12.3.4').ok).toBe(false);
    expect(parseMoneyInput('1e3').ok).toBe(false);
    expect(parseMoneyInput('₹').ok).toBe(false);
  });

  it('enforces the maximum amount in integer paise', () => {
    expect(parseMoneyInput('9999999999.99')).toEqual({ ok: true, paise: MAX_PAISE });
    expect(parseMoneyInput('10000000000').ok).toBe(false);
    expect(parseMoneyInput('99999999999.99').ok).toBe(false);
  });
});

describe('formatting', () => {
  it('uses Indian digit grouping and two decimal places', () => {
    expect(formatIndianNumber(1_920_000)).toBe('19,200.00');
    expect(formatIndianNumber(12_345_670)).toBe('1,23,456.70');
    expect(formatIndianNumber(100_000)).toBe('1,000.00');
    expect(formatIndianNumber(10_000_000)).toBe('1,00,000.00');
  });

  it('adds the rupee symbol and places a negative sign before it', () => {
    expect(formatINR(1_920_000)).toBe('₹19,200.00');
    expect(formatINR(-1_920_000)).toBe('-₹19,200.00');
    expect(formatINRWithoutSymbol(1_920_000)).toBe('19,200.00');
    expect(formatINRWithoutSymbol(-1_920_000)).toBe('-19,200.00');
  });
});

describe('sumPaise', () => {
  it('adds integer paise without floating point rounding', () => {
    expect(sumPaise([1, 2, 3])).toBe(6);
    expect(sumPaise([])).toBe(0);
    expect(sumPaise([Number.MAX_SAFE_INTEGER - 1, 1])).toBe(Number.MAX_SAFE_INTEGER);
  });
});
