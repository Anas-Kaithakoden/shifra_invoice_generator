import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import PizZip from 'pizzip';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const chromePath =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 4175;
const baseURL = `http://127.0.0.1:${port}/`;
const outputDir = mkdtempSync(join(tmpdir(), 'shifra-invoice-e2e-'));

assert.ok(existsSync(chromePath), `Chrome not found at ${chromePath}`);

const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverOutput = '';
server.stdout.on('data', (data) => {
  serverOutput += data.toString();
});
server.stderr.on('data', (data) => {
  serverOutput += data.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Preview server exited early:\n${serverOutput}`);
    }
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Preview server did not start:\n${serverOutput}`);
}

async function readPdf(path) {
  const doc = await getDocument({
    data: new Uint8Array(readFileSync(path)),
    useSystemFonts: true,
  }).promise;
  const pages = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => typeof item.str === 'string')
      .map((item) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
      }));
    pages.push({
      number,
      width: viewport.width,
      height: viewport.height,
      text: items.map((item) => item.text).join(' '),
      items,
    });
  }
  return pages;
}

function footerBaseline(page, text = 'This is a proforma invoice') {
  const lines = page.items.filter((item) => item.text.trim().length > 0);
  const footer = lines.find((item) => item.text.includes(text));
  assert.ok(footer, `Footer was not found on PDF page ${page.number}`);
  return footer.y;
}

async function waitForPreviewText(page, expected) {
  await page.waitForFunction(
    (text) => document.querySelector('.preview-scale-source .invoice-page')?.textContent?.includes(text),
    expected,
  );
}

async function previewText(page) {
  return (
    (await page.locator('.preview-scale-source .invoice-page').textContent()) ?? ''
  );
}

let browser;
let page;
const consoleErrors = [];
const pageErrors = [];
const thirdPartyRequests = new Set();

