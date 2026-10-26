import { z } from 'zod';
import { formatINR, formatINRWithoutSymbol, parseMoneyInput, sumPaise } from './money';
import { formatDateDDMMYYYY, isValidISODate, todayISO } from './date';

export const DOCUMENT_TYPES = {
  proforma: {
    label: 'Proforma invoice',
    shortLabel: 'Proforma',
    previewTitle: 'PROFORMA INVOICE',
    numberLabel: 'Proforma No:',
    formNumberLabel: 'Proforma Invoice Number',
    numberPlaceholder: 'e.g. SNT-PI-2026-101',
    numberErrorLabel: 'Proforma invoice number',
    filenamePrefix: 'Proforma_Invoice',
    footer: 'This is a proforma invoice, not a tax invoice or proof of payment.',
    templatePath: 'templates/shifra-proforma-template.docx',
    labels: {
      total: 'Estimated Total',
      advance: 'Amount Payable in Advance',
      balance: 'Balance',
    },
    summaryTitle: 'Estimated total, advance and balance',
    summaryDescription:
      'The estimated total comes from the included line items. Enter the advance manually; the balance is calculated as estimated total minus advance.',
    totalOverrideLabel: 'Override the estimated total manually',
    manualTotalLabel: 'Manual estimated total',
    advanceHint: 'Leave blank if no advance has been paid.',
    advanceExceedsMessage:
      'The advance is higher than the estimated total, so the balance is negative. Review the payment figures before sending the invoice.',
    totalInvalidMessage:
      'The estimated total cannot be calculated until every included line amount is valid.',
    advanceLabelField: 'Advance label',
  },
  invoice: {
    label: 'Invoice',
    shortLabel: 'Invoice',
    previewTitle: 'INVOICE',
    numberLabel: 'Invoice No:',
    formNumberLabel: 'Invoice Number',
    numberPlaceholder: 'e.g. SNT-INV-2026-101',
    numberErrorLabel: 'Invoice number',
    filenamePrefix: 'Invoice',
    footer: 'Please quote the invoice number when making payment.',
    templatePath: 'templates/shifra-invoice-template.docx',
    labels: {
      total: 'Total Amount',
      advance: 'Amount Received',
      balance: 'Balance Due',
    },
    summaryTitle: 'Total, amount received and balance',
    summaryDescription:
      'The total comes from the included line items. Enter the amount received manually; the balance is calculated as total minus amount received.',
    totalOverrideLabel: 'Override the total manually',
    manualTotalLabel: 'Manual total',
    advanceHint: 'Leave blank if nothing has been received yet.',
    advanceExceedsMessage:
      'The amount received is higher than the total, so the balance is negative. Review the payment figures before sending the invoice.',
    totalInvalidMessage:
      'The total cannot be calculated until every included line amount is valid.',
    advanceLabelField: 'Received label',
  },
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;

export type LineItem = {
  id: string;
  description: string;
  qty: string;
  amount: string;
  included: boolean;
};

export type InvoiceForm = {
  documentType: DocumentType;
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;
  serviceName: string;
  documentNumber: string;
  invoiceDate: string;
  items: LineItem[];
  advance: string;
  overrideTotal: boolean;
  totalOverride: string;
  totalLabel: string;
  advanceLabel: string;
  balanceLabel: string;
};

export type ItemErrors = {
  description?: string;
  qty?: string;
  amount?: string;
};

export type ItemCalculation = {
  item: LineItem;
  isEmpty: boolean;
  descriptionError?: string;
  qtyError?: string;
  amountError?: string;
  amountPaise: number | null;
};

export type InvoiceCalculation = {
  items: ItemCalculation[];
  includedItems: ItemCalculation[];
  totalPaise: number | null;
  effectiveTotalPaise: number | null;
  advancePaise: number | null;
  balancePaise: number | null;
  totalOverrideActive: boolean;
  advanceExceedsTotal: boolean;
  itemErrorCount: number;
  hasErrors: boolean;
  outputItems: Array<{ description: string; qty: string; amount: string }>;
};

export type InvoiceDocxData = {
  clientName: string;
  clientAddress: string;
  clientContact: string;
  serviceName: string;
  documentNumber: string;
  invoiceDate: string;
  totalLabel: string;
  advanceLabel: string;
  balanceLabel: string;
  total: string;
  advance: string;
  balance: string;
  items: Array<{ description: string; qty: string; amount: string }>;
};

const SAMPLE_ITEM_DATA = [
  { description: 'Company Incorporation Professional Fee', amount: '3500' },
  { description: 'Name Reservation', amount: '1000' },
  { description: 'Stamp Duty and PAN', amount: '3200' },
  { description: 'Digital Signature 2 Directors', amount: '4000' },
  { description: 'Certification Charges', amount: '1500' },
  { description: 'DIR-KYC renewal fine and fee', amount: '6000' },
];

let idCounter = 0;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `line-item-${Date.now()}-${idCounter}`;
}

