import { jsPDF } from 'jspdf';
import { Invoice, InvoiceItem, CompanyInfo } from '../../domain/models';
import { format } from 'date-fns';
import { generateInvoicePDF as generateModernInvoicePDF } from './pdfUtils';

/**
 * @deprecated This function is deprecated and will be removed in a future version.
 * Please use the generateInvoicePDF function from pdfUtils.ts instead, which supports
 * XRechnung 2025 standards and improved company logo handling.
 * 
 * Create a PDF from an invoice
 */
export const generateInvoicePDF = (invoice: Invoice): string => {
    console.warn(
        'Warning: Using deprecated PDF generator. Please update your code to use the generateInvoicePDF function from pdfUtils.ts instead.'
    );

    // Simple fallback for backwards compatibility
    try {
        // Try to create a mock CompanyInfo from invoice data
        const companyInfo: CompanyInfo = {
            name: invoice.issuer.name,
            address: `${invoice.issuer.address}\n${invoice.issuer.city}`,
            phone: '',
            email: '',
            website: '',
            tax_id: '',
            tax_number: '',
            registration_number: '',
            trade_register: '',
            electronic_address: '',
            bank_name: invoice.bank_details.name,
            account_name: '',
            account_number: '',
            iban: invoice.bank_details.iban,
            swift_bic: invoice.bank_details.bic,
            logo_url: '',
            is_vat_enabled: invoice.tax_rate ? invoice.tax_rate > 0 : true,
            default_tax_rate: invoice.tax_rate || 19,
            lastModified: new Date().toISOString()
        };

        // Use the modern implementation but convert result to data URL
        generateModernInvoicePDF(invoice, companyInfo)
            .then(blob => {
                // Convert Blob to data URL in a real implementation
                console.log('Modern PDF generated successfully');
            })
            .catch(err => {
                console.error('Error generating modern PDF:', err);
            });
    } catch (error) {
        console.error('Error while trying to use modern PDF generator:', error);
    }

    // Continue with legacy implementation as fallback
    const doc = new jsPDF();

    // Set initial position
    let y = 20;

    // Document title
    doc.setFontSize(20);
    doc.text(`Invoice #${invoice.invoice_number}`, 105, y, { align: 'center' });
    y += 15;

    // Issuer details
    doc.setFontSize(10);
    doc.text(`From: ${invoice.issuer.name}`, 20, y);
    y += 5;
    doc.text(`${invoice.issuer.address}`, 20, y);
    y += 5;
    doc.text(`${invoice.issuer.city}`, 20, y);
    y += 15;

    // Customer details
    doc.text(`To: ${invoice.customer.name}`, 20, y);
    y += 5;
    doc.text(`${invoice.customer.address}`, 20, y);
    y += 5;
    doc.text(`${invoice.customer.city}`, 20, y);
    y += 5;

    if (invoice.customer.number) {
        doc.text(`Customer Number: ${invoice.customer.number}`, 20, y);
        y += 5;
    }

    // Invoice details
    doc.text(`Invoice Date: ${format(new Date(invoice.invoice_date), 'MMMM d, yyyy')}`, 20, y);
    y += 15;

    // Invoice items table headers
    doc.setFontSize(12);
    doc.text('Item', 20, y);
    doc.text('Quantity', 100, y);
    doc.text('Price', 140, y);
    doc.text('Total', 180, y);
    y += 5;

    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    y += 10;

    // Invoice items
    doc.setFontSize(10);

    invoice.items.forEach((item: InvoiceItem) => {
        doc.text(item.name, 20, y);
        doc.text(item.quantity.toString(), 100, y);
        doc.text(`${item.price.toFixed(2)}`, 140, y);
        doc.text(`${(item.quantity * item.price).toFixed(2)}`, 180, y);
        y += 10;

        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    });

    // Total
    y += 5;
    doc.setDrawColor(200);
    doc.line(140, y, 190, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`Total: ${invoice.total.toFixed(2)}`, 190, y, { align: 'right' });
    y += 20;

    // Payment info
    doc.setFontSize(10);
    doc.text('Payment Information:', 20, y);
    y += 10;
    doc.text(`Bank: ${invoice.bank_details.name}`, 20, y);
    y += 5;
    doc.text(`IBAN: ${invoice.bank_details.iban}`, 20, y);
    y += 5;
    doc.text(`BIC: ${invoice.bank_details.bic}`, 20, y);
    y += 20;

    // Footer
    doc.text('Thank you for your business!', 105, y, { align: 'center' });

    // Add deprecation notice
    y += 20;
    doc.setFontSize(8);
    doc.setTextColor(255, 0, 0);
    doc.text('This invoice was generated using a deprecated PDF generator.', 105, y, { align: 'center' });
    doc.text('Future versions will include XRechnung 2025 compliance.', 105, y + 5, { align: 'center' });

    // Return the PDF as data URL
    return doc.output('dataurlstring');
}; 