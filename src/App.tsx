import { useMemo, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EditorPanel } from './components/EditorPanel';
import { InvoiceDocument, ScaledInvoice } from './components/InvoiceDocument';
import {
  AlertIcon,
  CheckIcon,
  EyeIcon,
  LockIcon,
  PencilIcon,
  PrintIcon,
  WordIcon,
  cx,
} from './components/ui';
import {
  DOCUMENT_TYPES,
  buildDocxData,
  calculateInvoice,
  createInitialForm,
  createLineItem,
  makeInvoiceFilename,
  makeSampleItems,
  validateInvoice,
  type DocumentType,
  type InvoiceForm,
  type LineItem,
} from './lib/invoice';


type Status = {
  type: 'success' | 'error' | 'info';
  message: string;
};

type PendingConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  action: () => void;
};

export default function App() {
  const [form, setForm] = useState<InvoiceForm>(createInitialForm);
  const [showValidation, setShowValidation] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const calculation = useMemo(() => calculateInvoice(form), [form]);
  const validation = useMemo(() => validateInvoice(form), [form]);
  const documentConfig = DOCUMENT_TYPES[form.documentType];

  function updateField<K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setStatus(null);
  }

  function changeDocumentType(documentType: DocumentType) {
    setForm((current) => {
      if (current.documentType === documentType) return current;
      const previousLabels = DOCUMENT_TYPES[current.documentType].labels;
      const nextLabels = DOCUMENT_TYPES[documentType].labels;
      const label = (value: string, previousDefault: string, nextDefault: string) =>
        value.trim() && value.trim() !== previousDefault ? value : nextDefault;
      return {
        ...current,
        documentType,
        totalLabel: label(current.totalLabel, previousLabels.total, nextLabels.total),
        advanceLabel: label(current.advanceLabel, previousLabels.advance, nextLabels.advance),
        balanceLabel: label(current.balanceLabel, previousLabels.balance, nextLabels.balance),
      };
    });
    setStatus(null);
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function addItem() {
    const item = createLineItem();
    setForm((current) => ({ ...current, items: [...current.items, item] }));
    setLastAddedId(item.id);
    setStatus(null);
  }

  function deleteItem(id: string) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
  }

  function moveItem(id: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.items.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.items.length) return current;
      const items = [...current.items];
      [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
      return { ...current, items };
    });
  }

  function loadSampleItems() {
    setForm((current) => ({ ...current, items: makeSampleItems() }));
    setLastAddedId(null);
    setStatus({ type: 'info', message: 'Sample line items loaded from the original template.' });
  }

  function clearItems() {
    setForm((current) => ({ ...current, items: [] }));
    setLastAddedId(null);
    setStatus({ type: 'info', message: 'All line items cleared. The invoice now has a blank table.' });
  }

  function requestLoadSample() {
    if (form.items.length === 0) {
      loadSampleItems();
      return;
    }
    setPendingConfirm({
      title: 'Replace current line items?',
      message:
        'Loading the sample rows will replace every current line item, including any descriptions and amounts you have entered.',
      confirmLabel: 'Load sample rows',
      action: loadSampleItems,
    });
  }

  function requestClearItems() {
    if (form.items.length === 0) return;
    setPendingConfirm({
      title: 'Clear all line items?',
      message: 'Every line item will be removed. The client and invoice details will stay intact.',
      confirmLabel: 'Clear line items',
      destructive: true,
      action: clearItems,
    });
  }

  function resetForm() {
    setForm((current) => createInitialForm(current.documentType));
    setShowValidation(false);
    setLastAddedId(null);
    setStatus({ type: 'info', message: 'Form reset. Sample line items restored.' });
  }

  function requestReset() {
    setPendingConfirm({
      title: 'Reset the invoice form?',
      message:
        'This clears all client, invoice and payment details and restores the sample line items. It cannot be undone.',
      confirmLabel: 'Reset form',
      destructive: true,
      action: resetForm,
    });
  }

  function reportValidationFailure() {
    setShowValidation(true);
    setMobileView('editor');
    setStatus({
      type: 'error',
      message: 'Please fix the highlighted fields before generating the document.',
    });
    window.setTimeout(() => {
      document.getElementById('validation-summary')?.scrollIntoView({ block: 'center' });
    }, 60);
  }

  async function handleDownload() {
    setShowValidation(true);
    const check = validateInvoice(form);
    if (!check.success) {
      reportValidationFailure();
      return;
    }

    setIsGenerating(true);
    setStatus(null);
    try {
      // Keep the Word generator out of the initial bundle. It is only loaded
      // when the user actually asks for a .docx file.
      const { docxBlob, downloadBlob, loadInvoiceTemplate, renderInvoiceDocx } = await import(
        './lib/docx'
      );
      const template = await loadInvoiceTemplate(form.documentType);
      const currentCalculation = calculateInvoice(form);
      const data = buildDocxData(form, currentCalculation);
      const bytes = renderInvoiceDocx(template, data);
      const filename = makeInvoiceFilename(form.documentType, form.documentNumber);
      downloadBlob(docxBlob(bytes), filename);
      setStatus({
        type: 'success',
        message: `Word document downloaded as ${filename}. It uses the matching original Shifra Nuha ${documentConfig.shortLabel.toLowerCase()} template.`,
      });
    } catch (error) {
      let detail = 'The template could not be loaded.';
      try {
        const { describeDocxError } = await import('./lib/docx');
        detail = describeDocxError(error);
      } catch {
        // Keep the generic message if the generator itself could not load.
      }
      setStatus({
        type: 'error',
        message: `Word generation failed. ${detail}`,
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function handlePrint() {
    setShowValidation(true);
    const check = validateInvoice(form);
    if (!check.success) {
      reportValidationFailure();
      return;
    }

    setStatus({
      type: 'info',
      message:
        'Print dialog opened. Choose “Save as PDF” in the dialog to create a PDF; the app does not create a PDF directly.',
    });
    const previousTitle = document.title;
    document.title = makeInvoiceFilename(form.documentType, form.documentNumber).replace(
      /\.docx$/,
      '',
    );
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 1000);
  }

  const errorCount =
    Object.keys(validation.errors).length + Object.keys(validation.itemErrors).length;

  return (
    <>
      <div className="app-shell min-h-screen bg-canvas text-ink">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:py-4">
            <div className="flex items-center gap-3">
              <img
                src={`${import.meta.env.BASE_URL}shifra-logo.png`}
                alt=""
                className="h-11 w-11 object-contain"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-cyan">
                  Shifra Nuha Technologies
                </p>
                <h1 className="text-xl font-bold leading-tight text-ink sm:text-2xl">
                  Invoice Generator
                </h1>
                <p className="mt-0.5 text-[11px] text-muted">
                  Proforma invoices and invoices from the original Word templates.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-line bg-mist px-3 py-1.5 text-[11px] font-semibold text-muted">
              <LockIcon className="h-3.5 w-3.5 text-cyan" />
              Local-only · No sign-in
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:py-6">
          {status ? (
            <div
              role={status.type === 'error' ? 'alert' : 'status'}
              className={cx(
                'mb-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm',
                status.type === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
                status.type === 'error' && 'border-red-200 bg-red-50 text-red-900',
                status.type === 'info' && 'border-line bg-white text-ink',
              )}
            >
              <span className="mt-0.5 shrink-0">
                {status.type === 'success' ? (
                  <CheckIcon className="text-emerald-700" />
                ) : status.type === 'error' ? (
                  <AlertIcon className="text-red-700" />
                ) : (
                  <PrintIcon className="text-cyan" />
                )}
              </span>
              <p className="min-w-0 flex-1 leading-relaxed">{status.message}</p>
              <button
                type="button"
                onClick={() => setStatus(null)}
                className="shrink-0 rounded p-1 text-current opacity-60 hover:opacity-100"
                aria-label="Dismiss message"
              >
                <span aria-hidden="true" className="block text-base leading-none">
                  ×
                </span>
              </button>
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-line bg-white p-1 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileView('editor')}
              className={cx(
                'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold',
                mobileView === 'editor' ? 'bg-ink text-white' : 'text-muted hover:bg-mist',
              )}
              aria-pressed={mobileView === 'editor'}
            >
              <PencilIcon />
              Edit invoice
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={cx(
                'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold',
                mobileView === 'preview' ? 'bg-ink text-white' : 'text-muted hover:bg-mist',
              )}
              aria-pressed={mobileView === 'preview'}
            >
              <EyeIcon />
              Preview
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] xl:gap-6">
            <div className={cx(mobileView === 'editor' ? 'block' : 'hidden', 'lg:block')}>
              <EditorPanel
                form={form}
                updateField={updateField}
                onChangeDocumentType={changeDocumentType}
                calculation={calculation}
                validation={validation}
                showValidation={showValidation}
                lastAddedId={lastAddedId}
                isGenerating={isGenerating}
                onAddItem={addItem}
                onChangeItem={updateItem}
                onDeleteItem={deleteItem}
                onMoveItem={moveItem}
                onLoadSample={requestLoadSample}
                onClearItems={requestClearItems}
                onReset={requestReset}
                onDownload={handleDownload}
                onPrint={handlePrint}
              />
            </div>

            <aside
              className={cx(
                mobileView === 'preview' ? 'block' : 'hidden',
                'min-w-0 lg:block lg:sticky lg:top-4 lg:self-start',
              )}
            >
              <div className="flex max-h-none flex-col overflow-hidden rounded-lg border border-line bg-[#E8ECF1] lg:max-h-[calc(100vh-2rem)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-3 py-2.5 sm:px-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan">
                      Live preview
                    </p>
                    <p className="text-xs font-bold text-ink">A4 · {documentConfig.label}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <WordIcon />
                      {isGenerating ? 'Working…' : 'Word'}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-canvas"
                    >
                      <PrintIcon />
                      Print
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <ScaledInvoice key={mobileView}>
                    <InvoiceDocument form={form} calculation={calculation} />
                  </ScaledInvoice>
                </div>
              </div>
              {showValidation && !validation.success ? (
                <p className="mt-2 text-xs font-medium text-red-700">
                  {errorCount} validation {errorCount === 1 ? 'issue' : 'issues'} — fix the
                  highlighted fields in the editor to enable accurate output.
                </p>
              ) : null}
            </aside>
          </div>

          <footer className="mt-6 border-t border-line pt-4 text-[11px] leading-relaxed text-slate-500">
            <p>
              Invoice data is processed in your browser and is never sent to a third-party
              service. No accounts, analytics or permanent storage are used.
            </p>
            <p className="mt-1">
              Generated Word files use the matching original Shifra Nuha Technologies template.
            </p>
          </footer>
        </main>
      </div>

      <div className="print-root" aria-hidden="true">
        <InvoiceDocument form={form} calculation={calculation} />
      </div>

      {pendingConfirm ? (
        <ConfirmDialog
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          confirmLabel={pendingConfirm.confirmLabel}
          destructive={pendingConfirm.destructive}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => {
            const action = pendingConfirm.action;
            setPendingConfirm(null);
            action();
          }}
        />
      ) : null}
    </>
  );
}
