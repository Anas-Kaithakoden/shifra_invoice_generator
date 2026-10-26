import {
  DOCUMENT_TYPES,
  type InvoiceCalculation,
  type InvoiceForm,
} from '../lib/invoice';
import { formatINR } from '../lib/money';
import { Alert, Button, Field, MoneyInput, Section, TextInput, cx } from './ui';

export function PaymentSummaryEditor({
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
  const config = DOCUMENT_TYPES[form.documentType];

  return (
    <Section
      eyebrow="05 · Payment summary"
      title={config.summaryTitle}
      description={config.summaryDescription}
    >
      <div className="overflow-hidden rounded-md border border-line">
        <div className="grid gap-3 border-b border-line bg-mist/70 p-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <p className="text-sm font-bold text-ink">
              {form.totalLabel.trim() || config.labels.total}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {calculation.totalOverrideActive
                ? 'Manual override is active.'
                : 'Calculated from the included line items.'}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xl font-bold tabular-nums text-ink" data-testid="summary-total">
              {calculation.effectiveTotalPaise !== null
                ? formatINR(calculation.effectiveTotalPaise)
                : '—'}
            </p>
            {form.overrideTotal ? (
              <p className="mt-0.5 text-[11px] tabular-nums text-muted">
                Line-item total:{' '}
                {calculation.totalPaise !== null ? formatINR(calculation.totalPaise) : '—'}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 p-3.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={form.overrideTotal}
              onChange={(event) => updateField('overrideTotal', event.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-cyan"
            />
            <span>
              <span className="block text-xs font-bold text-ink">
                {config.totalOverrideLabel}
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                Use this only when the invoice total differs from the sum of the rows.
              </span>
            </span>
          </label>

          {form.overrideTotal ? (
            <div className="grid gap-2 rounded-md border border-line bg-canvas/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <Field
                label={config.manualTotalLabel}
                htmlFor="total-override"
                error={showError('totalOverride')}
                className="max-w-xs"
              >
                <MoneyInput
                  id="total-override"
                  value={form.totalOverride}
                  onChange={(event) => updateField('totalOverride', event.target.value)}
                  placeholder="0.00"
                  invalid={Boolean(showError('totalOverride'))}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateField('overrideTotal', false)}
                className="sm:mt-6"
              >
                Use line-item total
              </Button>
            </div>
          ) : null}

          <Field
            label={form.advanceLabel.trim() || config.labels.advance}
            htmlFor="advance"
            error={showError('advance')}
            hint={config.advanceHint}
            className="max-w-xs"
          >
            <MoneyInput
              id="advance"
              value={form.advance}
              onChange={(event) => updateField('advance', event.target.value)}
              placeholder="0.00"
              invalid={Boolean(showError('advance'))}
            />
          </Field>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <div>
              <p className="text-xs font-bold text-ink">
                {form.balanceLabel.trim() || config.labels.balance}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {form.totalLabel.trim() || config.labels.total} minus{' '}
                {form.advanceLabel.trim() || config.labels.advance}
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
              {calculation.balancePaise !== null ? formatINR(calculation.balancePaise) : '—'}
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

      <details className="mt-4 rounded-md border border-line bg-canvas/40">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-ink">
          Customize payment summary labels
        </summary>
        <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-3">
          <Field
            label="Total label"
            htmlFor="total-label"
            error={showError('totalLabel')}
          >
            <TextInput
              id="total-label"
              value={form.totalLabel}
              onChange={(event) => updateField('totalLabel', event.target.value)}
              maxLength={60}
            />
          </Field>
          <Field
            label={config.advanceLabelField}
            htmlFor="advance-label"
            error={showError('advanceLabel')}
          >
            <TextInput
              id="advance-label"
              value={form.advanceLabel}
              onChange={(event) => updateField('advanceLabel', event.target.value)}
              maxLength={60}
            />
          </Field>
          <Field
            label="Balance label"
            htmlFor="balance-label"
            error={showError('balanceLabel')}
          >
            <TextInput
              id="balance-label"
              value={form.balanceLabel}
              onChange={(event) => updateField('balanceLabel', event.target.value)}
              maxLength={60}
            />
          </Field>
        </div>
      </details>
    </Section>
  );
}
