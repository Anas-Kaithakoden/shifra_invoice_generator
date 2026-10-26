import {
  DOCUMENT_TYPES,
  type InvoiceCalculation,
  type InvoiceForm,
} from '../lib/invoice';
import { formatINR } from '../lib/money';
import {
  Alert,
  Field,
  MoneyInput,
  Section,
  TextInput,
  cx,
} from './ui';

export function ReceiptPaymentEditor({
  form,
  updateField,
  calculation,
  showValidation,
  errors,
}: {
  form: InvoiceForm;
  updateField: <K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) => void;
  calculation: InvoiceCalculation;
  showValidation: boolean;
  errors: Record<string, string>;
}) {
  const showError = (key: string) => (showValidation ? errors[key] : undefined);
  const config = DOCUMENT_TYPES.receipt;

  return (
    <Section
      eyebrow="04 · Payment details"
      title={config.summaryTitle}
      description={config.summaryDescription}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Invoice Number"
            htmlFor="receipt-invoice-number"
            error={showError('invoiceNumber')}
            hint="The invoice this payment is being received against."
          >
            <TextInput
              id="receipt-invoice-number"
              value={form.invoiceNumber}
              onChange={(event) => updateField('invoiceNumber', event.target.value)}
              placeholder="e.g. SNT-INV-2026-101"
              maxLength={80}
              autoComplete="off"
              aria-invalid={Boolean(showError('invoiceNumber')) || undefined}
            />
          </Field>
          <Field
            label="Payment Date"
            htmlFor="payment-date"
            error={showError('paymentDate')}
            hint="Stored as a date; shown as DD/MM/YYYY."
          >
            <TextInput
              id="payment-date"
              type="date"
              value={form.paymentDate}
              onChange={(event) => updateField('paymentDate', event.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(showError('paymentDate')) || undefined}
            />
          </Field>
          <Field
            label="Payment Mode"
            htmlFor="payment-mode"
            error={showError('paymentMode')}
            optional
          >
            <TextInput
              id="payment-mode"
              value={form.paymentMode}
              onChange={(event) => updateField('paymentMode', event.target.value)}
              placeholder="e.g. UPI, bank transfer, cash"
              maxLength={40}
              autoComplete="off"
              aria-invalid={Boolean(showError('paymentMode')) || undefined}
            />
          </Field>
          <Field
            label="Reference No."
            htmlFor="payment-reference"
            error={showError('paymentReference')}
            hint="UPI reference, transaction ID, cheque number, etc."
            optional
          >
            <TextInput
              id="payment-reference"
              value={form.paymentReference}
              onChange={(event) => updateField('paymentReference', event.target.value)}
              placeholder="e.g. UPI reference or cheque number"
              maxLength={80}
              autoComplete="off"
              aria-invalid={Boolean(showError('paymentReference')) || undefined}
            />
          </Field>
        </div>

        <div className="overflow-hidden rounded-md border border-line">
          <div className="grid gap-4 p-3.5 sm:grid-cols-2">
            <Field
              label="Amount Received"
              htmlFor="receipt-amount"
              error={showError('advance')}
              hint="The amount paid by the client."
            >
              <MoneyInput
                id="receipt-amount"
                value={form.advance}
                onChange={(event) => updateField('advance', event.target.value)}
                placeholder="0.00"
                invalid={Boolean(showError('advance'))}
              />
            </Field>
            <Field
              label="Invoice Total"
              htmlFor="invoice-total"
              error={showError('invoiceTotal')}
              hint="The total value of the original invoice."
            >
              <MoneyInput
                id="invoice-total"
                value={form.invoiceTotal}
                onChange={(event) => updateField('invoiceTotal', event.target.value)}
                placeholder="0.00"
                invalid={Boolean(showError('invoiceTotal'))}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-mist/50 px-3.5 py-3">
            <div>
              <p className="text-sm font-bold text-ink">Balance Due</p>
              <p className="mt-0.5 text-[11px] text-muted">
                Invoice Total minus Amount Received
              </p>
            </div>
            <p
              className={cx(
                'text-xl font-bold tabular-nums',
                calculation.balancePaise !== null && calculation.balancePaise < 0
                  ? 'text-amber-700'
                  : 'text-ink',
              )}
              data-testid="summary-balance"
            >
              {calculation.balancePaise !== null
                ? formatINR(calculation.balancePaise)
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {calculation.advanceExceedsTotal ? (
        <div className="mt-3">
          <Alert tone="warning">{config.advanceExceedsMessage}</Alert>
        </div>
      ) : null}

      {calculation.effectiveTotalPaise === null ? (
        <div className="mt-3">
          <Alert tone="warning">{config.totalInvalidMessage}</Alert>
        </div>
      ) : null}
    </Section>
  );
}
