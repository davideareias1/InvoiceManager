import { Invoice, CompanyInfo } from '@/domain/models';

// ===== TYPES =====
export interface VatSimulationMetrics {
    rate: number; // in percent, e.g., 19
    taxableNetYTD: number; // Sum of net amounts we expect to be VAT-taxable
    reverseChargeNetYTD: number; // Net amounts with reverse charge (EU B2B outside DE)
    nonTaxableNetYTD: number; // Other non-taxable (explicitly exempt)
    scenarioNetInvariant: {
        vatDue: number; // You add VAT on top of current prices
        grossIncrease: number; // Customers pay this additional amount
    };
    scenarioGrossInvariant: {
        vatDue: number; // You keep gross price fixed; VAT carved out
        netAfterVat: number; // Net revenue if treating current totals as gross
        revenueDelta: number; // Difference vs current net (negative)
    };
}

// ===== INTERNAL HELPERS =====
function parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

function calculateInvoiceNet(invoice: Invoice): number {
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
}

function isReverseCharge(invoice: Invoice): boolean {
    const vatId = (invoice.client_vat_id || '').trim();
    if (!vatId) return false;
    // If VAT ID present and not German, assume reverse charge
    return !vatId.toUpperCase().startsWith('DE');
}

function isExplicitlyNonTaxable(invoice: Invoice): boolean {
    if (invoice.client_vat_exempt) return true;
    const reason = (invoice.tax_exemption_reason || '').toLowerCase();
    return reason.includes('§ 19') || reason.includes('kleinunternehmer') || reason.includes('reverse');
}

// ===== PUBLIC METRICS =====
export function computeVatSimulation(
    invoices: Invoice[],
    company: CompanyInfo,
    now: Date = new Date(),
    overriddenRatePercent?: number,
): VatSimulationMetrics {
    const year = now.getFullYear();
    const rate = overriddenRatePercent !== undefined
        ? overriddenRatePercent
        : (company.is_vat_enabled ? company.default_tax_rate : 19);

    let taxableNetYTD = 0;
    let reverseChargeNetYTD = 0;
    let nonTaxableNetYTD = 0;

    for (const inv of invoices) {
        if (inv.isDeleted) continue;
        const date = parseDate(inv.invoice_date);
        if (!date || date.getFullYear() !== year) continue;
        const net = typeof inv.total === 'number' ? inv.total : calculateInvoiceNet(inv);
        if (net <= 0) continue; // ignore negative/cancellation for VAT purposes

        if (isReverseCharge(inv)) {
            reverseChargeNetYTD += net;
            continue;
        }
        if (isExplicitlyNonTaxable(inv)) {
            nonTaxableNetYTD += net;
            continue;
        }
        taxableNetYTD += net;
    }

    const rateFactor = rate / 100;

    // Scenario A: keep net prices, add VAT on top
    const scenarioA_vat = taxableNetYTD * rateFactor;

    // Scenario B: keep gross prices (treat current totals as gross)
    const netAfterVat = taxableNetYTD / (1 + rateFactor);
    const scenarioB_vat = taxableNetYTD - netAfterVat;
    const revenueDelta = netAfterVat - taxableNetYTD; // negative number

    return {
        rate,
        taxableNetYTD,
        reverseChargeNetYTD,
        nonTaxableNetYTD,
        scenarioNetInvariant: {
            vatDue: scenarioA_vat,
            grossIncrease: scenarioA_vat,
        },
        scenarioGrossInvariant: {
            vatDue: scenarioB_vat,
            netAfterVat,
            revenueDelta,
        },
    };
}
