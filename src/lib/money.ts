export const MAX_PAISE = 999_999_999_999; // ₹9,99,99,99,999.99

export type MoneyParseResult =
  | { ok: true; paise: number }
  | { ok: false; error: string };

const numberFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Parse a user-entered rupee value into integer paise.
 * Empty input means zero unless `allowEmpty` is false.
 * Currency symbols, Indian grouping commas and ordinary spaces are accepted.
 * Anything else is rejected rather than silently discarded.
 */
export function parseMoneyInput(
  raw: string,
  { allowEmpty = true }: { allowEmpty?: boolean } = {},
): MoneyParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return allowEmpty
      ? { ok: true, paise: 0 }
      : { ok: false, error: 'Enter an amount.' };
  }

  if (trimmed.startsWith('-')) {
    return { ok: false, error: 'Amount cannot be negative.' };
  }

  const cleaned = trimmed.replace(/[₹,\s]/g, '');
  if (!cleaned) {
    return { ok: false, error: 'Enter a valid amount.' };
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) {
    return {
      ok: false,
      error: 'Use numbers only, with up to 2 decimal places (for example 19,200.00).',
    };
  }

  const [rupeesPart, paisePart = ''] = cleaned.split('.');
  const rupees = Number(rupeesPart);
  const paise = rupees * 100 + Number(paisePart.padEnd(2, '0'));

  if (!Number.isSafeInteger(paise) || paise > MAX_PAISE) {
    return { ok: false, error: 'Amount is too large.' };
  }

  return { ok: true, paise };
}

export function formatIndianNumber(paise: number): string {
  return numberFormatter.format(Math.abs(paise) / 100);
}

/** Format paise as ₹19,200.00, with the sign before the currency symbol. */
export function formatINR(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  return `${sign}₹${formatIndianNumber(paise)}`;
}

/** Format paise without the currency symbol, for the item table's ₹ column. */
export function formatINRWithoutSymbol(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  return `${sign}${formatIndianNumber(paise)}`;
}

export function sumPaise(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
