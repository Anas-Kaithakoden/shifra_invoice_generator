import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TYPES,
  buildDocxData,
  calculateInvoice,
  createInitialForm,
  createLineItem,
  makeInvoiceFilename,
  makeSampleItems,
  validateInvoice,
  type InvoiceForm,
} from './invoice';

function requiredForm(overrides: Partial<InvoiceForm> = {}): InvoiceForm {
  return {
    ...createInitialForm(),
    clientName: 'Acme Trading',
    clientAddress: '12 Market Road\nKochi, Kerala 682001',
    serviceName: 'Private Limited Company Registration',
    documentNumber: 'SNT-PI-2026-101',
    ...overrides,
  };
}

function requiredReceiptForm(overrides: Partial<InvoiceForm> = {}): InvoiceForm {
  return {
    ...createInitialForm('receipt'),
    clientName: 'Acme Trading',
    clientAddress: '12 Market Road\nKochi, Kerala 682001',
    serviceName: 'Payment against invoice SNT-INV-2026-101',
    documentNumber: 'SNT-RCT-2026-101',
    invoiceNumber: 'SNT-INV-2026-101',
    invoiceTotal: '20000',
    advance: '5000',
    ...overrides,
  };
}

function itemsFrom(rows: Array<[string, string, string, boolean?]>) {
  return rows.map(([description, qty, amount, included = true]) =>
    createLineItem({ description, qty, amount, included }),
  );
}

