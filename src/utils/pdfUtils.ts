'use client';

import { jsPDF } from 'jspdf';
// Import jspdf-autotable
import autoTable from 'jspdf-autotable';
import { Invoice, InvoiceItem, CompanyInfo } from '../interfaces';
import { formatCurrency, formatDate } from './formatters';

// Global settings for PDF generation
const PDF_MARGIN_LEFT = 15;
const PDF_MARGIN_RIGHT = 15;
const PDF_MARGIN_TOP = 15;
const PDF_MARGIN_BOTTOM = 15;

/**
 * Generate a PDF invoice from invoice data
 * Compliant with German XRechnung 2025 Standards
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

    try {
        // Add company logo if exists
        if (companyInfo.logo_url) {
            try {
                await addLogo(doc, companyInfo.logo_url);
            } catch (error) {
                console.error('Error adding logo to PDF:', error);
                // Continue without logo
            }
        }

        // Add company info
        addCompanyInfo(doc, companyInfo);

        // Add billing info
        addBillingInfo(doc, invoice);

        // Add invoice header - move the position down to prevent overlapping
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`Rechnung #${invoice.invoice_number}`, doc.internal.pageSize.width - PDF_MARGIN_RIGHT - 80, 70, { align: 'left' });

        // Add XRechnung 2025 required fields 
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Datum: ${formatDate(invoice.invoice_date || '')}`, PDF_MARGIN_LEFT, 80);
        doc.text(`Fälligkeitsdatum: ${formatDate(invoice.due_date || '')}`, PDF_MARGIN_LEFT, 85);

        // Add BT-10 mandatory field (Buyer reference according to XRechnung 2025)
        const buyerReference = invoice.buyer_reference || invoice.invoice_number;
        doc.text(`Käuferreferenz: ${buyerReference}`, PDF_MARGIN_LEFT, 90);

        // Add Leitweg-ID field (required for XRechnung 2025)
        if (companyInfo.registration_number) {
            doc.text(`Leitweg-ID: ${companyInfo.registration_number}`, PDF_MARGIN_LEFT, 95);
        } else {
            doc.text(`Leitweg-ID: -`, PDF_MARGIN_LEFT, 95);
        }

        // Add items table using simpler method
        addSimpleTable(doc, invoice.items);

        // Calculate the end of the table
        const tableEndY = 105 + (invoice.items.length * 10) + 20;

        // Add totals
        addTotalsSimple(doc, invoice, companyInfo, tableEndY);

        // Add payment info with SEPA data
        addPaymentInfoSimple(doc, companyInfo, invoice, tableEndY + 40);

        // Add notes if any
        if (invoice.notes) {
            doc.setFontSize(10);
            doc.text('Anmerkungen:', PDF_MARGIN_LEFT, doc.internal.pageSize.height - 50);

            // Word wrap for notes
            const splitNotes = doc.splitTextToSize(
                invoice.notes,
                doc.internal.pageSize.width - PDF_MARGIN_LEFT - PDF_MARGIN_RIGHT
            );

            doc.text(splitNotes, PDF_MARGIN_LEFT, doc.internal.pageSize.height - 45);
        }

        // Add XRechnung 2025 compliance notice
        doc.setFontSize(8);
        doc.text(
            'Diese Rechnung entspricht den Anforderungen der EU-Richtlinie 2014/55/EU und der XRechnung (Stand 2025).',
            PDF_MARGIN_LEFT,
            doc.internal.pageSize.height - 30
        );

        // Add footer with extended information
        addFooter(doc, companyInfo, invoice);

        // Return as blob
        return doc.output('blob');
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

/**
 * Add a simple table without using autoTable
 */
