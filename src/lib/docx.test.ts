import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import { renderInvoiceDocx } from './docx';
import type { InvoiceDocxData } from './invoice';

function readArrayBuffer(path: string): ArrayBuffer {
  const buffer = readFileSync(path);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function templatePath(name = 'public/templates/shifra-invoice-template.docx'): string {
  return fileURLToPath(new URL(`../../${name}`, import.meta.url));
}

const template = readArrayBuffer(templatePath());
const sourceFooter = new PizZip(readArrayBuffer(templatePath('templates/source/Shifra_Nuha_Proforma_Invoice_Template.docx')))
  .file('word/footer1.xml')!
  .asText();

function baseData(items: InvoiceDocxData['items']): InvoiceDocxData {
  return {
    clientName: 'Acme Trading',
    clientAddress: '12 Market Road\nKochi, Kerala 682001',
    clientContact: '+91 98765 43210  |  client@example.com',
    serviceName: 'Private Limited Company Registration',
    proformaNumber: 'SNT-PI-2026-101',
    invoiceDate: '25/10/2026',
    totalLabel: 'Estimated Total',
    advanceLabel: 'Amount Payable in Advance',
    balanceLabel: 'Balance',
    total: '₹19,200.00',
    advance: '₹5,000.00',
    balance: '₹14,200.00',
    items,
  };
}

function renderToZip(data: InvoiceDocxData) {
  return new PizZip(renderInvoiceDocx(template, data));
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
  it('renders the client, invoice, summary and six items without unresolved tags', () => {
    const zip = renderToZip(baseData(sixItems));
    const xml = documentXml(zip);
    const table = itemTable(xml);

    expect(xml).toContain('Acme Trading');
    expect(xml).toContain('12 Market Road');
    expect(xml).toContain('Private Limited Company Registration');
    expect(xml).toContain('SNT-PI-2026-101');
    expect(xml).toContain('25/10/2026');
    expect(xml).toContain('₹19,200.00');
    expect(xml).toContain('₹5,000.00');
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
      '{proformaNumber}',
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

  it('keeps the items in order', () => {
    const table = itemTable(documentXml(renderToZip(baseData(sixItems))));
    const positions = sixItems.map((item) => table.indexOf(item.description));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('removes the item row completely for a zero-item invoice', () => {
    const table = itemTable(documentXml(renderToZip(baseData([]))));
    expect(table).not.toBe('');
    expect((table.match(/<w:tr\b/g) ?? []).length).toBe(1);
    expect(table).not.toContain('Company Incorporation Professional Fee');
  });

  it('preserves the original footer, logo and document page geometry', () => {
    const zip = renderToZip(baseData(sixItems));
    expect(zip.file('word/footer1.xml')!.asText()).toBe(sourceFooter);
    expect(zip.file('word/media/image1.png')).toBeTruthy();
    const xml = documentXml(zip);
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"');
    expect(xml).toContain('<w:pgMar w:top="1000" w:right="1134" w:bottom="1100" w:left="1134"');
    expect(xml).toContain('<w:footerReference w:type="default"');
  });

  it('escapes user text instead of injecting XML', () => {
    const xml = documentXml(
      renderToZip(
        baseData([{ description: 'Consulting <A&B> "Q1"', qty: '1', amount: '1,000.00' }]),
      ),
    );
    expect(xml).toContain('Consulting &lt;A&amp;B&gt; &quot;Q1&quot;');
    expect(xml).not.toContain('<A&B>');
  });
});
