'use client';

import { jsPDF } from 'jspdf';
// Import jspdf-autotable
import autoTable from 'jspdf-autotable';
import { Invoice, InvoiceItem, CompanyInfo } from '../interfaces';
import { formatCurrency, formatDate, formatQuantity } from './formatters';

// Global settings for PDF generation
const PDF_MARGIN_LEFT = 15;
const PDF_MARGIN_RIGHT = 15;
const PDF_MARGIN_TOP = 15;
const PDF_MARGIN_BOTTOM = 15;

/**
 * Generate a PDF invoice from invoice data
 */
export async function generateInvoicePDF(
    invoice: Invoice,
    companyInfo: CompanyInfo
): Promise<Blob> {
    // Create PDF document
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Add company logo if available
    if (companyInfo.logo_url) {
        await addLogo(doc, companyInfo.logo_url);
    }

    // Add invoice title and information at the top of the page
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    // Check if this is a rectification invoice (negative total indicates cancellation)
    const isRectificationInvoice = invoice.total < 0;
    const invoiceTitle = isRectificationInvoice ? 'Stornorechnung' : 'Rechnung';
    doc.text(`${invoiceTitle} #${invoice.invoice_number}`, doc.internal.pageSize.width - PDF_MARGIN_RIGHT, PDF_MARGIN_TOP + 10, { align: 'right' });
    
    // Add invoice date and due date below the title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Datum: ${formatDate(invoice.invoice_date || '')}`, doc.internal.pageSize.width - PDF_MARGIN_RIGHT, PDF_MARGIN_TOP + 16, { align: 'right' });
    doc.text(`Fälligkeitsdatum: ${formatDate(invoice.due_date || '')}`, doc.internal.pageSize.width - PDF_MARGIN_RIGHT, PDF_MARGIN_TOP + 22, { align: 'right' });

    // Add company info section
    addCompanyInfo(doc, companyInfo);

    // Add billing info (with adjusted position)
    addBillingInfo(doc, invoice);

    // Add simple table of items
    addSimpleTable(doc, invoice.items);

    // Calculate vertical position for totals based on table content
    const totalItems = invoice.items.length;
    const tableEndY = 110 + (totalItems * 10);

    // Add totals and get the final y position
    const totalsEndY = addTotalsSimple(doc, invoice, companyInfo, tableEndY);

    // Add payment information with dynamic positioning
    addPaymentInfoSimple(doc, companyInfo, invoice, totalsEndY);

    // Add footer with company details
    addFooter(doc, companyInfo, invoice);

    // Return the PDF as a blob
    return doc.output('blob');
}

/**
 * Add a simple table without using autoTable
 */