export function createLineItem(
  values: Partial<Pick<LineItem, 'description' | 'qty' | 'amount' | 'included'>> = {},
): LineItem {
  return {
    id: createId(),
    description: values.description ?? '',
    qty: values.qty ?? '1',
    amount: values.amount ?? '',
    included: values.included ?? true,
  };
}

export function makeSampleItems(): LineItem[] {
  return SAMPLE_ITEM_DATA.map((row) => createLineItem(row));
}

export function createInitialForm(documentType: DocumentType = 'proforma'): InvoiceForm {
  const labels = DOCUMENT_TYPES[documentType].labels;
  return {
    documentType,
    clientName: '',
    clientAddress: '',
    clientPhone: '',
    clientEmail: '',
    serviceName: '',
    documentNumber: '',
    invoiceDate: todayISO(),
    items: makeSampleItems(),
    advance: '',
    overrideTotal: false,
    totalOverride: '',
    totalLabel: labels.total,
    advanceLabel: labels.advance,
    balanceLabel: labels.balance,
  };
}

export function createBlankForm(documentType: DocumentType = 'proforma'): InvoiceForm {
  return { ...createInitialForm(documentType), items: [] };
}

function isBlankRow(item: LineItem): boolean {
  const qty = item.qty.trim();
  return (
    !item.description.trim() &&
    !item.amount.trim() &&
    (qty === '' || qty === '1')
  );
}

export function calculateLineItems(items: LineItem[]): ItemCalculation[] {
  return items.map((item) => {
    if (!item.included) {
      return { item, isEmpty: true, amountPaise: 0 };
    }
    if (isBlankRow(item)) {
      return { item, isEmpty: true, amountPaise: 0 };
    }

    const calculation: ItemCalculation = {
      item,
      isEmpty: false,
      amountPaise: 0,
    };

    if (!item.description.trim()) {
      calculation.descriptionError = 'Enter a description.';
    } else if (item.description.trim().length > 300) {
      calculation.descriptionError = 'Keep the description under 300 characters.';
    }

    const qty = item.qty.trim();
    const qtyNumber = Number(qty);
    if (!qty) {
      calculation.qtyError = 'Enter a quantity.';
    } else if (!/^\d{1,6}$/.test(qty) || !Number.isInteger(qtyNumber) || qtyNumber < 1) {
      calculation.qtyError = 'Use a whole number of 1 or more.';
    }

    const amount = parseMoneyInput(item.amount);
    if (!amount.ok) {
      calculation.amountError = amount.error;
    } else {
      calculation.amountPaise = amount.paise;
    }

    return calculation;
  });
}

export function calculateInvoice(form: InvoiceForm): InvoiceCalculation {
  const items = calculateLineItems(form.items);
  const includedItems = items.filter((entry) => !entry.isEmpty);
  const itemErrorCount = includedItems.filter(
    (entry) => entry.descriptionError || entry.qtyError || entry.amountError,
  ).length;
  const totalPaise =
    itemErrorCount > 0
      ? null
      : sumPaise(
          includedItems.map((entry) => entry.amountPaise ?? 0),
        );

  const advanceResult = parseMoneyInput(form.advance);
  const advancePaise = advanceResult.ok ? advanceResult.paise : null;

  let effectiveTotalPaise = totalPaise;
  if (form.overrideTotal) {
    const overrideResult = parseMoneyInput(form.totalOverride, { allowEmpty: false });
    effectiveTotalPaise = overrideResult.ok ? overrideResult.paise : null;
  }

  const balancePaise =
    effectiveTotalPaise !== null && advancePaise !== null
      ? effectiveTotalPaise - advancePaise
      : null;

  const advanceExceedsTotal =
    effectiveTotalPaise !== null &&
    advancePaise !== null &&
    advancePaise > effectiveTotalPaise;

  const outputItems = includedItems
    .filter(
      (entry) =>
        !entry.descriptionError &&
        !entry.qtyError &&
        !entry.amountError,
    )
    .map((entry) => ({
      description: entry.item.description.trim(),
      qty: entry.item.qty.trim(),
      amount: formatINRWithoutSymbol(entry.amountPaise ?? 0),
    }));

  return {
    items,
    includedItems,
    totalPaise,
    effectiveTotalPaise,
    advancePaise,
    balancePaise,
    totalOverrideActive: form.overrideTotal,
    advanceExceedsTotal,
    itemErrorCount,
    hasErrors:
      itemErrorCount > 0 || !advanceResult.ok || effectiveTotalPaise === null,
    outputItems,
  };
}

