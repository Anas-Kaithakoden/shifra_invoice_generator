# Shifra Nuha Invoice Generator

A fully client-side **proforma invoice and invoice** editor for **Shifra Nuha Technologies**. It is built around the two supplied Word templates, so the A4 preview and downloaded `.docx` keep the original page size, margins, fonts, colours, header, logo, item table, payment summary, bank details, and footer for the selected document type.

There is no backend, database, login, analytics, or persistent browser storage. Invoice data stays in the open browser tab and is discarded when the page is closed or refreshed.

## Features

- Choose **Proforma invoice** or **Invoice** before generating; the preview, print output, Word download and summary defaults switch to the matching template.
- Live A4 preview with the original template styling.
- Editable client name, address, phone, email, service/title, document number, and invoice date.
- Dynamic line items: add, edit, delete, reorder, or leave blank.
- An **Include** checkbox keeps a row in the editor while omitting it from the invoice and totals.
- Integer-paise calculations with Indian digit grouping and rupee formatting.
- Total from included row amounts, with an optional manual override.
- Manual advance (proforma) or amount received (invoice) and calculated balance, including a warning when the payment exceeds the total.
- No automatic GST or other taxes; totals are exactly what is entered.
- Editable labels for the payment summary.
- Download a real Word document generated from the selected original `.docx` template.
- Print / Save as PDF through the browser's native print dialog.
- Responsive two-column desktop layout and mobile Editor / Preview tabs.
- Reset and row-clearing actions with confirmation dialogs.

## Requirements

- Node.js 22.12 or newer (Node 24 was used during development).
- npm 10 or newer.
- Google Chrome or Microsoft Edge for the end-to-end tests and browser printing.
- Python 3.9+ only if you want to regenerate the tagged Word templates.

## Setup

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

### Production build

```bash
npm run build
npm run preview
```

The production build is written to `dist/`. It is a static site and needs no server-side runtime.

### Tests

```bash
npm test
```

Runs the Vitest unit tests for money handling, date handling, invoice calculations, validation, and Word rendering.

```bash
npm run test:e2e
```

Builds the production site, starts a temporary preview server, and runs a full Chrome test covering both document types, validation, line-item operations, totals, overrides, reset confirmation, Word download, print PDF pagination, and the mobile layout. Set `CHROME_PATH` if Chrome is not at the default Windows path:

```powershell
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run test:e2e
```

## How totals work

- Each included, non-blank row contributes its **Amount** directly. Quantity is printed for reference only and does **not** multiply the amount.
- A blank row with no description, amount, or quantity is ignored.
- Clearing the **Include** checkbox removes that row from the Word document, the preview table, and the total.
- Enter the advance (proforma) or amount received (invoice) manually. The balance is `total - payment`.
- Enabling the manual total override replaces the calculated total for the summary and document. **Use line-item total** turns the override off.
- A zero-value row is still printed if it has a description and is included.
- There are no automatic taxes. Add any tax as its own line item if required.
- Money is parsed and stored as integer paise, so totals do not accumulate floating-point errors.
- Switching document type changes the default summary labels to the matching template. Labels you have customised are kept.

The six default sample rows and amounts come from the original templates. They can be edited, deleted, or replaced.

## Generating the invoice

1. Choose **Proforma invoice** or **Invoice** in the Document type panel.
2. Fill in the required client, service, document number, and date fields.
3. Edit the sample line items or clear them and add your own.
4. Set the payment received and, if needed, override the total.
5. Use **Download Word** to save the `.docx`, or **Print / Save as PDF** to use the browser's print dialog.
6. In the print dialog, choose **Save as PDF**, A4 paper, and (for the closest colour match) enable **Background graphics**.

The Word file is generated in the browser from the selected template:

- Proforma invoice: `public/templates/shifra-proforma-template.docx`
- Invoice: `public/templates/shifra-invoice-template.docx`

Unused item rows are removed by the template loop, and the original header, bank details, and document-specific footer are preserved.

The browser print dialog is intentionally used instead of client-side PDF generation. The app does not claim to create a PDF directly; the browser does. Print output hides all editor controls and repeats the footer on each page.

## Privacy