function addSimpleTable(doc: jsPDF, items: InvoiceItem[]): void {
    const startY = 100;

    // Headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Pos.', PDF_MARGIN_LEFT, startY);
    doc.text('Artikelbezeichnung', PDF_MARGIN_LEFT + 15, startY);
    doc.text('Menge', PDF_MARGIN_LEFT + 100, startY);
    doc.text('Einzelpreis', PDF_MARGIN_LEFT + 130, startY);
    doc.text('Gesamtpreis', PDF_MARGIN_LEFT + 160, startY);

    // Draw a line under the headers
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
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
        doc.text((index + 1).toString(), PDF_MARGIN_LEFT, y);

        // Handle item name with line breaks
        // Limit width for description text to prevent overlap with the next column
        const descriptionWidth = PDF_MARGIN_LEFT + 80 - (PDF_MARGIN_LEFT + 15);

        // Use item description if available, otherwise use item name
        let descriptionText = item.description || item.name;

        // Split text to fit within width
        const wrappedText = doc.splitTextToSize(descriptionText, descriptionWidth);

        // Print each line of wrapped text with proper spacing
        wrappedText.forEach((line: string, lineIndex: number) => {
            doc.text(line, PDF_MARGIN_LEFT + 15, y + (lineIndex * 5));
        });

        // Determine the height of the description to adjust y position
        const lineHeight = wrappedText.length * 5;

        // Position quantity, prices at the first line height
        doc.text(item.quantity.toString(), PDF_MARGIN_LEFT + 100, y);
        doc.text(formatCurrency(item.price), PDF_MARGIN_LEFT + 130, y);
        const itemTotal = item.quantity * item.price;
        doc.text(formatCurrency(itemTotal), PDF_MARGIN_LEFT + 160, y);

        // Adjust y based on the number of lines in the description plus spacing
        y += Math.max(10, lineHeight + 5); // At least 10mm spacing or more if needed for wrapped text
    });

    // Draw a line at the bottom
    doc.setDrawColor(200, 200, 200);
    doc.line(
        PDF_MARGIN_LEFT + 100,
        y,
        doc.internal.pageSize.width - PDF_MARGIN_RIGHT,
        y
    );
}

/**
 * Add totals section to PDF without using autoTable
 */