describe('initial form and sample data', () => {
  it('starts as a proforma with blank fields, today and six sample rows', () => {
    const form = createInitialForm();
    expect(form.documentType).toBe('proforma');
    expect(form.clientName).toBe('');
    expect(form.clientAddress).toBe('');
    expect(form.clientPhone).toBe('');
    expect(form.clientEmail).toBe('');
    expect(form.serviceName).toBe('');
    expect(form.documentNumber).toBe('');
    expect(form.invoiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(form.invoiceNumber).toBe('');
    expect(form.invoiceTotal).toBe('');
    expect(form.paymentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(form.paymentMode).toBe('');
    expect(form.paymentReference).toBe('');
    expect(form.items).toHaveLength(6);
    expect(form.advance).toBe('');
    expect(form.overrideTotal).toBe(false);
    expect(form.totalLabel).toBe(DOCUMENT_TYPES.proforma.labels.total);
  });

  it('uses invoice-specific default labels when requested', () => {
    const form = createInitialForm('invoice');
    expect(form.documentType).toBe('invoice');
    expect(form.totalLabel).toBe(DOCUMENT_TYPES.invoice.labels.total);
    expect(form.advanceLabel).toBe(DOCUMENT_TYPES.invoice.labels.advance);
    expect(form.balanceLabel).toBe(DOCUMENT_TYPES.invoice.labels.balance);
  });

  it('uses receipt-specific default labels and payment date', () => {
    const form = createInitialForm('receipt');
    expect(form.documentType).toBe('receipt');
    expect(form.totalLabel).toBe(DOCUMENT_TYPES.receipt.labels.total);
    expect(form.advanceLabel).toBe(DOCUMENT_TYPES.receipt.labels.advance);
    expect(form.balanceLabel).toBe(DOCUMENT_TYPES.receipt.labels.balance);
    expect(form.paymentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('creates unique row ids and independent sample arrays', () => {
    const first = makeSampleItems();
    const second = makeSampleItems();
    const ids = [...first, ...second].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(first[0]).not.toBe(second[0]);
  });
});

describe('calculateInvoice', () => {
  it('adds each included row amount and sums the template sample to 19200', () => {
    const calculation = calculateInvoice(createInitialForm());
    expect(calculation.totalPaise).toBe(1_920_000);
    expect(calculation.effectiveTotalPaise).toBe(1_920_000);
    expect(calculation.advancePaise).toBe(0);
    expect(calculation.balancePaise).toBe(1_920_000);
    expect(calculation.includedItems).toHaveLength(6);
    expect(calculation.itemErrorCount).toBe(0);
  });

  it('does not multiply amounts by quantity', () => {
    const form = createInitialForm();
    form.items = itemsFrom([['Service', '5', '1000']]);
    const calculation = calculateInvoice(form);
    expect(calculation.totalPaise).toBe(100_000);
  });

  it('ignores blank rows, zero value rows and rows excluded from the invoice', () => {
    const form = createInitialForm();
    form.items = [
      createLineItem(),
      createLineItem({ description: 'Free service', amount: '0' }),
      createLineItem({ description: 'Excluded', amount: '5000', included: false }),
      createLineItem({ description: 'Included', amount: '1000' }),
    ];
    const calculation = calculateInvoice(form);
    expect(calculation.includedItems).toHaveLength(2);
    expect(calculation.totalPaise).toBe(100_000);
    expect(calculation.outputItems).toEqual([
      { description: 'Free service', qty: '1', amount: '0.00' },
      { description: 'Included', qty: '1', amount: '1,000.00' },
    ]);
  });

  it('does not let errors in excluded or blank rows block the total', () => {
    const form = createInitialForm();
    form.items = [
      createLineItem({ description: '', amount: 'abc', included: false }),
      createLineItem(),
      createLineItem({ description: 'Valid', amount: '100' }),
    ];
    const calculation = calculateInvoice(form);
    expect(calculation.itemErrorCount).toBe(0);
    expect(calculation.totalPaise).toBe(10_000);
  });

  it('marks description, quantity and amount errors for included rows', () => {
    const form = createInitialForm();
    form.items = [
      createLineItem({ description: '', amount: '100' }),
      createLineItem({ description: 'No quantity', qty: '', amount: '100' }),
      createLineItem({ description: 'Bad amount', amount: '12.345' }),
      createLineItem({ description: 'Bad quantity', qty: '1.5', amount: '100' }),
    ];
    const calculation = calculateInvoice(form);
    expect(calculation.itemErrorCount).toBe(4);
    expect(calculation.items[0].descriptionError).toBe('Enter a description.');
    expect(calculation.items[1].qtyError).toBe('Enter a quantity.');
    expect(calculation.items[2].amountError).toBeDefined();
    expect(calculation.items[3].qtyError).toBeDefined();
    expect(calculation.totalPaise).toBeNull();
    expect(calculation.hasErrors).toBe(true);
  });

  it('calculates a manual advance and negative balance', () => {
    const form = createInitialForm();
    form.advance = '5,000';
    let calculation = calculateInvoice(form);
    expect(calculation.advancePaise).toBe(500_000);
    expect(calculation.balancePaise).toBe(1_420_000);
    expect(calculation.advanceExceedsTotal).toBe(false);

    form.advance = '25000';
    calculation = calculateInvoice(form);
    expect(calculation.balancePaise).toBe(-580_000);
    expect(calculation.advanceExceedsTotal).toBe(true);
  });

  it('uses a valid manual total override and reports invalid overrides', () => {
    const form = createInitialForm();
    form.overrideTotal = true;
    form.totalOverride = '20000';
    let calculation = calculateInvoice(form);
    expect(calculation.totalPaise).toBe(1_920_000);
    expect(calculation.effectiveTotalPaise).toBe(2_000_000);
    expect(calculation.balancePaise).toBe(2_000_000);

    form.totalOverride = 'oops';
    calculation = calculateInvoice(form);
    expect(calculation.effectiveTotalPaise).toBeNull();
    expect(calculation.totalOverrideActive).toBe(true);
    expect(calculation.hasErrors).toBe(true);
  });

  it('calculates receipt totals from the invoice total and amount received', () => {
    const calculation = calculateInvoice(requiredReceiptForm());
    expect(calculation.totalPaise).toBe(2_000_000);
    expect(calculation.effectiveTotalPaise).toBe(2_000_000);
    expect(calculation.advancePaise).toBe(500_000);
    expect(calculation.balancePaise).toBe(1_500_000);
    expect(calculation.includedItems).toEqual([]);
    expect(calculation.outputItems).toEqual([]);
    expect(calculation.itemErrorCount).toBe(0);
    expect(calculation.hasErrors).toBe(false);
  });

  it('ignores invalid hidden line items on a receipt', () => {
    const form = requiredReceiptForm({
      items: [
        createLineItem({ description: '', amount: 'bad' }),
        createLineItem({ description: 'Bad quantity', qty: '1.5', amount: '100' }),
      ],
    });
    const calculation = calculateInvoice(form);
    expect(calculation.itemErrorCount).toBe(0);
    expect(calculation.hasErrors).toBe(false);
    expect(calculation.effectiveTotalPaise).toBe(2_000_000);
  });

  it('reports receipt errors and an overpayment balance', () => {
    const missing = calculateInvoice(
      requiredReceiptForm({ invoiceTotal: '', advance: '' }),
    );
    expect(missing.effectiveTotalPaise).toBeNull();
    expect(missing.advancePaise).toBeNull();
    expect(missing.balancePaise).toBeNull();
    expect(missing.hasErrors).toBe(true);

    const overpaid = calculateInvoice(
      requiredReceiptForm({ invoiceTotal: '20000', advance: '25000' }),
    );
    expect(overpaid.balancePaise).toBe(-500_000);
    expect(overpaid.advanceExceedsTotal).toBe(true);
  });
});

describe('validateInvoice', () => {
  it('requires the client, service and document reference', () => {
    const result = validateInvoice(createInitialForm());
    expect(result.success).toBe(false);
    expect(result.errors.clientName).toBeDefined();
    expect(result.errors.clientAddress).toBeDefined();
    expect(result.errors.serviceName).toBeDefined();
    expect(result.errors.documentNumber).toBeDefined();
    expect(result.errors.invoiceDate).toBeUndefined();
  });

  it('uses document-specific validation messages for the number', () => {
    const proforma = validateInvoice(createInitialForm('proforma'));
    expect(proforma.errors.documentNumber).toBe('Proforma invoice number is required.');

    const invoice = validateInvoice(createInitialForm('invoice'));
    expect(invoice.errors.documentNumber).toBe('Invoice number is required.');

    const receipt = validateInvoice(createInitialForm('receipt'));
    expect(receipt.errors.documentNumber).toBe('Receipt number is required.');
  });

  it('accepts a complete valid form', () => {
    expect(validateInvoice(requiredForm()).success).toBe(true);
    expect(validateInvoice(requiredReceiptForm()).success).toBe(true);
  });

  it('validates optional phone and email when supplied', () => {
    const badPhone = validateInvoice(requiredForm({ clientPhone: 'abc' }));
    expect(badPhone.errors.clientPhone).toBeDefined();

    const badEmail = validateInvoice(requiredForm({ clientEmail: 'not-an-email' }));
    expect(badEmail.errors.clientEmail).toBeDefined();

    const good = validateInvoice(
      requiredForm({ clientPhone: '+91 98765 43210', clientEmail: 'client@example.com' }),
    );
    expect(good.success).toBe(true);
  });

  it('reports item errors and ignores excluded rows', () => {
    const form = requiredForm();
    form.items = [
      createLineItem({ description: '', amount: '100' }),
      createLineItem({ description: 'Excluded', amount: 'bad', included: false }),
    ];
    const result = validateInvoice(form);
    expect(result.success).toBe(false);
    expect(result.errors.items).toBeDefined();
    expect(Object.keys(result.itemErrors)).toHaveLength(1);
  });

  it('requires the receipt invoice number, payment date and amounts', () => {
    const form = requiredReceiptForm({
      invoiceNumber: '',
      paymentDate: '',
      invoiceTotal: '',
      advance: '',
      totalLabel: '',
      advanceLabel: '',
      balanceLabel: '',
    });
    const result = validateInvoice(form);
    expect(result.success).toBe(false);
    expect(result.errors.invoiceNumber).toBe('Invoice number is required.');
    expect(result.errors.paymentDate).toBe('Payment date is required.');
    expect(result.errors.invoiceTotal).toBe('Enter an amount.');
    expect(result.errors.advance).toBe('Enter an amount.');
    expect(result.errors.totalLabel).toBeUndefined();
    expect(result.errors.advanceLabel).toBeUndefined();
    expect(result.errors.balanceLabel).toBeUndefined();
  });

  it('does not validate hidden line items or custom labels on a receipt', () => {
    const form = requiredReceiptForm({
      items: [
        createLineItem({ description: '', amount: 'bad' }),
        createLineItem({ description: 'Bad quantity', qty: '1.5', amount: '100' }),
      ],
      totalLabel: '',
      advanceLabel: '',
      balanceLabel: '',
      overrideTotal: true,
      totalOverride: '',
    });
    const result = validateInvoice(form);
    expect(result.success).toBe(true);
    expect(result.errors.items).toBeUndefined();
    expect(result.errors.totalOverride).toBeUndefined();
    expect(result.itemErrors).toEqual({});
  });

  it('validates the advance, override, date and labels', () => {
    const form = requiredForm({
      advance: 'abc',
      overrideTotal: true,
      totalOverride: '',
      invoiceDate: '2026-02-30',
      totalLabel: '',
      advanceLabel: '',
      balanceLabel: '',
    });
    const result = validateInvoice(form);
    expect(result.errors.advance).toBeDefined();
    expect(result.errors.totalOverride).toBeDefined();
    expect(result.errors.invoiceDate).toBeDefined();
    expect(result.errors.totalLabel).toBeDefined();
    expect(result.errors.advanceLabel).toBeDefined();
    expect(result.errors.balanceLabel).toBeDefined();
  });
});

describe('buildDocxData', () => {
  it('uses formatted rupee values, the date format and visible rows only', () => {
    const form = requiredForm({
      clientPhone: '+91 98765 43210',
      clientEmail: 'client@example.com',
      advance: '5000',
    });
    const calculation = calculateInvoice(form);
    const data = buildDocxData(form, calculation);

    expect(data.clientName).toBe('Acme Trading');
    expect(data.clientContact).toBe('+91 98765 43210  |  client@example.com');
    expect(data.documentNumber).toBe('SNT-PI-2026-101');
    expect(data.invoiceDate).toBe(formatDate(form.invoiceDate));
    expect(data.total).toBe('₹19,200.00');
    expect(data.advance).toBe('₹5,000.00');
    expect(data.balance).toBe('₹14,200.00');
    expect(data.items).toHaveLength(6);
    expect(data.items[0]).toEqual({
      description: 'Company Incorporation Professional Fee',
      qty: '1',
      amount: '3,500.00',
    });
  });

  it('builds receipt-specific values and fixed labels', () => {
    const form = requiredReceiptForm({
      paymentDate: '2026-10-26',
      paymentMode: 'Bank Transfer',
      paymentReference: 'UTR12345',
    });
    const calculation = calculateInvoice(form);
    const data = buildDocxData(form, calculation);

    expect(data.documentNumber).toBe('SNT-RCT-2026-101');
    expect(data.totalLabel).toBe(DOCUMENT_TYPES.receipt.labels.total);
    expect(data.advanceLabel).toBe(DOCUMENT_TYPES.receipt.labels.advance);
    expect(data.balanceLabel).toBe(DOCUMENT_TYPES.receipt.labels.balance);
    expect(data.total).toBe('₹20,000.00');
    expect(data.advance).toBe('₹5,000.00');
    expect(data.balance).toBe('₹15,000.00');
    expect(data.invoiceNumber).toBe('SNT-INV-2026-101');
    expect(data.receiptAmount).toBe('5,000.00');
    expect(data.paymentDate).toBe('26/10/2026');
    expect(data.paymentMode).toBe('Bank Transfer');
    expect(data.paymentReference).toBe('UTR12345');
    expect(data.items).toEqual([]);
  });
});

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

describe('makeInvoiceFilename', () => {
  it('sanitizes the document number and keeps a .docx extension', () => {
    expect(makeInvoiceFilename('proforma', 'SNT-PI-2026-101')).toBe(
      'Proforma_Invoice_SNT-PI-2026-101.docx',
    );
    expect(makeInvoiceFilename('proforma', '  SNT PI 101  ')).toBe(
      'Proforma_Invoice_SNT_PI_101.docx',
    );
    expect(makeInvoiceFilename('proforma', 'A/B:C*D?')).toBe(
      'Proforma_Invoice_A-B-C-D-.docx',
    );
  });

  it('uses the invoice and receipt prefixes', () => {
    expect(makeInvoiceFilename('invoice', 'SNT-INV-2026-101')).toBe(
      'Invoice_SNT-INV-2026-101.docx',
    );
    expect(makeInvoiceFilename('receipt', 'SNT-RCT-2026-101')).toBe(
      'Receipt_SNT-RCT-2026-101.docx',
    );
  });

  it('falls back to Draft when there is no usable number', () => {
    expect(makeInvoiceFilename('proforma', '')).toBe('Proforma_Invoice_Draft.docx');
    expect(makeInvoiceFilename('invoice', '???')).toBe('Invoice_---.docx');
  });
});
