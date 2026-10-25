import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { InvoiceDocxData } from './invoice';

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let templatePromise: Promise<ArrayBuffer> | null = null;

export function loadInvoiceTemplate(): Promise<ArrayBuffer> {
  if (!templatePromise) {
    templatePromise = fetch(
      `${import.meta.env.BASE_URL}templates/shifra-invoice-template.docx`,
      { cache: 'force-cache' },
    ).then((response) => {
      if (!response.ok) {
        throw new Error('The Word template could not be loaded.');
      }
      return response.arrayBuffer();
    });
    templatePromise.catch(() => {
      templatePromise = null;
    });
  }
  return templatePromise;
}

export function renderInvoiceDocx(
  template: ArrayBuffer,
  data: InvoiceDocxData,
): Uint8Array {
  const zip = new PizZip(template);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render(data);
  return doc.getZip().generate({
    type: 'uint8array',
    compression: 'DEFLATE',
    mimeType: DOCX_MIME,
  });
}

export function docxBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes);
  return new Blob([copy.buffer], { type: DOCX_MIME });
}

export function describeDocxError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The Word document could not be generated.';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