function addSimpleTable(doc: jsPDF, items: InvoiceItem[]): void {
    const startY = 100;
    const columnWidths = {
        pos: 10,
        description: 85,
        quantity: 20,
        unitPrice: 35,
        totalPrice: 35
    };

    // Headers with proper German terms and spacing
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Pos.', PDF_MARGIN_LEFT, startY);
    doc.text('Artikelbezeichnung', PDF_MARGIN_LEFT + columnWidths.pos + 5, startY);
    doc.text('Menge', PDF_MARGIN_LEFT + columnWidths.pos + columnWidths.description + 5, startY, { align: 'right' });
    doc.text('Einzelpreis', PDF_MARGIN_LEFT + columnWidths.pos + columnWidths.description + columnWidths.quantity + 5, startY, { align: 'right' });
    doc.text('Gesamtpreis', doc.internal.pageSize.width - PDF_MARGIN_RIGHT, startY, { align: 'right' });

    // Draw a line under the headers - make it slightly thicker
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.line(
        PDF_MARGIN_LEFT,
        startY + 3,
        doc.internal.pageSize.width - PDF_MARGIN_RIGHT,
        startY + 3
    );

    // Items
    doc.setFont('helvetica', 'normal');
    let y = startY + 10;

    items.forEach((item, index) => {
        // Position number
        doc.text((index + 1).toString(), PDF_MARGIN_LEFT, y);

        const isCancellationNotice = item.name.startsWith('Stornierung der Rechnung') && item.price === 0;
        let lineHeight = 5; // Default line height for a single line item

        if (isCancellationNotice) {
            // Special handling for cancellation notice
            const descriptionX = PDF_MARGIN_LEFT + columnWidths.pos + 5;
            doc.setFont('helvetica', 'italic');
            doc.text(item.name, descriptionX, y);
            doc.setFont('helvetica', 'normal');
        } else {
            // Description with proper wrapping
            const descriptionX = PDF_MARGIN_LEFT + columnWidths.pos + 5;
            const wrappedText = doc.splitTextToSize(item.description || item.name, columnWidths.description);

            wrappedText.forEach((line: string, lineIndex: number) => {
                doc.text(line, descriptionX, y + (lineIndex * 5));
            });

            lineHeight = Math.max(wrappedText.length * 5, 5);

            // Right-aligned quantity, unit price, and total price
            const quantityX = PDF_MARGIN_LEFT + columnWidths.pos + columnWidths.description + columnWidths.quantity + 5;
            const unitPriceX = quantityX + columnWidths.quantity;
            const totalPriceX = doc.internal.pageSize.width - PDF_MARGIN_RIGHT;

            doc.text(formatQuantity(item.quantity), quantityX, y, { align: 'right' });
            doc.text(formatCurrency(item.price), unitPriceX, y, { align: 'right' });
            const itemTotal = item.quantity * item.price;
            doc.text(formatCurrency(itemTotal), totalPriceX, y, { align: 'right' });
        }

        // Add light gray separator line between items
        if (index < items.length - 1) {
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            doc.line(
                PDF_MARGIN_LEFT,
                y + lineHeight + 4, // Position line with more space
                doc.internal.pageSize.width - PDF_MARGIN_RIGHT,
                y + lineHeight + 4
            );
        }

        // Adjust y position for the next item with more spacing
        y += lineHeight + 8;
    });

    // Draw a final line at the bottom - make it slightly thicker
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    // Position the final line correctly based on whether there were items
    const finalLineY = items.length > 0 ? y - 4 : startY + 3;
    doc.line(
        PDF_MARGIN_LEFT,
        finalLineY,
        doc.internal.pageSize.width - PDF_MARGIN_RIGHT,
        finalLineY
    );
}

/**
 * Add totals section to PDF without using autoTable
 */
function addTotalsSimple(doc: jsPDF, invoice: Invoice, companyInfo: CompanyInfo, yPos: number): number {
    const rightColumnX = doc.internal.pageSize.width - PDF_MARGIN_RIGHT - 80;
    const amountsX = doc.internal.pageSize.width - PDF_MARGIN_RIGHT;

    // Calculate totals
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const taxRate = invoice.tax_rate !== undefined ? invoice.tax_rate : (companyInfo.is_vat_enabled ? companyInfo.default_tax_rate : 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    let y = yPos + 10;

    // Totals section with proper alignment and spacing
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);

    // Nettobetrag (Net amount)
    doc.setFont('helvetica', 'normal');
    doc.text('Nettobetrag:', rightColumnX, y);
    doc.text(formatCurrency(subtotal), amountsX, y, { align: 'right' });
    y += 5;

    // Tax information
    if (taxRate > 0) {
        doc.text(`Umsatzsteuer (${taxRate}%)`, rightColumnX, y);
        doc.text(formatCurrency(taxAmount), amountsX, y, { align: 'right' });
        y += 5;
    } else {
        // Tax exemption notice with proper formatting
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        if (!companyInfo.is_vat_enabled) {
            doc.text('Gemäß § 19 UStG keine Umsatzsteuer (Kleinunternehmerregelung)',
                    PDF_MARGIN_LEFT, y);
        } else if (invoice.client_vat_id && !invoice.client_vat_id.startsWith('DE')) {
            doc.text('Steuerschuldnerschaft des Leistungsempfängers (Reverse-Charge-Verfahren)',
                    PDF_MARGIN_LEFT, y);
        }
        y += 5;
    }

    // Draw separator line before total
    doc.line(rightColumnX, y, amountsX, y);
    y += 5;

    // Total amount with proper emphasis
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Gesamtbetrag:', rightColumnX, y);
    doc.text(formatCurrency(total), amountsX, y, { align: 'right' });

    // Currency information
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Währung: EUR', PDF_MARGIN_LEFT, y);

    return y; // Return the final y position
}

/**
 * Add payment info section to PDF with improved positioning
 */