- No invoice data is uploaded. All parsing, calculations, template rendering, and file generation happen in the browser.
- No accounts, cookies, analytics, tracking pixels, or local/session storage are used.
- No invoice contents are written to the browser console.
- Refreshing or closing the tab loses the current invoice.
- The only network requests are for the app's own static assets and the selected Word template from the same origin.

## Cloudflare Pages deployment

### Git integration

1. Push this directory to a Git repository.
2. In Cloudflare, create a **Pages** project and connect the repository.
3. Use these build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: the repository root
   - `NODE_VERSION`: `22.12.0` or newer
4. Deploy. No environment variables or bindings are required.

`public/_headers` is copied into `dist/_headers`, and `public/_redirects` into `dist/_redirects` by Vite.

### Direct upload with Wrangler

```bash
npm run build
npx wrangler pages deploy dist --project-name shifra-invoice-generator
```

The `_headers` file adds a restrictive Content Security Policy, disables framing, sets `nosniff`, and avoids caching `index.html` and the Word templates. Hashed assets under `/assets/` are cached immutably.

## Regenerating the Word templates

The original templates are kept untouched at:

- `Shifra_Nuha_Proforma_Invoice_Template.docx` and `Shifra_Nuha_Invoice_Template.docx` (project root)
- `templates/source/Shifra_Nuha_Proforma_Invoice_Template.docx` and `templates/source/Shifra_Nuha_Invoice_Template.docx` (script inputs)

The runtime templates are generated at:

- `public/templates/shifra-proforma-template.docx`
- `public/templates/shifra-invoice-template.docx`

Regenerate both with:

```bash
npm run template
```

The Python script, for both source templates:

- copies the source document;
- replaces the sample client, document number, item, summary, and date values with docxtemplater tags;
- removes the extra sample item rows, keeping the first row as the repeating row;
- preserves the original headers, document-specific footer, logo, table borders, cell widths, page geometry, and styles;
- keeps item rows from splitting across pages and binds the payment summary and bank details into one unsplittable block.

After regenerating, run `npm run build` and inspect both downloaded document types in Word before deploying.

## Project structure

```text
src/
  App.tsx                         form state and download/print orchestration
  components/
    InvoiceDocument.tsx           A4 preview and print document
    EditorPanel.tsx               document type, client, invoice, and action panels
    LineItemsEditor.tsx           dynamic line-item table
    PaymentSummaryEditor.tsx      totals, payment, labels
    ConfirmDialog.tsx             destructive-action confirmation
    ui.tsx                        shared form and icon components
  lib/
    invoice.ts                    model, calculations, validation, docx data
    money.ts                      integer-paise parsing and INR formatting
    date.ts                       ISO date handling and DD/MM/YYYY formatting
    docx.ts                       browser-side docxtemplater rendering
  index.css                       invoice styling, A4 preview, print rules
public/
  templates/shifra-proforma-template.docx
  templates/shifra-invoice-template.docx
  shifra-logo.png
  _headers
  _redirects
scripts/
  build-docx-template.py          reproducible template generator
  e2e.mjs                         Chrome end-to-end test
templates/source/                 untouched proforma and invoice source templates
```

## Formatting decisions

- A4 page size and the template's Word margins are used: top `17.64mm`, right/left `20mm`, bottom `19.36mm`.
- Arial base font, navy (`#151F35`), cyan (`#06BED3`), muted (`#60647A`), light (`#EEF3F7`), and border (`#D9DEE5`) follow the template.
- The invoice date is right-aligned.
- Each document type keeps its own original footer in Word; browser print reserves footer space on every page.
- The Word document uses the same summary values and document-specific labels that are visible in the app.

## Third-party licences

The production dependencies use permissive licences:

| Package | Licence |
| --- | --- |
| `docxtemplater` (core only, no paid modules) | MIT |
| `pizzip` | MIT (dual MIT / GPL-3.0; this project uses the MIT option) |
| `react`, `react-dom` | MIT |
| `zod` | MIT |

Development tooling includes Vite (MIT), TypeScript (Apache-2.0), Tailwind CSS (MIT), Vitest (MIT), Playwright Core (Apache-2.0), and PDF.js (Apache-2.0).

The Shifra Nuha name, logo, bank details, and supplied Word template remain the property of their respective owner. They are not relicensed by this project.
