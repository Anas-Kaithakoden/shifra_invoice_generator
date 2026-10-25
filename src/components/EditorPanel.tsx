import type { InvoiceCalculation, InvoiceForm, LineItem, ValidationResult } from '../lib/invoice';
import { LineItemsEditor } from './LineItemsEditor';
import { PaymentSummaryEditor } from './PaymentSummaryEditor';
import {
  Alert,
  Button,
  Field,
  PrintIcon,
  ResetIcon,
  Section,
  TextArea,
  TextInput,
  WordIcon,
} from './ui';

export function EditorPanel({
  form,
  updateField,
  calculation,
  validation,
  showValidation,
  lastAddedId,
  isGenerating,
  onAddItem,
  onChangeItem,
  onDeleteItem,
  onMoveItem,
  onLoadSample,
  onClearItems,
  onReset,
  onDownload,
  onPrint,
}: {
  form: InvoiceForm;
  updateField: <K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) => void;
  calculation: InvoiceCalculation;
  validation: ValidationResult;
  showValidation: boolean;
  lastAddedId: string | null;
  isGenerating: boolean;
  onAddItem: () => void;
  onChangeItem: (id: string, patch: Partial<LineItem>) => void;
  onDeleteItem: (id: string) => void;
  onMoveItem: (id: string, direction: -1 | 1) => void;
  onLoadSample: () => void;
  onClearItems: () => void;
  onReset: () => void;
  onDownload: () => void;
  onPrint: () => void;
}) {
  const showError = (key: string) => (showValidation ? validation.errors[key] : undefined);
  const errorCount =
    Object.keys(validation.errors).length + Object.keys(validation.itemErrors).length;

  return (
    <div className="space-y-4">
      <Section
        eyebrow="01 · Client details"
        title="Bill to"
        description="Phone and email are optional. The address can span multiple lines."
      >
        <div className="grid gap-4">
          <Field
            label="Client / Business Name"
            htmlFor="client-name"
            error={showError('clientName')}
          >
            <TextInput
              id="client-name"
              value={form.clientName}
              onChange={(event) => updateField('clientName', event.target.value)}
              placeholder="Client or business name"
              maxLength={160}
              autoComplete="off"
              aria-invalid={Boolean(showError('clientName')) || undefined}
            />
          </Field>

          <Field
            label="Client Address"
            htmlFor="client-address"
            error={showError('clientAddress')}
          >
            <TextArea
              id="client-address"
              value={form.clientAddress}
              onChange={(event) => updateField('clientAddress', event.target.value)}
              placeholder={'Building / street\nCity, State, PIN'}
              maxLength={600}
              rows={3}
              autoComplete="off"
              aria-invalid={Boolean(showError('clientAddress')) || undefined}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client Phone" htmlFor="client-phone" optional error={showError('clientPhone')}>
              <TextInput
                id="client-phone"
                type="tel"
                value={form.clientPhone}
                onChange={(event) => updateField('clientPhone', event.target.value)}
                placeholder="+91 98765 43210"
                maxLength={40}
                autoComplete="off"
                aria-invalid={Boolean(showError('clientPhone')) || undefined}
              />
            </Field>
            <Field label="Client Email" htmlFor="client-email" optional error={showError('clientEmail')}>
              <TextInput
                id="client-email"
                type="email"
                value={form.clientEmail}
                onChange={(event) => updateField('clientEmail', event.target.value)}
                placeholder="client@example.com"
                maxLength={160}
                autoComplete="off"
                aria-invalid={Boolean(showError('clientEmail')) || undefined}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="02 · Invoice details"
        title="Service and proforma reference"
        description="The service title appears in the template's SERVICE area. The date is printed as DD/MM/YYYY."
      >
        <div className="grid gap-4">
          <Field
            label="Service Name / Invoice Title"
            htmlFor="service-name"
            error={showError('serviceName')}
          >
            <TextInput
              id="service-name"
              value={form.serviceName}
              onChange={(event) => updateField('serviceName', event.target.value)}
              placeholder="e.g. Private Limited Company Registration"
              maxLength={200}
              autoComplete="off"
              aria-invalid={Boolean(showError('serviceName')) || undefined}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Proforma Invoice Number"
              htmlFor="proforma-number"
              error={showError('proformaNumber')}
              hint="Enter this manually; no numbering scheme is applied."
            >
              <TextInput
                id="proforma-number"
                value={form.proformaNumber}
                onChange={(event) => updateField('proformaNumber', event.target.value)}
                placeholder="e.g. SNT-PI-2026-101"
                maxLength={80}
                autoComplete="off"
                aria-invalid={Boolean(showError('proformaNumber')) || undefined}
              />
            </Field>
            <Field
              label="Invoice Date"
              htmlFor="invoice-date"
              error={showError('invoiceDate')}
              hint="Stored as a date; shown as DD/MM/YYYY."
            >
              <TextInput
                id="invoice-date"
                type="date"
                value={form.invoiceDate}
                onChange={(event) => updateField('invoiceDate', event.target.value)}
                autoComplete="off"
                aria-invalid={Boolean(showError('invoiceDate')) || undefined}
              />
            </Field>
          </div>
        </div>
      </Section>

      <LineItemsEditor
        form={form}
        calculation={calculation}
        showValidation={showValidation}
        itemErrors={validation.itemErrors}
        lastAddedId={lastAddedId}
        onAddItem={onAddItem}
        onChangeItem={onChangeItem}
        onDeleteItem={onDeleteItem}
        onMoveItem={onMoveItem}
        onLoadSample={onLoadSample}
        onClearItems={onClearItems}
      />

      <PaymentSummaryEditor
        form={form}
        updateField={updateField}
        calculation={calculation}
        showValidation={showValidation}
        errors={validation.errors}
      />

      <section className="rounded-lg border border-line bg-white px-4 py-4 sm:px-5" id="actions">
        {showValidation && !validation.success ? (
          <div className="mb-3" id="validation-summary">
            <Alert tone="error">
              {errorCount === 1
                ? 'One field needs attention before a document can be generated.'
                : `${errorCount} fields need attention before a document can be generated.`}{' '}
              Review the highlighted fields above.
            </Alert>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="button"
            variant="primary"
            onClick={onDownload}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            <WordIcon />
            {isGenerating ? 'Generating Word file…' : 'Download Word'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onPrint}
            className="w-full sm:w-auto"
          >
            <PrintIcon />
            Print / Save as PDF
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onReset}
            className="w-full sm:ml-auto sm:w-auto"
          >
            <ResetIcon />
            Reset form
          </Button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Download Word uses the original Shifra Nuha template and keeps it editable. Print
          opens your browser&apos;s print dialog and can be saved as PDF there; the app does not
          create a PDF directly.
        </p>
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-slate-500">
        Invoice data stays in this browser tab. Nothing is uploaded, saved to a database, or
        included in analytics.
      </p>
    </div>
  );
}
