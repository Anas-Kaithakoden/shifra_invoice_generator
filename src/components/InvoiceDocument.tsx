import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  DOCUMENT_TYPES,
  type InvoiceCalculation,
  type InvoiceForm,
} from '../lib/invoice';
import { formatINR, formatINRWithoutSymbol } from '../lib/money';
import { formatDateDDMMYYYY } from '../lib/date';

function placeholder(text: string, fallback: string, className = '') {
  if (text) return <span className={className}>{text}</span>;
  return <span className={`inv-placeholder ${className}`}>{fallback}</span>;
}

export function InvoiceDocument({
  form,
  calculation,
}: {
  form: InvoiceForm;
  calculation: InvoiceCalculation;
}) {
  const config = DOCUMENT_TYPES[form.documentType];
  const contact = [form.clientPhone.trim(), form.clientEmail.trim()]
    .filter(Boolean)
    .join('  |  ');
  const visibleItems = calculation.includedItems;
  const totalLabel = form.totalLabel.trim() || config.labels.total;
  const advanceLabel = form.advanceLabel.trim() || config.labels.advance;
  const balanceLabel = form.balanceLabel.trim() || config.labels.balance;
  const total = calculation.effectiveTotalPaise;
  const advance = calculation.advancePaise;
  const balance = calculation.balancePaise;

  return (
    <div className="invoice-page" data-testid="invoice-page">
      <div className="invoice-content">
        <header className="inv-header">
          <div className="inv-logo-cell">
            <img
              src={`${import.meta.env.BASE_URL}shifra-logo.png`}
              alt="Shifra Nuha Technologies"
              className="inv-logo"
            />
          </div>
          <div className="inv-company">
            <div className="inv-company-name">SHIFRA NUHA TECHNOLOGIES</div>
            <div className="inv-tagline">Business Registration &amp; Professional Support</div>
            <div className="inv-company-line">Ryan Complex, Chungathara, Malappuram, 679334</div>
            <div className="inv-company-line">+91 9447979616 | info@shifranuhatech.com</div>
          </div>
          <div className="inv-title-block">
            <div className="inv-doc-title">{config.previewTitle}</div>
            <div className="inv-meta">
              <span className="inv-meta-label">{config.numberLabel}&nbsp; </span>
              {placeholder(form.documentNumber.trim(), '—', 'inv-meta-value')}
            </div>
            <div className="inv-meta inv-meta-date">
              <span className="inv-meta-label">Date:&nbsp; </span>
              <span className="inv-meta-value">
                {form.invoiceDate ? formatDateDDMMYYYY(form.invoiceDate) || 'DD/MM/YYYY' : 'DD/MM/YYYY'}
              </span>
            </div>
          </div>
        </header>

        <div className="inv-rule" />

        <section className="inv-parties">
          <div className="inv-bill-to">
            <div className="inv-label">BILL TO</div>
            <div className="inv-client-name">
              {placeholder(form.clientName.trim(), 'Client / Business Name')}
            </div>
            <div className="inv-client-address">
              {placeholder(form.clientAddress.trim(), 'Client address')}
            </div>
            <div className="inv-client-contact" aria-hidden={contact ? undefined : true}>
              {contact || '\u00a0'}
            </div>
          </div>
          <div className="inv-service-block">
            <div className="inv-label">SERVICE</div>
            <div className="inv-service-name">
              {placeholder(form.serviceName.trim(), 'Service or invoice title')}
            </div>
          </div>
        </section>

        <div className="inv-items-gap" />

        <table className="inv-items">
          <colgroup>
            <col className="inv-col-description" />
            <col className="inv-col-qty" />
            <col className="inv-col-amount" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">DESCRIPTION</th>
              <th scope="col" className="inv-align-center">
                QTY
              </th>
              <th scope="col" className="inv-align-right">
                AMOUNT (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((entry) => (
              <tr key={entry.item.id}>
                <td className="inv-item-description">
                  {placeholder(entry.item.description.trim(), 'Item description')}
                </td>
                <td className="inv-item-qty">{entry.item.qty.trim() || '—'}</td>
                <td className="inv-item-amount">
                  {entry.amountPaise !== null && !entry.amountError
                    ? formatINRWithoutSymbol(entry.amountPaise)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Print-only spacer. It repeats as a table footer on every printed
              page, keeping rows clear of the fixed page footer. */}
          <tfoot className="inv-print-tfoot" aria-hidden="true">
            <tr>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>

        <div className="inv-summary-gap" />

        <div className="inv-summary-bank-block">
          <div className="inv-summary-wrap">
            <table className="inv-summary">
              <tbody>
                <tr className="inv-summary-total">
                  <th scope="row">{totalLabel}</th>
                  <td>{total !== null ? formatINR(total) : '—'}</td>
                </tr>
                <tr>
                  <th scope="row">{advanceLabel}</th>
                  <td>{advance !== null ? formatINR(advance) : '—'}</td>
                </tr>
                <tr>
                  <th scope="row">{balanceLabel}</th>
                  <td>{balance !== null ? formatINR(balance) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="inv-divider" />

          <table className="inv-bank">
            <tbody>
              <tr>
                <th scope="row">ACCOUNT HOLDER:</th>
                <td>Anas</td>
              </tr>
              <tr>
                <th scope="row">ACCOUNT NUMBER:</th>
                <td>41868247390</td>
              </tr>
              <tr>
                <th scope="row">IFSC:</th>
                <td>SBIN0071126</td>
              </tr>
              <tr>
                <th scope="row">BRANCH:</th>
                <td>CHUNGATHARA</td>
              </tr>
              <tr>
                <th scope="row">UPI ID:</th>
                <td>shifranuhatech@ybl</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <footer className="inv-footer">
        <div>{config.footer}</div>
        <div>Thank you for choosing Shifra Nuha Technologies.</div>
      </footer>
    </div>
  );
}

export function ScaledInvoice({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ scale: 1, width: 794, height: 1123, ready: false });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const page = pageRef.current;
    if (!container || !page) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pageWidth = page.offsetWidth;
        const pageHeight = page.offsetHeight;
        if (!pageWidth) return;
        const style = window.getComputedStyle(container);
        const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
        const paddingRight = Number.parseFloat(style.paddingRight) || 0;
        const available = Math.max(120, container.clientWidth - paddingLeft - paddingRight);
        const scale = Math.min(1, available / pageWidth);
        setMetrics({
          scale,
          width: pageWidth * scale,
          height: pageHeight * scale,
          ready: true,
        });
      });
    };

    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(page);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="preview-scroll">
      <div
        className="preview-sizer mx-auto"
        style={{
          width: metrics.width,
          height: metrics.height,
          visibility: metrics.ready ? 'visible' : 'hidden',
        }}
      >
        <div
          ref={pageRef}
          className="preview-scale-source"
          style={{ transform: `scale(${metrics.scale})` }}
        >
          {children}
        </div>
      </div>
      <p className="preview-scale-note">
        A4 preview · scaled to fit. Use Print / Save as PDF for full-size output.
      </p>
    </div>
  );
}
