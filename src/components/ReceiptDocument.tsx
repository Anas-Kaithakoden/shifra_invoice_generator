import {
  DOCUMENT_TYPES,
  type InvoiceCalculation,
  type InvoiceForm,
} from '../lib/invoice';
import { formatINR, formatINRWithoutSymbol } from '../lib/money';
import { formatDateDDMMYYYY } from '../lib/date';
import {
  DocumentFooter,
  DocumentHeader,
  placeholder,
} from './InvoiceDocument';

export function ReceiptDocument({
  form,
  calculation,
}: {
  form: InvoiceForm;
  calculation: InvoiceCalculation;
}) {
  const config = DOCUMENT_TYPES.receipt;
  const contact = [form.clientPhone.trim(), form.clientEmail.trim()]
    .filter(Boolean)
    .join('  |  ');
  const invoiceNumber = form.invoiceNumber.trim();
  const amount = calculation.advancePaise;
  const total = calculation.effectiveTotalPaise;
  const balance = calculation.balancePaise;
  const paymentDate = formatDateDDMMYYYY(form.paymentDate);

  return (
    <div
      className="invoice-page"
      data-testid="invoice-page"
      data-document-type={form.documentType}
    >
      <div className="invoice-content">
        <DocumentHeader
          title={config.previewTitle}
          numberLabel={config.numberLabel}
          number={form.documentNumber.trim()}
          dateText={formatDateDDMMYYYY(form.invoiceDate)}
        />

        <div className="inv-rule" />

        <section className="inv-parties">
          <div className="inv-bill-to">
            <div className="inv-label">RECEIVED FROM</div>
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
            <div className="inv-label">PAYMENT FOR</div>
            <div className="inv-service-name">
              {placeholder(
                form.serviceName.trim(),
                'Service or description of payment',
              )}
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
            <tr>
              <td className="inv-item-description">
                Payment received against Invoice No.{' '}
                {placeholder(invoiceNumber, 'SNT-INV-YYYY-XXX')}
              </td>
              <td className="inv-item-qty">1</td>
              <td className="inv-item-amount">
                {amount !== null ? formatINRWithoutSymbol(amount) : '—'}
              </td>
            </tr>
          </tbody>
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
                  <th scope="row">Amount Received</th>
                  <td>{amount !== null ? formatINR(amount) : '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Invoice Total</th>
                  <td>{total !== null ? formatINR(total) : '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Balance Due</th>
                  <td>{balance !== null ? formatINR(balance) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="inv-divider" />

          <table className="inv-bank inv-receipt-details">
            <tbody>
              <tr>
                <th scope="row">PAYMENT MODE:</th>
                <td>{placeholder(form.paymentMode.trim(), '—')}</td>
              </tr>
              <tr>
                <th scope="row">REFERENCE NO:</th>
                <td>{placeholder(form.paymentReference.trim(), '—')}</td>
              </tr>
              <tr>
                <th scope="row">INVOICE NO:</th>
                <td>{placeholder(invoiceNumber, '—')}</td>
              </tr>
              <tr>
                <th scope="row">PAYMENT DATE:</th>
                <td>{placeholder(paymentDate, 'DD/MM/YYYY')}</td>
              </tr>
              <tr>
                <th scope="row">RECEIVED BY:</th>
                <td>Shifra Nuha Technologies</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <DocumentFooter footer={config.footer} />
    </div>
  );
}
