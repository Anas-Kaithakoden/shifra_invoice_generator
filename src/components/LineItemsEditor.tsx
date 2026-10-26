import { useEffect, useMemo, useRef } from 'react';
import type { InvoiceCalculation, InvoiceForm, LineItem } from '../lib/invoice';
import { formatINRWithoutSymbol } from '../lib/money';
import {
  Alert,
  ArrowDownIcon,
  ArrowUpIcon,
  Button,
  MoneyInput,
  PlusIcon,
  Section,
  TextInput,
  TrashIcon,
  cx,
} from './ui';

export function LineItemsEditor({
  form,
  calculation,
  showValidation,
  itemErrors,
  lastAddedId,
  onAddItem,
  onChangeItem,
  onDeleteItem,
  onMoveItem,
  onLoadSample,
  onClearItems,
}: {
  form: InvoiceForm;
  calculation: InvoiceCalculation;
  showValidation: boolean;
  itemErrors: Record<string, { description?: string; qty?: string; amount?: string }>;
  lastAddedId: string | null;
  onAddItem: () => void;
  onChangeItem: (id: string, patch: Partial<LineItem>) => void;
  onDeleteItem: (id: string) => void;
  onMoveItem: (id: string, direction: -1 | 1) => void;
  onLoadSample: () => void;
  onClearItems: () => void;
}) {
  const calculationById = useMemo(
    () => new Map(calculation.items.map((entry) => [entry.item.id, entry])),
    [calculation.items],
  );
  const focusRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (lastAddedId) focusRef.current?.focus();
  }, [lastAddedId]);

  const includedCount = calculation.includedItems.length;

  return (
    <Section
      eyebrow="04 · Line items"
      title="Description, quantity and amount"
      description="Add as many rows as needed. The invoice total adds each included row's amount; quantity is printed for reference but does not multiply the amount."
      action={
        <Button type="button" variant="cyan" size="sm" onClick={onAddItem}>
          <PlusIcon />
          Add item
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {includedCount === 0
            ? 'No items on the invoice.'
            : `${includedCount} included ${includedCount === 1 ? 'item' : 'items'}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onLoadSample}>
            Load sample rows
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClearItems}>
            Clear all rows
          </Button>
        </div>
      </div>

      {form.items.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-canvas/60 px-4 py-8 text-center">
          <p className="text-sm font-bold text-ink">No line items yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            Add a row for each service, or load the sample rows from the original template.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="cyan" size="sm" onClick={onAddItem}>
              <PlusIcon />
              Add first item
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onLoadSample}>
              Load sample rows
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden gap-2 border-b border-line pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted sm:grid sm:grid-cols-[40px_minmax(0,1fr)_72px_138px_92px]">
            <span>On</span>
            <span>Description</span>
            <span className="text-center">Qty</span>
            <span>Amount (₹)</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-line">
            {form.items.map((item, index) => {
              const entry = calculationById.get(item.id);
              const errors = itemErrors[item.id] ?? {};
              const amountError = entry?.amountError;
              const descriptionError =
                entry?.descriptionError && (showValidation || Boolean(item.amount.trim()))
                  ? entry.descriptionError
                  : undefined;
              const qtyError =
                entry?.qtyError && (showValidation || Boolean(item.qty.trim()))
                  ? entry.qtyError
                  : undefined;

              return (
                <div
                  key={item.id}
                  className={cx(
                    'grid gap-2 py-3 first:pt-3 last:pb-0 sm:grid-cols-[40px_minmax(0,1fr)_72px_138px_92px] sm:items-start',
                    !item.included && 'opacity-55',
                  )}
                >
                  <div className="flex items-center justify-between sm:block sm:pt-2">
                    <span className="text-xs font-semibold text-muted sm:hidden">
                      Include on invoice
                    </span>
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={(event) =>
                        onChangeItem(item.id, { included: event.target.checked })
                      }
                      className="h-4 w-4 cursor-pointer accent-cyan"
                      aria-label={`Include ${item.description.trim() || `item ${index + 1}`} on invoice`}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`item-description-${item.id}`}
                      className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted sm:sr-only"
                    >
                      Description
                    </label>
                    <TextInput
                      ref={index === form.items.length - 1 ? focusRef : undefined}
                      id={`item-description-${item.id}`}
                      value={item.description}
                      onChange={(event) =>
                        onChangeItem(item.id, { description: event.target.value })
                      }
                      maxLength={300}
                      placeholder="e.g. Company Incorporation Professional Fee"
                      aria-label={`Description for item ${index + 1}`}
                      aria-invalid={Boolean(errors.description) || undefined}
                    />
                    {descriptionError ? (
                      <p className="mt-1 text-xs font-medium text-red-700" role="alert">
                        {descriptionError}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor={`item-qty-${item.id}`}
                      className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted sm:sr-only"
                    >
                      Qty
                    </label>
                    <TextInput
                      id={`item-qty-${item.id}`}
                      value={item.qty}
                      onChange={(event) => onChangeItem(item.id, { qty: event.target.value })}
                      inputMode="numeric"
                      maxLength={6}
                      className="text-center tabular-nums"
                      aria-label={`Quantity for item ${index + 1}`}
                      aria-invalid={Boolean(errors.qty) || undefined}
                    />
                    {qtyError ? (
                      <p className="mt-1 text-xs font-medium text-red-700" role="alert">
                        {qtyError}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor={`item-amount-${item.id}`}
                      className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted sm:sr-only"
                    >
                      Amount (₹)
                    </label>
                    <MoneyInput
                      id={`item-amount-${item.id}`}
                      value={item.amount}
                      onChange={(event) => onChangeItem(item.id, { amount: event.target.value })}
                      placeholder="0.00"
                      aria-label={`Amount for item ${index + 1}`}
                      invalid={Boolean(amountError)}
                    />
                    {amountError ? (
                      <p className="mt-1 text-xs font-medium text-red-700" role="alert">
                        {amountError}
                      </p>
                    ) : entry && !entry.isEmpty ? (
                      <p className="mt-1 text-[11px] tabular-nums text-slate-500">
                        ₹{formatINRWithoutSymbol(entry.amountPaise ?? 0)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-end gap-1 sm:pt-1">
                    <button
                      type="button"
                      onClick={() => onMoveItem(item.id, -1)}
                      disabled={index === 0}
                      className="rounded border border-transparent p-1.5 text-muted hover:border-line hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Move item ${index + 1} up`}
                      title="Move up"
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveItem(item.id, 1)}
                      disabled={index === form.items.length - 1}
                      className="rounded border border-transparent p-1.5 text-muted hover:border-line hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Move item ${index + 1} down`}
                      title="Move down"
                    >
                      <ArrowDownIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="rounded border border-transparent p-1.5 text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Delete item ${index + 1}`}
                      title="Delete item"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {calculation.itemErrorCount > 0 ? (
        <div className="mt-3">
          <Alert tone="error">
            Some row amounts or descriptions need attention. Invalid amounts are not included in
            the total and will block Word generation until fixed.
          </Alert>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Use 0 for a zero-value item. An empty amount is treated as ₹0.00. Uncheck “Include on
        invoice” to keep a row in the editor but leave it out of the document and total.
      </p>
    </Section>
  );
}
