'use client';

import { Invoice, CompanyInfo, InvoiceItem } from '../interfaces';
import { formatDate } from './formatters';

/**
 * Format a date specifically for XRechnung in ISO format (YYYY-MM-DD)
 */
function formatXRechnungDate(dateString: string): string {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';

        // Format as YYYY-MM-DD
        return date.toISOString().split('T')[0];
    } catch {
        return '';
    }
}

/**
 * Generate a JSON structure compliant with XRechnung (EN16931) standard
 * This formats our invoice data according to the XRechnung specification for German electronic invoicing
 */
export function generateXRechnungJSON(invoice: Invoice, companyInfo: CompanyInfo): object {
    // Format date according to ISO standard
    const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date) : new Date();
    const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date();

    // Calculate tax information
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const taxRate = invoice.tax_rate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Required fields check - for buyer reference (mandatory according to German law)
    const buyerReference = invoice.buyer_reference || invoice.invoice_number;

    // Determine if it's a reverse charge situation
    const isReverseCharge = companyInfo.is_vat_enabled && invoice.client_vat_id &&
        (invoice.tax_rate === 0) &&
        (invoice.tax_exemption_reason?.includes('Reverse-Charge') ||
            invoice.tax_exemption_reason?.includes('innergemeinschaftliche'));

    // Build tax exemption reason if needed
    let taxExemptionReason = invoice.tax_exemption_reason || '';
    if (taxRate === 0 && !taxExemptionReason) {
        if (!companyInfo.is_vat_enabled) {
            taxExemptionReason = 'Gemäß § 19 UStG keine Umsatzsteuer (Kleinunternehmerregelung)';
        } else if (isReverseCharge) {
            taxExemptionReason = 'Steuerschuldnerschaft des Leistungsempfängers (Reverse-Charge-Verfahren)';
        } else {
            taxExemptionReason = 'Steuerfreie Leistung';
        }
    }

    // Structure the invoice items with proper formatting
    const lineItems = invoice.items.map((item, index) => formatLineItem(item, index + 1, taxRate));

    // XRechnung compliant structure (based on EN16931 requirements)
    return {
        // Document level fields - BT = Business Term according to EN16931
        "invoice": {
            // BT-1: Invoice number (mandatory)
            "number": invoice.invoice_number,

            // BT-2: Invoice issue date (mandatory) - ISO format YYYY-MM-DD
            "issueDate": formatXRechnungDate(invoiceDate.toISOString()),

            // BT-3: Invoice type code (mandatory)
            "typeCode": "380", // 380 = Commercial invoice

            // BT-5: Invoice currency code (mandatory)
            "currencyCode": "EUR",

            // BT-9: Due date (mandatory for German XRechnung)
            "dueDate": formatXRechnungDate(dueDate.toISOString()),

            // BT-10: Buyer reference (mandatory for German XRechnung)
            "buyerReference": buyerReference,

            // Notes
            "note": invoice.notes || "",

            // BG-4: SELLER (mandatory group)
            "seller": {
                // BT-27: Seller name (mandatory)
                "name": companyInfo.is_freelancer && companyInfo.full_name
                    ? `${companyInfo.full_name}${companyInfo.name ? ` - ${companyInfo.name}` : ''}`
                    : companyInfo.name,

                // BT-31: Seller VAT identifier (mandatory if VAT registered)
                "vatIdentifier": companyInfo.is_vat_enabled ? companyInfo.tax_id : "",

                // BT-32: Seller tax registration identifier (fallback if no VAT)
                "taxRegistrationIdentifier": companyInfo.tax_number,

                // BT-33: Seller additional legal information (e.g. Handelsregister)
                "legalRegistrationIdentifier": companyInfo.trade_register || "",

                // BT-34: Electronic address (mandatory for XRechnung 2025)
                "electronicAddress": companyInfo.electronic_address || companyInfo.email,

                // BT-35..39: Seller address (mandatory group)
                "address": {
                    "line1": companyInfo.address.split('\n')[0] || "",
                    "line2": companyInfo.address.split('\n')[1] || "",
                    "city": companyInfo.address.split('\n')[2] || "",
                    "country": "DE" // ISO country code
                },

                // BT-41: Seller contact point 
                "contact": {
                    "name": companyInfo.is_freelancer && companyInfo.full_name
                        ? companyInfo.full_name
                        : companyInfo.name,
                    "telephone": companyInfo.phone,
                    "email": companyInfo.email
                }
            },

            // BG-7: BUYER (mandatory group)
            "buyer": {
                // BT-44: Buyer name (mandatory)
                "name": invoice.client_name || invoice.customer.name,

                // BT-48: Buyer VAT identifier (highly recommended)
                "vatIdentifier": invoice.client_vat_id || "",

                // BT-49: Buyer electronic address (recommended for XRechnung 2025)
                "electronicAddress": invoice.client_electronic_address || "",

                // BT-50..55: Buyer address (mandatory group)
                "address": {
                    "line1": (invoice.client_address || invoice.customer.address).split('\n')[0] || "",
                    "line2": (invoice.client_address || invoice.customer.address).split('\n')[1] || "",
                    "city": invoice.customer.city || "",
                    "country": "DE" // ISO country code
                },

                // BT-56: Buyer contact point
                "contact": {
                    "name": invoice.client_name || invoice.customer.name,
                    "telephone": invoice.client_phone || "",
                    "email": invoice.client_email || ""
                }
            },

            // BG-16: PAYMENT INSTRUCTIONS (mandatory for XRechnung)
            "paymentInstructions": {
                // BT-83: Remittance information
                "remittanceInformation": `Rechnung ${invoice.invoice_number}`,

                // BT-84: SEPA credit transfer (mandatory for XRechnung)
                "creditTransfer": {
                    // BT-85: Payment account name
                    "accountName": companyInfo.account_name,

                    // BT-84: Payment account identifier (IBAN) (mandatory)
                    "accountIdentifier": companyInfo.iban,

                    // BT-86: Payment service provider identifier (BIC)
                    "providerIdentifier": companyInfo.swift_bic
                }
            },

            // BG-20: DOCUMENT LEVEL ALLOWANCES (if applicable)
            "allowances": [],

            // BG-21: DOCUMENT LEVEL CHARGES (if applicable)
            "charges": [],

            // BG-22: DOCUMENT TOTALS (mandatory group)
            "documentTotals": {
                // BT-106: Sum of invoice line net amounts (mandatory)
                "lineExtensionAmount": subtotal,

                // BT-109: Invoice total amount without VAT (mandatory)
                "taxExclusiveAmount": subtotal,

                // BT-112: Invoice total amount with VAT (mandatory)
                "taxInclusiveAmount": total,

                // BT-115: Amount due for payment (mandatory)
                "payableAmount": total
            },

            // BG-23: VAT BREAKDOWN (mandatory group)
            "vatBreakdown": [
                {
                    // BT-116: VAT category taxable amount (mandatory)
                    "taxableAmount": subtotal,

                    // BT-117: VAT category tax amount (mandatory)
                    "taxAmount": taxAmount,

                    // BT-118: VAT category code (mandatory)
                    "categoryCode": taxRate > 0 ? "S" : (isReverseCharge ? "AE" : "Z"),

                    // BT-119: VAT category rate (mandatory if not exempt)
                    "categoryRate": taxRate,

                    // BT-120: VAT exemption reason text (mandatory if exempt)
                    "exemptionReason": taxRate === 0 ? taxExemptionReason : ""
                }
            ],

            // BG-25: INVOICE LINES (mandatory group)
            "invoiceLines": lineItems,

            // XRechnung specific extension
            "xRechnungExtension": {
                "profile": "urn:cen.eu:en16931:2017:compliant:xrechnung:3.0",
                "version": "2025",
                "leitweg-id": companyInfo.registration_number || "",
                "contractType": "ORDER",
                "europeanStandard": true
            }
        }
    };
}

/**
 * Format a line item according to XRechnung requirements
 */
function formatLineItem(item: InvoiceItem, lineNumber: number, taxRate: number): object {
    const lineNetAmount = item.quantity * item.price;

    return {
        // BT-126: Invoice line identifier (mandatory)
        "id": lineNumber.toString(),

        // BT-129: Invoiced quantity (mandatory)
        "quantity": item.quantity,

        // BT-130: Invoiced quantity unit of measure (mandatory)
        "unitCode": "EA", // Each (default if not specified)

        // BT-131: Invoice line net amount (mandatory)
        "lineExtensionAmount": lineNetAmount,

        // BG-31: ITEM INFORMATION (mandatory group)
        "item": {
            // BT-153: Item name (mandatory)
            "name": item.name || item.item_name || "",

            // BT-154: Item description
            "description": item.description || "",

            // BG-30: LINE VAT INFORMATION (mandatory group)
            "vat": {
                // BT-151: Invoice line VAT rate
                "rate": taxRate
            }
        },

        // BT-146: Item net price (mandatory)
        "price": {
            "priceAmount": item.price
        }
    };
} 