const optionalPhone = z
  .string()
  .trim()
  .max(40, 'Phone number is too long.')
  .refine((value) => {
    if (!value) return true;
    if (!/^[+()0-9.\-\s]+$/.test(value)) return false;
    const digits = value.replace(/\D/g, '');
    return digits.length >= 6 && digits.length <= 15;
  }, 'Enter a valid phone number.');

const optionalEmail = z
  .string()
  .trim()
  .max(160, 'Email address is too long.')
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'Enter a valid email address.',
  );

function makeStaticSchema(documentType: DocumentType) {
  const config = DOCUMENT_TYPES[documentType];
  return z.object({
    documentType: z.enum(['proforma', 'invoice']),
    clientName: z
      .string()
      .trim()
      .min(1, 'Client / business name is required.')
      .max(160, 'Client / business name is too long.'),
    clientAddress: z
      .string()
      .trim()
      .min(1, 'Client address is required.')
      .max(600, 'Client address is too long.'),
    clientPhone: optionalPhone,
    clientEmail: optionalEmail,
    serviceName: z
      .string()
      .trim()
      .min(1, 'Service / invoice title is required.')
      .max(200, 'Service / invoice title is too long.'),
    documentNumber: z
      .string()
      .trim()
      .min(1, `${config.numberErrorLabel} is required.`)
      .max(80, `${config.numberErrorLabel} is too long.`)
      .refine(
        (value) => !/[\r\n\t]/.test(value),
        `${config.numberErrorLabel} cannot contain line breaks.`,
      ),
    invoiceDate: z
      .string()
      .min(1, 'Invoice date is required.')
      .refine(isValidISODate, 'Enter a valid invoice date.'),
    totalLabel: z
      .string()
      .trim()
      .min(1, 'Total label is required.')
      .max(60, 'Label is too long.'),
    advanceLabel: z
      .string()
      .trim()
      .min(1, `${config.advanceLabelField} is required.`)
      .max(60, 'Label is too long.'),
    balanceLabel: z
      .string()
      .trim()
      .min(1, 'Balance label is required.')
      .max(60, 'Label is too long.'),
  });
}

export type ValidationResult = {
  success: boolean;
  errors: Record<string, string>;
  itemErrors: Record<string, ItemErrors>;
};

export function validateInvoice(form: InvoiceForm): ValidationResult {
  const errors: Record<string, string> = {};
  const itemErrors: Record<string, ItemErrors> = {};

  const parsed = makeStaticSchema(form.documentType).safeParse(form);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      if (key && !errors[key]) errors[key] = issue.message;
    }
  }

  const calculation = calculateLineItems(form.items);
  for (const entry of calculation) {
    if (entry.isEmpty) continue;
    const rowErrors: ItemErrors = {};
    if (entry.descriptionError) rowErrors.description = entry.descriptionError;
    if (entry.qtyError) rowErrors.qty = entry.qtyError;
    if (entry.amountError) rowErrors.amount = entry.amountError;
    if (Object.keys(rowErrors).length > 0) {
      itemErrors[entry.item.id] = rowErrors;
    }
  }

  if (Object.keys(itemErrors).length > 0) {
    errors.items = 'Fix the highlighted line items before generating the document.';
  }

  const advance = parseMoneyInput(form.advance);
  if (!advance.ok) errors.advance = advance.error;

  if (form.overrideTotal) {
    const override = parseMoneyInput(form.totalOverride, { allowEmpty: false });
    if (!override.ok) errors.totalOverride = override.error;
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
    itemErrors,
  };
}

export function buildDocxData(
  form: InvoiceForm,
  calculation: InvoiceCalculation,
): InvoiceDocxData {
  const contact = [form.clientPhone.trim(), form.clientEmail.trim()]
    .filter(Boolean)
    .join('  |  ');

  return {
    clientName: form.clientName.trim(),
    clientAddress: form.clientAddress.trim(),
    clientContact: contact,
    serviceName: form.serviceName.trim(),
    documentNumber: form.documentNumber.trim(),
    invoiceDate: formatDateDDMMYYYY(form.invoiceDate),
    totalLabel: form.totalLabel.trim(),
    advanceLabel: form.advanceLabel.trim(),
    balanceLabel: form.balanceLabel.trim(),
    total: formatINR(calculation.effectiveTotalPaise ?? 0),
    advance: formatINR(calculation.advancePaise ?? 0),
    balance: formatINR(calculation.balancePaise ?? 0),
    items: calculation.outputItems,
  };
}

export function makeInvoiceFilename(
  documentType: DocumentType,
  documentNumber: string,
): string {
  const safe = documentNumber
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 80);
  return `${DOCUMENT_TYPES[documentType].filenamePrefix}_${safe || 'Draft'}.docx`;
}
