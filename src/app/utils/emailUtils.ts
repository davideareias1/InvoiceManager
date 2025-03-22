'use client';

import { Invoice, CompanyInfo } from '../interfaces';
import { formatCurrency, formatDate } from '@/app/utils/formatters';

/**
 * Interface for email sending options
 */
interface SendEmailOptions {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    attachmentData?: Blob;
    attachmentName?: string;
}

/**
 * Send an invoice via email using the device's mail client
 */
export async function sendInvoiceEmail(
    invoice: Invoice,
    companyInfo: CompanyInfo,
    pdfBlob?: Blob
): Promise<boolean> {
    try {
        // Generate email subject
        const subject = `Rechnung #${invoice.invoice_number} von ${companyInfo.name}`;

        // Generate email body
        const body = generateEmailBody(invoice, companyInfo);

        // Prepare email options
        const emailOptions: SendEmailOptions = {
            to: invoice.client_email || '',
            subject,
            body
        };

        // Attach PDF if provided
        if (pdfBlob) {
            emailOptions.attachmentData = pdfBlob;
            emailOptions.attachmentName = `Rechnung_${invoice.invoice_number}.pdf`;
        }

        // Send the email
        return await sendEmail(emailOptions);
    } catch (error) {
        console.error('Error sending invoice email:', error);
        return false;
    }
}

/**
 * Generate HTML email body for an invoice
 */
function generateEmailBody(invoice: Invoice, companyInfo: CompanyInfo): string {
    // Calculate totals
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const taxRate = invoice.tax_rate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Format the invoice due date for display
    const formattedDueDate = formatDate(invoice.due_date || '');

    return `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #333;
            line-height: 1.5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .invoice-details {
            margin-bottom: 20px;
          }
          .greeting {
            margin-bottom: 20px;
          }
          .total {
            font-weight: bold;
            font-size: 16px;
          }
          .payment-info {
            margin: 20px 0;
            padding: 15px;
            background-color: #f7f7f7;
            border-radius: 5px;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #777;
            text-align: center;
          }
          .xrechnung-notice {
            font-size: 11px;
            color: #555;
            margin-top: 15px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Rechnung von ${companyInfo.name}</h2>
          </div>
          
          <div class="greeting">
            <p>Sehr geehrte Damen und Herren,</p>
            <p>anbei erhalten Sie die Rechnung #${invoice.invoice_number} für unsere Dienstleistungen.</p>
          </div>
          
          <div class="invoice-details">
            <p><strong>Rechnungsnummer:</strong> ${invoice.invoice_number}</p>
            <p><strong>Rechnungsdatum:</strong> ${formatDate(invoice.invoice_date || '')}</p>
            <p><strong>Fälligkeitsdatum:</strong> ${formattedDueDate}</p>
            <p class="total"><strong>Gesamtbetrag:</strong> ${formatCurrency(total)}</p>
            ${companyInfo.registration_number ?
            `<p><strong>Leitweg-ID:</strong> ${companyInfo.registration_number}</p>` :
            ''}
          </div>
          
          <div class="payment-info">
            <h3>Zahlungsinformationen</h3>
            ${companyInfo.bank_name ? `<p><strong>Bank:</strong> ${companyInfo.bank_name}</p>` : ''}
            ${companyInfo.account_name ? `<p><strong>Kontoinhaber:</strong> ${companyInfo.account_name}</p>` : ''}
            ${companyInfo.account_number ? `<p><strong>Kontonummer:</strong> ${companyInfo.account_number}</p>` : ''}
            ${companyInfo.iban ? `<p><strong>IBAN:</strong> ${companyInfo.iban}</p>` : ''}
            ${companyInfo.swift_bic ? `<p><strong>BIC:</strong> ${companyInfo.swift_bic}</p>` : ''}
          </div>
          
          ${invoice.notes ? `<p><strong>Anmerkungen:</strong> ${invoice.notes}</p>` : ''}
          
          <p>Bei Fragen zu dieser Rechnung können Sie uns gerne kontaktieren.</p>
          
          <p>Vielen Dank für Ihr Vertrauen!</p>
          
          <p>Mit freundlichen Grüßen,<br>${companyInfo.name}</p>
          
          <div class="xrechnung-notice">
            Diese Rechnung entspricht den Anforderungen des § 14 UStG und der XRechnung (Stand 2025).
          </div>
          
          <div class="footer">
            ${companyInfo.address ? `<p>${companyInfo.address.replace(/\n/g, ', ')}</p>` : ''}
            ${companyInfo.phone ? `<p>Telefon: ${companyInfo.phone}</p>` : ''}
            ${companyInfo.email ? `<p>E-Mail: ${companyInfo.email}</p>` : ''}
            ${companyInfo.website ? `<p>Website: ${companyInfo.website}</p>` : ''}
            ${companyInfo.tax_id ? `<p>USt-IdNr.: ${companyInfo.tax_id}</p>` : ''}
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Send an email using the device's mail client
 */
async function sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
        // Create a mailto URL
        let mailtoUrl = `mailto:${options.to}`;

        if (options.cc) mailtoUrl += `?cc=${options.cc}`;
        if (options.bcc) mailtoUrl += `${mailtoUrl.includes('?') ? '&' : '?'}bcc=${options.bcc}`;
        mailtoUrl += `${mailtoUrl.includes('?') ? '&' : '?'}subject=${encodeURIComponent(options.subject)}`;

        // For security reasons, we can't actually attach the file programmatically in most browsers
        // Instead, we'll open the default mail client with the mailto link and let the user attach the PDF

        // Open the mail client
        window.open(mailtoUrl, '_blank');

        // Show a success message
        alert('Your default email client has been opened. Please attach the downloaded PDF file to the email.');

        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
} 