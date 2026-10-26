import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import { renderInvoiceDocx } from './docx';
import { DOCUMENT_TYPES, type DocumentType, type InvoiceDocxData } from './invoice';

function readArrayBuffer(path: string): ArrayBuffer {
  const buffer = readFileSync(path);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function templatePath(name: string): string {
  return fileURLToPath(new URL(`../../${name}`, import.meta.url));
}

const templates: Record<DocumentType, ArrayBuffer> = {
  proforma: readArrayBuffer(templatePath('public/templates/shifra-proforma-template.docx')),
  invoice: readArrayBuffer(templatePath('public/templates/shifra-invoice-template.docx')),
  receipt: readArrayBuffer(templatePath('public/templates/shifra-receipt-template.docx')),
};

const sourceFooters: Record<DocumentType, string> = {
  proforma: new PizZip(
    readArrayBuffer(templatePath('templates/source/Shifra_Nuha_Proforma_Invoice_Template.docx')),
  )
    .file('word/footer1.xml')!
    .asText(),
  invoice: new PizZip(
    readArrayBuffer(templatePath('templates/source/Shifra_Nuha_Invoice_Template.docx')),
  )
    .file('word/footer1.xml')!
    .asText(),
  receipt: new PizZip(
    readArrayBuffer(templatePath('templates/source/Shifra_Nuha_Receipt_Template.docx')),
  )
    .file('word/footer1.xml')!
    .asText(),
};

function baseData(
  documentType: DocumentType,
  items: InvoiceDocxData['items'],
): InvoiceDocxData {
  const labels = DOCUMENT_TYPES[documentType].labels;
  const documentNumbers: Record<DocumentType, string> = {
    proforma: 'SNT-PI-2026-101',
    invoice: 'SNT-INV-2026-101',
    receipt: 'SNT-RCT-2026-101',
  };
  return {
    clientName: 'Acme Trading',
    clientAddress: '12 Market Road\nKochi, Kerala 682001',
    clientContact: '+91 98765 43210  |  client@example.com',
    serviceName: 'Private Limited Company Registration',
    documentNumber: documentNumbers[documentType],
    invoiceDate: '25/10/2026',
    totalLabel: labels.total,
    advanceLabel: labels.advance,
    balanceLabel: labels.balance,
    total: '₹19,200.00',
    advance: '₹5,000.00',
    balance: '₹14,200.00',
    invoiceNumber: documentType === 'receipt' ? 'SNT-INV-2026-101' : '',
    receiptAmount: '5,000.00',
    paymentDate: '26/10/2026',
    paymentMode: 'Bank Transfer',
    paymentReference: 'UTR12345',
    items,
  };
}

function renderToZip(documentType: DocumentType, data: InvoiceDocxData) {
  return new PizZip(renderInvoiceDocx(templates[documentType], data));
}

function documentXml(zip: PizZip): string {
  return zip.file('word/document.xml')!.asText();
}

function itemTable(xml: string): string {
  const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? [];
  return tables.find((table) => table.includes('DESCRIPTION')) ?? '';
}

const sixItems = [
  { description: 'Company Incorporation Professional Fee', qty: '1', amount: '3,500.00' },
  { description: 'Name Reservation', qty: '1', amount: '1,000.00' },
  { description: 'Stamp Duty and PAN', qty: '1', amount: '3,200.00' },
  { description: 'Digital Signature 2 Directors', qty: '1', amount: '4,000.00' },
  { description: 'Certification Charges', qty: '1', amount: '1,500.00' },
  { description: 'DIR-KYC renewal fine and fee', qty: '1', amount: '6,000.00' },
];

describe('renderInvoiceDocx', () => {
  it('renders the proforma client, summary and six items without unresolved tags', () => {
    const zip = renderToZip('proforma', baseData('proforma', sixItems));
    const xml = documentXml(zip);
    const table = itemTable(xml);

    expect(xml).toContain('PROFORMA INVOICE');
    expect(xml).toContain('Proforma No:');
    expect(xml).toContain('Acme Trading');
    expect(xml).toContain('12 Market Road');
    expect(xml).toContain('Private Limited Company Registration');
    expect(xml).toContain('SNT-PI-2026-101');
    expect(xml).toContain('25/10/2026');
    expect(xml).toContain('Estimated Total');
    expect(xml).toContain('₹19,200.00');
    expect(xml).toContain('Amount Payable in Advance');
    expect(xml).toContain('₹5,000.00');
    expect(xml).toContain('Balance');
    expect(xml).toContain('₹14,200.00');
    expect(table).toContain('Company Incorporation Professional Fee');
    expect(table).toContain('DIR-KYC renewal fine and fee');

    for (const tag of [
      '{#items}',
      '{/items}',
      '{description}',
      '{qty}',
      '{amount}',
      '{clientName}',
      '{clientAddress}',
      '{clientContact}',
      '{serviceName}',
      '{documentNumber}',
      '{invoiceDate}',
      '{totalLabel}',
      '{advanceLabel}',
      '{balanceLabel}',
      '{total}',
      '{advance}',
      '{balance}',
    ]) {
      expect(xml, tag).not.toContain(tag);
    }

    expect((table.match(/<w:tr\b/g) ?? []).length).toBe(7);
    expect((table.match(/<w:cantSplit\/>/g) ?? []).length).toBe(6);
    expect(table).toContain('<w:tblHeader');
  });

  it('renders the invoice title, number label, summary labels and footer', () => {
    const zip = renderToZip('invoice', baseData('invoice', sixItems));
    const xml = documentXml(zip);

    expect(xml).toContain('INVOICE');
    expect(xml).toContain('Invoice No:');
    expect(xml).toContain('SNT-INV-2026-101');
    expect(xml).toContain('Total Amount');
    expect(xml).toContain('Amount Received');
    expect(xml).toContain('Balance Due');
    expect(xml).not.toContain('PROFORMA INVOICE');
    expect(xml).not.toContain('Proforma No:');
    expect(zip.file('word/footer1.xml')!.asText()).toBe(sourceFooters.invoice);
    expect(zip.file('word/footer1.xml')!.asText()).toContain(
      'Please quote the invoice number when making payment.',
    );
  });

  it('renders the receipt layout, fixed payment row and payment details', () => {
    const data: InvoiceDocxData = {
      ...baseData('receipt', []),
      total: '₹20,000.00',
      advance: '₹5,000.00',
      balance: '₹15,000.00',
    };
    const zip = renderToZip('receipt', data);
    const xml = documentXml(zip);
    const table = itemTable(xml);

    expect(xml).toContain('RECEIPT');
    expect(xml).toContain('Receipt No:');
    expect(xml).toContain('SNT-RCT-2026-101');
    expect(xml).toContain('RECEIVED FROM');
    expect(xml).toContain('PAYMENT FOR');
    expect(xml).toContain('Private Limited Company Registration');
    expect(table).toContain('Payment received against Invoice No. SNT-INV-2026-101');
    expect(table).toContain('>1<');
    expect(table).toContain('5,000.00');
    expect((table.match(/<w:tr\b/g) ?? []).length).toBe(2);
    expect(table).toContain('<w:cantSplit/>');

    const summaryOrder = ['Amount Received', 'Invoice Total', 'Balance Due'].map((label) =>
      xml.indexOf(label),
    );
    expect(summaryOrder.every((position) => position >= 0)).toBe(true);
    expect([...summaryOrder].sort((a, b) => a - b)).toEqual(summaryOrder);
    expect(xml).toContain('₹5,000.00');
    expect(xml).toContain('₹20,000.00');
    expect(xml).toContain('₹15,000.00');
    expect(xml).toContain('PAYMENT MODE');
    expect(xml).toContain('Bank Transfer');
    expect(xml).toContain('REFERENCE NO:');
    expect(xml).toContain('UTR12345');
    expect(xml).toContain('INVOICE NO:');
    expect(xml).toContain('SNT-INV-2026-101');
    expect(xml).toContain('PAYMENT DATE');
    expect(xml).toContain('26/10/2026');
    expect(xml).toContain('RECEIVED BY:');
    expect(xml).toContain('Shifra Nuha Technologies');
    expect(xml).not.toContain('ACCOUNT HOLDER:');

    for (const tag of [
      '{clientName}',
      '{clientAddress}',
      '{clientContact}',
      '{serviceName}',
      '{documentNumber}',
      '{invoiceDate}',
      '{totalLabel}',
      '{advanceLabel}',
      '{balanceLabel}',
      '{total}',
      '{advance}',
      '{balance}',
      '{invoiceNumber}',
      '{receiptAmount}',
      '{paymentDate}',
      '{paymentMode}',
      '{paymentReference}',
    ]) {
      expect(xml, tag).not.toContain(tag);
    }

    expect(zip.file('word/footer1.xml')!.asText()).toBe(sourceFooters.receipt);
    expect(zip.file('word/footer1.xml')!.asText()).toContain(
      'This receipt acknowledges payment received. Please retain it for your records.',
    );
  });

  it('keeps the items in order', () => {
    const table = itemTable(
      documentXml(renderToZip('proforma', baseData('proforma', sixItems))),
    );
    const positions = sixItems.map((item) => table.indexOf(item.description));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('removes the item row completely for a zero-item invoice', () => {
    const table = itemTable(
      documentXml(renderToZip('proforma', baseData('proforma', []))),
    );
    expect(table).not.toBe('');
    expect((table.match(/<w:tr\b/g) ?? []).length).toBe(1);
    expect(table).not.toContain('Company Incorporation Professional Fee');
  });

  it('preserves the original footer, logo and page geometry for all types', () => {
    for (const documentType of ['proforma', 'invoice', 'receipt'] as const) {
      const zip = renderToZip(documentType, baseData(documentType, sixItems));
      expect(zip.file('word/footer1.xml')!.asText()).toBe(sourceFooters[documentType]);
      expect(zip.file('word/media/image1.png')).toBeTruthy();
      const xml = documentXml(zip);
      expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"');
      expect(xml).toContain(
        '<w:pgMar w:top="1000" w:right="1134" w:bottom="1100" w:left="1134"',
      );
      expect(xml).toContain('<w:footerReference w:type="default"');
    }
  });

  it('escapes user text instead of injecting XML', () => {
    const xml = documentXml(
      renderToZip(
        'proforma',
        baseData('proforma', [
          { description: 'Consulting <A&B> "Q1"', qty: '1', amount: '1,000.00' },
        ]),
      ),
    );
    expect(xml).toContain('Consulting &lt;A&amp;B&gt; &quot;Q1&quot;');
    expect(xml).not.toContain('<A&B>');
  });
});