function addPaymentInfoSimple(doc: jsPDF, companyInfo: CompanyInfo, invoice: Invoice, yPos: number): void {
    // Add some spacing after the totals section
    let y = yPos + 25;

    // Payment terms section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Zahlungsbedingungen:', PDF_MARGIN_LEFT, y);
    
    doc.setFont('helvetica', 'normal');
    y += 5;
    const paymentTermsText = 'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt ohne Abzug.';
    doc.text(paymentTermsText, PDF_MARGIN_LEFT, y);

    // Add spacing before payment information
    y += 15;

    // Payment information section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Zahlungsinformationen', PDF_MARGIN_LEFT, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 7;

    // Bank information with consistent spacing
    if (companyInfo.bank_name) {
        doc.text(`Bank: ${companyInfo.bank_name}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    if (companyInfo.account_name) {
        doc.text(`Kontoinhaber: ${companyInfo.is_freelancer && companyInfo.full_name ? companyInfo.full_name : companyInfo.account_name}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    if (companyInfo.iban) {
        doc.text(`IBAN: ${companyInfo.iban}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    if (companyInfo.swift_bic) {
        doc.text(`BIC: ${companyInfo.swift_bic}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    // Payment reference
    doc.text(`Verwendungszweck: Rechnung ${invoice.invoice_number}`, PDF_MARGIN_LEFT, y);
    y += 10;

    // Payment notice
    doc.setFont('helvetica', 'bold');
    doc.text('Hinweis:', PDF_MARGIN_LEFT, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Bitte geben Sie bei Zahlungen stets die Rechnungsnummer an.', PDF_MARGIN_LEFT + 20, y);
}

/**
 * Add company logo to PDF with improved handling
 */
async function addLogo(doc: jsPDF, logoUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                // Calculate aspect ratio to fit logo properly
                const maxWidth = 50; // Slightly larger logo
                const maxHeight = 25;
                let width = img.width;
                let height = img.height;

                // Maintain aspect ratio
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }

                // Convert image to data URL with PNG format to preserve transparency
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { alpha: true });

                if (!ctx) {
                    throw new Error('Could not create canvas context');
                }

                // Set transparent background
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');

                // Position logo at top-left corner instead of top-right
                const logoX = PDF_MARGIN_LEFT;

                doc.addImage(
                    dataUrl,
                    'PNG',
                    logoX,
                    PDF_MARGIN_TOP,
                    width,
                    height
                );
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = reject;
        img.src = logoUrl;
    });
}

/**
 * Add company information to PDF
 */
function addCompanyInfo(doc: jsPDF, companyInfo: CompanyInfo): void {
    // Adjust Y position to be below logo height (logo max height is 25mm + margin)
    const startY = PDF_MARGIN_TOP + 30; // This ensures the text starts below where logo would end

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);

    // Add freelancer's full name if applicable
    if (companyInfo.is_freelancer && companyInfo.full_name) {
        doc.text(companyInfo.full_name, PDF_MARGIN_LEFT, startY);

        // Only show company name on the next line if it exists
        if (companyInfo.name) {
            doc.setFont('helvetica', 'normal');
            doc.text(companyInfo.name, PDF_MARGIN_LEFT, startY + 5);
            doc.setFont('helvetica', 'bold'); // Reset font for consistency

            // Start the rest of the info 10mm down
            var y = startY + 10;
        } else {
            // If no company name, start 5mm down
            var y = startY + 5;
        }
    } else {
        // Standard company display
        doc.text(companyInfo.name, PDF_MARGIN_LEFT, startY);
        var y = startY + 5;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Add address (BT-35, BT-37, BT-38 Seller address)
    if (companyInfo.address) {
        const addressLines = companyInfo.address.split('\n');
        for (const line of addressLines) {
            doc.text(line, PDF_MARGIN_LEFT, y);
            y += 5;
        }
    }

    // Add contact info (BG-9 Seller contact)
    if (companyInfo.phone) {
        doc.text(`Telefon: ${companyInfo.phone}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    if (companyInfo.email) {
        doc.text(`E-Mail: ${companyInfo.email}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    if (companyInfo.website) {
        doc.text(`Website: ${companyInfo.website}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    // Tax ID information (BT-31, BT-32, BT-33)
    if (companyInfo.tax_id) {
        doc.text(`USt-IdNr.: ${companyInfo.tax_id}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    // Add tax number (Steuernummer)
    if (companyInfo.tax_number) {
        doc.text(`Steuernummer: ${companyInfo.tax_number}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    // Add registration information (BT-30)
    if (companyInfo.trade_register) {
        doc.text(`Handelsregister: ${companyInfo.trade_register}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    // Add electronic address (BT-34)
    if (companyInfo.electronic_address) {
        doc.text(`E-Rechnungsadresse: ${companyInfo.electronic_address}`, PDF_MARGIN_LEFT, y);
    }
}

/**
 * Add billing information to PDF
 */
function addBillingInfo(doc: jsPDF, invoice: Invoice): void {
    const rightColumnX = doc.internal.pageSize.width - PDF_MARGIN_RIGHT - 80;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Rechnungsempfänger:', rightColumnX, PDF_MARGIN_TOP + 35);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let y = PDF_MARGIN_TOP + 40;

    // Add client name - use customer.name as fallback (BT-44 Buyer name, mandatory)
    const clientName = invoice.client_name || invoice.customer?.name || '';
    doc.text(clientName, rightColumnX, y);
    y += 5;

    // Add client address - use customer address as fallback (BG-8 Buyer address)
    const clientAddress = invoice.client_address || (invoice.customer ? `${invoice.customer.address || ''}\n${invoice.customer.city || ''}` : '');
    if (clientAddress) {
        const addressLines = clientAddress.split('\n');
        for (const line of addressLines) {
            doc.text(line || '', rightColumnX, y);
            y += 5;
        }
    }

    // Add client VAT ID (BT-48 Buyer VAT identifier, highly recommended)
    if (invoice.client_vat_id) {
        doc.text(`USt-IdNr.: ${invoice.client_vat_id}`, rightColumnX, y);
        y += 5;
    }

    // Add client contact info (BG-9 Buyer contact)
    if (invoice.client_email) {
        doc.text(`E-Mail: ${invoice.client_email}`, rightColumnX, y);
        y += 5;
    }

    if (invoice.client_phone) {
        doc.text(`Telefon: ${invoice.client_phone}`, rightColumnX, y);
        y += 5;
    }

    // Add electronic address (BT-49)
    if (invoice.client_electronic_address) {
        doc.text(`E-Rechnungsadresse: ${invoice.client_electronic_address}`, rightColumnX, y);
    }
}

/**
 * Add footer to PDF with enhanced information for XRechnung compliance
 */
function addFooter(doc: jsPDF, companyInfo: CompanyInfo, invoice: Invoice): void {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Draw light gray line above footer
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(PDF_MARGIN_LEFT, pageHeight - 30, pageWidth - PDF_MARGIN_RIGHT, pageHeight - 30);
    
    // Footer text starts here
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    let footerText = '';
    
    // Company name
    footerText += companyInfo.name + ' • ';
    
    // Address (simplified to one line)
    const addressParts = companyInfo.address.split('\n');
    footerText += addressParts.join(', ') + ' • ';
    
    // Tax ID - ensure tax information is included (required by German law)
    if (companyInfo.tax_id && companyInfo.is_vat_enabled) {
        footerText += `USt-IdNr: ${companyInfo.tax_id} • `;
    } else if (companyInfo.tax_number) {
        footerText += `Steuernummer: ${companyInfo.tax_number} • `;
    }
    
    // Cut footer text if too long
    if (doc.getTextWidth(footerText) > (pageWidth - (PDF_MARGIN_LEFT + PDF_MARGIN_RIGHT))) {
        // Truncate and add ellipsis if too long
        footerText = footerText.substring(0, 100) + '...';
    }
    
    // Position footer text centrally
    doc.text(footerText, pageWidth / 2, pageHeight - 20, { align: 'center' });
    
    // Add bank information line
    let bankInfo = '';
    if (companyInfo.account_name) bankInfo += `Kontoinhaber: ${companyInfo.account_name} • `;
    if (companyInfo.iban) bankInfo += `IBAN: ${companyInfo.iban} • `;
    if (companyInfo.swift_bic) bankInfo += `BIC: ${companyInfo.swift_bic}`;
    
    // Position bank info centrally
    doc.text(bankInfo, pageWidth / 2, pageHeight - 15, { align: 'center' });
    
    // Add legal notice about VAT status - required for German law compliance
    let legalNotice = '';
    if (!companyInfo.is_vat_enabled) {
        legalNotice = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.';
    } else if (invoice.tax_rate === 0 && invoice.client_vat_id && 
              (invoice.client_vat_id.startsWith('DE') === false)) {
        legalNotice = 'Steuerschuldnerschaft des Leistungsempfängers nach §13b UStG.';
    } else {
        legalNotice = 'Rechnungsstellung gemäß § 14 UStG.';
    }
    
    // Position legal notice centrally
    doc.text(legalNotice, pageWidth / 2, pageHeight - 10, { align: 'center' });
} 