try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    acceptDownloads: true,
  });

  await page.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => {
      window.__printCalls += 1;
    };
  });

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = request.url();
    if (/^https?:/i.test(url) && !url.startsWith(baseURL)) {
      thirdPartyRequests.add(url);
    }
  });

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.preview-scale-source .inv-items tbody tr');

  assert.match(await page.title(), /Invoice Generator/);
  assert.equal(await page.locator('h1').textContent(), 'Invoice Generator');
  assert.equal(
    await page.locator('.preview-scale-source .inv-items tbody tr').count(),
    6,
    'initial sample rows',
  );
  assert.equal(
    await page.getByTestId('summary-total').textContent(),
    '₹19,200.00',
  );
  assert.equal(await page.getByRole('radio', { name: /^Proforma invoice/ }).isChecked(), true);
  assert.equal(await page.getByRole('radio', { name: /^Invoice/ }).isChecked(), false);
  assert.equal(await page.getByLabel('Client / Business Name').inputValue(), '');
  assert.equal(await page.getByLabel('Proforma Invoice Number').inputValue(), '');
  assert.match(await page.getByLabel('Invoice Date').inputValue(), /^\d{4}-\d{2}-\d{2}$/);
  assert.ok((await previewText(page)).includes('₹19,200.00'));

  // Required-field validation blocks Word generation.
  await page.getByRole('button', { name: 'Download Word' }).click();
  await page
    .getByText('Please fix the highlighted fields before generating the document.')
    .waitFor();
  assert.equal(
    await page.getByLabel('Client / Business Name').getAttribute('aria-invalid'),
    'true',
  );
  assert.equal(
    await page.getByLabel('Service Name / Invoice Title').getAttribute('aria-invalid'),
    'true',
  );
  assert.equal(
    await page.getByLabel('Proforma Invoice Number').getAttribute('aria-invalid'),
    'true',
  );

  // Fill the invoice and exercise optional contact validation.
  await page.getByLabel('Client / Business Name').fill('Acme Trading');
  await page
    .getByLabel('Client Address')
    .fill('12 Market Road\nKochi, Kerala 682001');
  await page.getByLabel('Service Name / Invoice Title').fill(
    'Private Limited Company Registration',
  );
  await page.getByLabel('Proforma Invoice Number').fill('SNT-PI-2026-101');
  await page.getByLabel('Client Phone').fill('not a phone');
  await page.getByLabel('Client Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Download Word' }).click();
  await page.getByText('Enter a valid phone number.').waitFor();
  await page.getByText('Enter a valid email address.').waitFor();
  await page.getByLabel('Client Phone').fill('+91 98765 43210');
  await page.getByLabel('Client Email').fill('client@example.com');
  await page.getByLabel('Invoice Date').fill('2026-11-05');
  await waitForPreviewText(page, '05/11/2026');
  assert.ok((await previewText(page)).includes('Acme Trading'));
  assert.ok((await previewText(page)).includes('Kochi, Kerala 682001'));
  assert.ok((await previewText(page)).includes('Private Limited Company Registration'));
  assert.ok((await previewText(page)).includes('SNT-PI-2026-101'));

  // Add a row, confirm focus moves to it, then reorder it.
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'Description for item 7',
  );
  await page.getByLabel('Description for item 7').fill('Consulting retainer');
  await page.getByLabel('Amount for item 7').fill('1000.50');
  await page.getByTestId('summary-total').waitFor();
  assert.equal(await page.getByTestId('summary-total').textContent(), '₹20,200.50');
  await waitForPreviewText(page, '1,000.50');
  await page.getByRole('button', { name: 'Move item 7 up' }).click();
  assert.equal(
    await page.locator('.preview-scale-source .inv-items tbody tr').nth(5).textContent().then((t) =>
      t?.includes('Consulting retainer'),
    ),
    true,
  );

  // Rows can be excluded from the invoice while remaining in the editor.
  await page.getByLabel(/Include Company Incorporation Professional Fee on invoice/).uncheck();
  await waitForPreviewText(page, '₹16,700.50');
  assert.equal(await page.getByTestId('summary-total').textContent(), '₹16,700.50');
  assert.equal(await page.locator('.preview-scale-source .inv-items tbody tr').count(), 6);
  assert.ok(!(await previewText(page)).includes('Company Incorporation Professional Fee'));

  // Invalid amounts block totals and generation.
  await page.getByLabel('Amount for item 2').fill('bad amount');
  await page.waitForFunction(
    () =>
      document.querySelector('.preview-scale-source .inv-summary td')?.textContent === '—',
  );
  assert.equal(
    await page.locator('.preview-scale-source .inv-summary td').first().textContent(),
    '—',
  );
  await page.getByLabel('Amount for item 2').fill('1000');
  await waitForPreviewText(page, '₹16,700.50');

  // A zero-value row is included in the document but does not change the total.
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Description for item 8').fill('Zero value service');
  await page.getByLabel('Amount for item 8').fill('0');
  assert.equal(await page.getByTestId('summary-total').textContent(), '₹16,700.50');
  assert.equal(await page.locator('.preview-scale-source .inv-items tbody tr').count(), 7);
  assert.ok((await previewText(page)).includes('Zero value service'));
  await page.getByRole('button', { name: 'Delete item 8' }).click();
  assert.equal(await page.locator('.preview-scale-source .inv-items tbody tr').count(), 6);

  // Advance, negative balance warning and total override reset.
  await page.getByLabel('Amount Payable in Advance').fill('5000');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="summary-balance"]')?.textContent === '₹11,700.50',
  );
  assert.equal(await page.getByTestId('summary-balance').textContent(), '₹11,700.50');
  await page.getByLabel('Amount Payable in Advance').fill('30000');
  await page.getByText(/advance is higher than the estimated total/).waitFor();
  assert.equal(await page.getByTestId('summary-balance').textContent(), '-₹13,299.50');
  await page.getByLabel('Amount Payable in Advance').fill('5000');

  await page.getByRole('checkbox', { name: /Override the estimated total manually/ }).check();
  await page.getByLabel('Manual estimated total').fill('20000');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="summary-total"]')?.textContent === '₹20,000.00',
  );
  assert.equal(await page.getByTestId('summary-balance').textContent(), '₹15,000.00');
  await page.getByRole('button', { name: 'Use line-item total' }).click();
  assert.equal(await page.getByTestId('summary-total').textContent(), '₹16,700.50');

  // Editable summary labels are reflected in the preview.
  await page.getByText('Customize payment summary labels').click();
  await page.getByLabel('Total label').fill('Grand Total');
  await page.getByLabel('Advance label').fill('Advance Paid');
  await page.getByLabel('Balance label').fill('Amount Due');
  assert.deepEqual(
    await page.locator('.preview-scale-source .inv-summary th').allTextContents(),
    ['Grand Total', 'Advance Paid', 'Amount Due'],
  );

  // Reset is confirmed, cancellable and restores the initial state.
  await page.getByRole('button', { name: 'Reset form' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await page.getByLabel('Client / Business Name').inputValue(), 'Acme Trading');
  await page.getByRole('button', { name: 'Reset form' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset form' }).click();
  await page.getByText('Form reset. Sample line items restored.').waitFor();
  assert.equal(await page.getByLabel('Client / Business Name').inputValue(), '');
  assert.equal(await page.getByLabel('Proforma Invoice Number').inputValue(), '');
  assert.equal(await page.getByTestId('summary-total').textContent(), '₹19,200.00');
  assert.equal(await page.locator('.preview-scale-source .inv-items tbody tr').count(), 6);

  // Complete the reset form and download a real Word document.
  await page.getByLabel('Client / Business Name').fill('Acme Trading');
  await page
    .getByLabel('Client Address')
    .fill('12 Market Road\nKochi, Kerala 682001');
  await page.getByLabel('Client Phone').fill('+91 98765 43210');
  await page.getByLabel('Client Email').fill('client@example.com');
  await page.getByLabel('Service Name / Invoice Title').fill(
    'Private Limited Company Registration',
  );
  await page.getByLabel('Proforma Invoice Number').fill('SNT-PI-2026-101');
  await waitForPreviewText(page, 'Acme Trading');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Word' }).click();
  const download = await downloadPromise;
  await page.getByText(/Word document downloaded as Proforma_Invoice_SNT-PI-2026-101\.docx/).waitFor();
  assert.equal(download.suggestedFilename(), 'Proforma_Invoice_SNT-PI-2026-101.docx');
  const docxPath = join(outputDir, download.suggestedFilename());
  await download.saveAs(docxPath);

  const docxZip = new PizZip(readFileSync(docxPath));
  const documentXml = docxZip.file('word/document.xml').asText();
  const footerXml = docxZip.file('word/footer1.xml').asText();
  assert.ok(documentXml.includes('Acme Trading'));
  assert.ok(documentXml.includes('Private Limited Company Registration'));
  assert.ok(documentXml.includes('SNT-PI-2026-101'));
  assert.ok(documentXml.includes('₹19,200.00'));
  assert.ok(!documentXml.includes('{#items}'));
  assert.ok(!documentXml.includes('{description}'));
  assert.ok(documentXml.includes('<w:pgSz w:w="11906" w:h="16838"'));
  assert.ok(documentXml.includes('<w:cantSplit/>'));
  assert.ok(footerXml.includes('This is a proforma invoice'));
  assert.ok(footerXml.includes('Thank you for choosing Shifra Nuha Technologies'));

  // Print / Save as PDF calls the browser dialog and produces a one-page A4 PDF.
  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  await page.getByText(/Print dialog opened/).waitFor();
  assert.equal(await page.evaluate(() => window.__printCalls), 1);
  assert.match(await page.title(), /Proforma_Invoice_SNT-PI-2026-101/);
  await page.waitForTimeout(1200);
  assert.equal(await page.title(), 'Invoice Generator | Shifra Nuha Technologies');

  const onePagePdfPath = join(outputDir, 'invoice-six-items.pdf');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: onePagePdfPath, preferCSSPageSize: true, printBackground: true });
  let pdfPages = await readPdf(onePagePdfPath);
  assert.equal(pdfPages.length, 1, 'six-item invoice should print on one page');
  const firstPage = pdfPages[0];
  assert.ok(Math.abs(firstPage.width - 595.32) < 1);
  assert.ok(Math.abs(firstPage.height - 841.92) < 1);
  assert.ok(firstPage.text.includes('Acme Trading'));
  assert.ok(firstPage.text.includes('This is a proforma invoice'));
  assert.ok(firstPage.text.includes('Thank you for choosing Shifra Nuha Technologies'));
  assert.ok(firstPage.text.includes('41868247390'));
  assert.ok(!firstPage.text.includes('Download Word'));
  const onePageFooterY = footerBaseline(firstPage);
  assert.ok(onePageFooterY > 20 && onePageFooterY < 60, `footer y=${onePageFooterY}`);

  // Switching to a standard invoice loads the matching template, labels and footer.
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('radio', { name: /^Invoice/ }).check();
  await waitForPreviewText(page, 'Invoice No:');
  const invoicePreview = await previewText(page);
  assert.ok(invoicePreview.includes('INVOICE'));
  assert.ok(invoicePreview.includes('Invoice No:'));
  assert.ok(invoicePreview.includes('Please quote the invoice number when making payment.'));
  assert.ok(!invoicePreview.includes('PROFORMA INVOICE'));
  assert.ok(!invoicePreview.includes('Proforma No:'));
  assert.ok(!invoicePreview.includes('This is a proforma invoice'));
  assert.deepEqual(
    await page.locator('.preview-scale-source .inv-summary th').allTextContents(),
    ['Total Amount', 'Amount Received', 'Balance Due'],
  );
  assert.equal(await page.getByLabel('Invoice Number').inputValue(), 'SNT-PI-2026-101');
  await page.getByLabel('Invoice Number').fill('SNT-INV-2026-101');
  await page.getByLabel('Amount Received').fill('5000');
  await waitForPreviewText(page, 'SNT-INV-2026-101');
  assert.equal(await page.getByTestId('summary-balance').textContent(), '₹14,200.00');

  const invoiceDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Word' }).click();
  const invoiceDownload = await invoiceDownloadPromise;
  await page
    .getByText(/Word document downloaded as Invoice_SNT-INV-2026-101\.docx/)
    .waitFor();
  assert.equal(invoiceDownload.suggestedFilename(), 'Invoice_SNT-INV-2026-101.docx');
  const invoiceDocxPath = join(outputDir, invoiceDownload.suggestedFilename());
  await invoiceDownload.saveAs(invoiceDocxPath);
  const invoiceZip = new PizZip(readFileSync(invoiceDocxPath));
  const invoiceDocumentXml = invoiceZip.file('word/document.xml').asText();
  const invoiceFooterXml = invoiceZip.file('word/footer1.xml').asText();
  assert.ok(invoiceDocumentXml.includes('INVOICE'));
  assert.ok(invoiceDocumentXml.includes('Invoice No:'));
  assert.ok(invoiceDocumentXml.includes('SNT-INV-2026-101'));
  assert.ok(invoiceDocumentXml.includes('Total Amount'));
  assert.ok(invoiceDocumentXml.includes('Amount Received'));
  assert.ok(invoiceDocumentXml.includes('Balance Due'));
  assert.ok(!invoiceDocumentXml.includes('PROFORMA INVOICE'));
  assert.ok(invoiceFooterXml.includes('Please quote the invoice number when making payment.'));
  assert.ok(!invoiceFooterXml.includes('This is a proforma invoice'));

  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  await page.getByText(/Print dialog opened/).waitFor();
  assert.match(await page.title(), /Invoice_SNT-INV-2026-101/);
  const invoicePdfPath = join(outputDir, 'invoice-standard.pdf');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: invoicePdfPath, preferCSSPageSize: true, printBackground: true });
  const invoicePdfPages = await readPdf(invoicePdfPath);
  assert.equal(invoicePdfPages.length, 1, 'six-item invoice should print on one page');
  const invoicePage = invoicePdfPages[0];
  assert.ok(invoicePage.text.includes('Please quote the invoice number when making payment.'));
  assert.ok(invoicePage.text.includes('Total Amount'));
  assert.ok(invoicePage.text.includes('Amount Received'));
  assert.ok(invoicePage.text.includes('Balance Due'));
  assert.ok(!invoicePage.text.includes('This is a proforma invoice'));
  const invoiceFooterY = footerBaseline(invoicePage, 'Please quote the invoice number');
  assert.ok(invoiceFooterY > 20 && invoiceFooterY < 60, `invoice footer y=${invoiceFooterY}`);

  // Switch back before the multi-page proforma check.
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('radio', { name: /^Proforma invoice/ }).check();
  await waitForPreviewText(page, 'PROFORMA INVOICE');
  assert.deepEqual(
    await page.locator('.preview-scale-source .inv-summary th').allTextContents(),
    ['Estimated Total', 'Amount Payable in Advance', 'Balance'],
  );
  await page.getByLabel('Amount Payable in Advance').fill('5000');

  // Many rows must paginate, repeat the table header and keep the footer on every page.
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Edit invoice' }).click().catch(() => {});
  for (let index = 7; index <= 24; index += 1) {
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await page.getByLabel(`Description for item ${index}`).fill(`Additional service ${index}`);
    await page.getByLabel(`Amount for item ${index}`).fill('250');
  }
  assert.equal(await page.getByTestId('summary-total').textContent(), '₹23,700.00');
  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  await page.getByText(/Print dialog opened/).waitFor();

  const multiPagePdfPath = join(outputDir, 'invoice-many-items.pdf');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: multiPagePdfPath, preferCSSPageSize: true, printBackground: true });
  pdfPages = await readPdf(multiPagePdfPath);
  assert.ok(pdfPages.length >= 2, `expected multiple pages, got ${pdfPages.length}`);
  for (const pdfPage of pdfPages) {
    assert.ok(
      pdfPage.text.includes('This is a proforma invoice'),
      `footer missing on page ${pdfPage.number}`,
    );
    assert.ok(
      pdfPage.text.includes('Thank you for choosing Shifra Nuha Technologies'),
      `second footer line missing on page ${pdfPage.number}`,
    );
    const y = footerBaseline(pdfPage);
    assert.ok(y > 20 && y < 60, `footer y=${y} on page ${pdfPage.number}`);
    const pageHasItems = /Additional service|Company Incorporation/.test(pdfPage.text);
    if (pageHasItems) {
      assert.ok(
        pdfPage.text.includes('D E S C R I P T I O N'),
        `table header missing on page ${pdfPage.number}`,
      );
    }
  }
  const allPrintedText = pdfPages.map((pdfPage) => pdfPage.text).join(' ');
  for (let index = 7; index <= 24; index += 1) {
    assert.ok(allPrintedText.includes(`Additional service ${index}`));
  }
  assert.ok(pdfPages.at(-1).text.includes('ACCOUNT HOLDER:'));
  assert.ok(pdfPages.at(-1).text.includes('Balance'));

  // Mobile: tabs switch panels and the initially hidden preview measures correctly.
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('aside').isVisible(), false);
  assert.equal(await page.getByLabel('Client / Business Name').isVisible(), true);
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.waitForSelector('.preview-scale-source .inv-items tbody tr');
  assert.equal(await page.locator('aside').isVisible(), true);
  const mobilePreview = await page.evaluate(() => {
    const source = document.querySelector('.preview-scale-source');
    const sizer = document.querySelector('.preview-sizer');
    const container = document.querySelector('.preview-scroll');
    if (!source || !sizer || !container) return null;
    const scale = new DOMMatrixReadOnly(getComputedStyle(source).transform).a;
    return {
      scale,
      sizerWidth: sizer.getBoundingClientRect().width,
      containerWidth: container.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
  assert.ok(mobilePreview, 'mobile preview did not mount');
  assert.ok(mobilePreview.scale > 0.4, `mobile preview scale was ${mobilePreview.scale}`);
  assert.ok(mobilePreview.sizerWidth <= mobilePreview.containerWidth);
  assert.ok(mobilePreview.scrollWidth <= mobilePreview.clientWidth + 1);
  assert.equal(await page.locator('.preview-scale-source .inv-items tbody tr').count(), 6);
  await page.getByRole('button', { name: 'Edit invoice' }).click();
  assert.equal(await page.getByLabel('Client / Business Name').isVisible(), true);
  assert.equal(await page.locator('aside').isVisible(), false);

  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join('\n')}`);
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('\n')}`);
  assert.deepEqual(
    [...thirdPartyRequests],
    [],
    `unexpected third-party requests: ${[...thirdPartyRequests].join(', ')}`,
  );

  console.log(
    JSON.stringify(
      {
        status: 'passed',
        wordFile: docxPath,
        onePagePdf: onePagePdfPath,
        multiPagePdf: multiPagePdfPath,
        multiPageCount: pdfPages.length,
        invoiceWordFile: invoiceDocxPath,
        invoicePdf: invoicePdfPath,
        outputDir,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (page) {
    await page
      .screenshot({ path: join(outputDir, 'failure.png'), fullPage: true })
      .catch(() => {});
  }
  console.error('E2E failure artifacts:', { outputDir, serverOutput, consoleErrors, pageErrors });
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