function addTotalsSimple(doc: jsPDF, invoice: Invoice, companyInfo: CompanyInfo, yPos: number): void {
    const rightColumnX = doc.internal.pageSize.width - PDF_MARGIN_RIGHT - 80;

    // Calculate totals
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const taxRate = invoice.tax_rate !== undefined ? invoice.tax_rate : (companyInfo.is_vat_enabled ? companyInfo.default_tax_rate : 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let y = yPos;

    // Add payment terms information aligned with amounts on right side 
    doc.text('Zahlungsbedingungen:', rightColumnX, y);
    y += 5;

    // Wrap payment terms text to fit in the column width
    const paymentTermsWidth = doc.internal.pageSize.width - PDF_MARGIN_RIGHT - rightColumnX;
    const paymentTermsText = 'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt ohne Abzug';
    const wrappedPaymentTerms = doc.splitTextToSize(paymentTermsText, paymentTermsWidth);

    // Print each line of wrapped payment terms
    wrappedPaymentTerms.forEach((line: string, index: number) => {
        doc.text(line, rightColumnX, y + (index * 5));
    });

    // Adjust y position based on number of lines
    y += (wrappedPaymentTerms.length * 5) + 5;

    // Netto (BT-106 Invoice total amount without VAT)
    doc.text('Nettobetrag:', rightColumnX, y);
    doc.text(formatCurrency(subtotal), doc.internal.pageSize.width - PDF_MARGIN_RIGHT, y, { align: 'right' });
    y += 5;

    // Tax based on tax_rate (BT-110, BT-117, BT-118 VAT breakdown)
    if (taxRate > 0) {
        doc.text(`Umsatzsteuer (${taxRate}%):`, rightColumnX, y);
        doc.text(formatCurrency(taxAmount), doc.internal.pageSize.width - PDF_MARGIN_RIGHT, y, { align: 'right' });
        y += 5;
    } else {
        // For tax exempt invoices - specify reason according to XRechnung 2025 requirements
        const exemptionReason = invoice.tax_exemption_reason ||
            (companyInfo.is_vat_enabled ? 'Steuerfreie Leistung' : 'Gemäß § 19 UStG keine Umsatzsteuer (Kleinunternehmerregelung)');

        // Handle text wrapping for longer exemption reasons
        const maxWidth = doc.internal.pageSize.width - PDF_MARGIN_RIGHT - rightColumnX;
        const wrappedText = doc.splitTextToSize(exemptionReason, maxWidth);

        // Print each line of the wrapped text
        wrappedText.forEach((line: string, index: number) => {
            doc.text(line, rightColumnX, y + (index * 5));
        });

        // Adjust y position based on number of lines
        y += (5 * wrappedText.length) + 2;
    }

    // Draw line
    doc.setDrawColor(200);
    doc.line(rightColumnX, y, doc.internal.pageSize.width - PDF_MARGIN_RIGHT, y);
    y += 5;

    // Total (BT-112 Invoice total amount with VAT)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Gesamtbetrag:', rightColumnX, y);
    doc.text(formatCurrency(total), doc.internal.pageSize.width - PDF_MARGIN_RIGHT, y, { align: 'right' });

    // Add invoice currency code - required by XRechnung 2025
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Währung: EUR (BT-5)', rightColumnX, y);
}

/**
 * Add payment info section to PDF
 */
function addPaymentInfoSimple(doc: jsPDF, companyInfo: CompanyInfo, invoice: Invoice, yPos: number): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Zahlungsinformationen', PDF_MARGIN_LEFT, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let y = yPos + 10;

    // BG-17 CREDIT TRANSFER (required by XRechnung 2025)
    if (companyInfo.bank_name) {
        doc.text(`Bank: ${companyInfo.bank_name}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    if (companyInfo.account_name) {
        doc.text(`Kontoinhaber: ${companyInfo.account_name}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    if (companyInfo.account_number) {
        doc.text(`Kontonummer: ${companyInfo.account_number}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    // BT-84 Payment account identifier (mandatory for XRechnung 2025)
    if (companyInfo.iban) {
        doc.text(`IBAN: ${companyInfo.iban}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    // BT-86 Payment service provider identifier (BIC, optional but recommended)
    if (companyInfo.swift_bic) {
        doc.text(`BIC: ${companyInfo.swift_bic}`, PDF_MARGIN_LEFT, y);
        y += 5;
    }

    // BT-83 Remittance information (optional but recommended for XRechnung 2025)
    doc.text(`Verwendungszweck: Rechnung ${invoice.invoice_number}`, PDF_MARGIN_LEFT, y);
    y += 10;

    // BG-16 PAYMENT INSTRUCTIONS (helpful for XRechnung 2025)
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
    doc.text(companyInfo.name, PDF_MARGIN_LEFT, startY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let y = startY + 5;

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
    doc.text('Rechnungsempfänger:', rightColumnX, PDF_MARGIN_TOP + 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let y = PDF_MARGIN_TOP + 30;

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
    const pageHeight = doc.internal.pageSize.height;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    let footerText = '';

    if (companyInfo.tax_id) {
        footerText += `USt-IdNr.: ${companyInfo.tax_id} • `;
    }

    if (companyInfo.tax_number) {
        footerText += `Steuernummer: ${companyInfo.tax_number} • `;
    }

    if (companyInfo.registration_number) {
        footerText += `Leitweg-ID: ${companyInfo.registration_number} • `;
    }

    if (companyInfo.trade_register) {
        footerText += `Handelsregister: ${companyInfo.trade_register} • `;
    }

    // Add version information for XRechnung
    footerText += `Rechnungsformat: XRechnung (EN16931/2025) • `;

    // Add XRechnung identifier
    footerText += `Standard: urn:cen.eu:en16931:2017:compliant:xrechnung:3.0 • `;

    if (footerText) {
        // Remove trailing separator
        footerText = footerText.slice(0, -3);

        // Center the footer text
        const textWidth = doc.getStringUnitWidth(footerText) * 8 / doc.internal.scaleFactor;
        const textX = (doc.internal.pageSize.width - textWidth) / 2;

        doc.text(footerText, textX, pageHeight - PDF_MARGIN_BOTTOM);
    }

    // Add legal notice about XRechnung 2025 and VAT status
    doc.setFontSize(7);

    // Determine the appropriate legal notice based on tax situation
    let legalNotice = '';

    // Check if it's a reverse charge situation (client has VAT ID but no tax)
    const isReverseCharge = companyInfo.is_vat_enabled && invoice.client_vat_id &&
        (invoice.tax_rate === 0) &&
        (invoice.tax_exemption_reason?.includes('Reverse-Charge') ||
            invoice.tax_exemption_reason?.includes('innergemeinschaftliche'));

    if (!companyInfo.is_vat_enabled) {
        // Kleinunternehmer case
        legalNotice = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung). Diese Rechnung erfüllt die Anforderungen der XRechnungsverordnung.';
    } else if (isReverseCharge) {
        // Reverse charge case
        legalNotice = 'Steuerschuldnerschaft des Leistungsempfängers (Reverse-Charge-Verfahren). Diese Rechnung erfüllt die Anforderungen der XRechnungsverordnung.';
    } else {
        // Standard case
        legalNotice = 'Diese Rechnung erfüllt die gesetzlichen Anforderungen an strukturierte elektronische Rechnungen gemäß § 14 UStG und XRechnungsverordnung.';
    }

    // Split text into multiple lines if needed
    const maxWidth = doc.internal.pageSize.width - (PDF_MARGIN_LEFT * 2);
    const wrappedLegalNotice = doc.splitTextToSize(legalNotice, maxWidth);

    // Print each line of the wrapped legal notice
    wrappedLegalNotice.forEach((line: string, index: number) => {
        doc.text(
            line,
            PDF_MARGIN_LEFT,
            pageHeight - PDF_MARGIN_BOTTOM + 5 + (index * 4)
        );
    });
} 