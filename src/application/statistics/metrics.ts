import { Invoice, CompanyInfo, PersonalTaxSettings } from '@/domain/models';

// ===== TYPES =====
export interface MonthlyTotalItem {
    month: string; // YYYY-MM
    total: number;
}

export interface ClientTotalItem {
    client: string;
    total: number;
}

export interface BasicMetrics {
    totalAllTime: number;
    totalYTD: number;
    totalMTD: number;
    unpaidTotal: number;
    outstandingCount: number;
    paidTotalYTD: number;
    numInvoicesYTD: number;
    averageInvoiceYTD: number;
    monthlyTotalsCurrentYear: MonthlyTotalItem[];
    perClientTotalsYTD: ClientTotalItem[];
    topClientsYTD: Array<ClientTotalItem & { share: number }>; // share of YTD total
    topClientShareYTD: number;
}

export interface RevenueMetrics {
    averageMonthly: number;
    projectedAnnual: number;
    totalYTD: number;
}

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

export interface KleinunternehmerMonitor {
    previousYearTotal: number;
    currentYearTotalYTD: number;
    kleinunternehmerPreviousYearExceeded: boolean; // > 22,000 EUR last year
    kleinunternehmerCurrentYearProjection: number; // projection for this year
    kleinunternehmerCurrentYearProjectionExceeded: boolean; // > 50,000 EUR projected
    currentYearThresholdRemaining: number; // 50,000 - YTD (can be negative)
    estimatedThresholdCrossingDate?: string; // ISO date if crossing projected
}

export interface IncomeTaxEstimate {
    taxableBaseYTD: number; // projected annual taxable income (was YTD, now represents full year projection)
    incomeTax: number; // projected annual income tax
    churchTax: number; // projected annual church tax
    solidaritySurcharge: number; // projected annual solidarity surcharge
    prepaymentsYearToDate: number; // actual prepayments made YTD
    totalDueYTD: number; // projected annual taxes - actual prepayments YTD
    // Current vs projected breakdown
    incomeTaxCurrent: number; // income tax on current YTD revenue
    incomeTaxProjected: number; // additional income tax on projected remaining revenue
    churchTaxCurrent: number; // church tax on current YTD revenue
    churchTaxProjected: number; // additional church tax on projected remaining revenue
    solidaritySurchargeCurrent: number; // solidarity surcharge on current YTD revenue
    solidaritySurchargeProjected: number; // additional solidarity surcharge on projected remaining revenue
}

// ===== INTERNAL HELPERS =====
function parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

function formatMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function startOfMonth(date: Date): Date {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfMonth(date: Date): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d;
}

function dayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
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

function getClientName(invoice: Invoice): string {
    return invoice.customer?.name || invoice.client_name || 'Unknown';
}

// ===== PUBLIC METRICS =====
export function computeBasicMetrics(invoices: Invoice[], now: Date = new Date()): BasicMetrics {
    const active = invoices.filter(inv => !inv.isDeleted);

    const year = now.getFullYear();
    const thisMonthStart = startOfMonth(now).getTime();
    const thisMonthEnd = endOfMonth(now).getTime();

    let totalAllTime = 0;
    let totalYTD = 0;
    let totalMTD = 0;
    let unpaidTotal = 0;
    let outstandingCount = 0;
    let paidTotalYTD = 0;
    let numInvoicesYTD = 0;

    const monthlyTotalsMap: Record<string, number> = {};
    const perClientMapYTD: Record<string, number> = {};

    for (const inv of active) {
        const date = parseDate(inv.invoice_date);
        if (!date) continue;
        const net = typeof inv.total === 'number' ? inv.total : calculateInvoiceNet(inv);

        totalAllTime += net;

        if (date.getFullYear() === year) {
            totalYTD += net;
            numInvoicesYTD += 1;
            if (inv.is_paid) paidTotalYTD += net;

            // Monthly aggregation (current year)
            const monthKey = formatMonth(date);
            monthlyTotalsMap[monthKey] = (monthlyTotalsMap[monthKey] || 0) + net;

            // Per-client (current year)
            const client = getClientName(inv);
            perClientMapYTD[client] = (perClientMapYTD[client] || 0) + net;
        }

        const ts = date.getTime();
        if (ts >= thisMonthStart && ts <= thisMonthEnd) {
            totalMTD += net;
        }

        // Outstanding receivables (only positive amounts)
        if (!inv.is_paid && net > 0) {
            unpaidTotal += net;
            outstandingCount += 1;
        }
    }

    const monthlyTotalsCurrentYear: MonthlyTotalItem[] = Object.entries(monthlyTotalsMap)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([month, total]) => ({ month, total }));

    const perClientTotalsYTD: ClientTotalItem[] = Object.entries(perClientMapYTD)
        .map(([client, total]) => ({ client, total }))
        .sort((a, b) => b.total - a.total);

    const topClientsYTD = perClientTotalsYTD.slice(0, 5).map(item => ({
        ...item,
        share: totalYTD > 0 ? item.total / totalYTD : 0,
    }));

    const topClientShareYTD = topClientsYTD.length > 0 ? topClientsYTD[0].share : 0;
    const averageInvoiceYTD = numInvoicesYTD > 0 ? totalYTD / numInvoicesYTD : 0;

    return {
        totalAllTime,
        totalYTD,
        totalMTD,
        unpaidTotal,
        outstandingCount,
        paidTotalYTD,
        numInvoicesYTD,
        averageInvoiceYTD,
        monthlyTotalsCurrentYear,
        perClientTotalsYTD,
        topClientsYTD,
        topClientShareYTD,
    };
}

export function computeRevenueMetrics(
    invoices: Invoice[],
    now: Date = new Date()
): RevenueMetrics {
    const year = now.getFullYear();

    const invoicesForYear = invoices.filter(inv => {
        if (inv.isDeleted) return false;
        const date = parseDate(inv.invoice_date);
        return date && date.getFullYear() === year;
    });

    if (invoicesForYear.length === 0) {
        return { averageMonthly: 0, projectedAnnual: 0, totalYTD: 0 };
    }

    const totalYTD = invoicesForYear.reduce((sum, inv) => {
        const net = typeof inv.total === 'number' ? inv.total : calculateInvoiceNet(inv);
        return sum + net;
    }, 0);

    const dates = invoicesForYear.map(inv => parseDate(inv.invoice_date)).filter(d => d !== null) as Date[];
    const firstDate = new Date(Math.min(...dates.map(d => d.getTime())));
    
    const firstInvoiceMonthInYear = firstDate.getMonth(); // 0-11
    const currentMonth = now.getMonth(); // 0-11

    const monthsElapsed = Math.max(1, currentMonth - firstInvoiceMonthInYear + 1);
    const averageMonthly = totalYTD / monthsElapsed;
    
    const dayOfYearNow = dayOfYear(now);
    const projectedAnnual = dayOfYearNow > 0 ? (totalYTD / dayOfYearNow) * 365 : 0;

    return { averageMonthly, projectedAnnual, totalYTD };
}

/**
 * Return a descending list of invoice years present in the dataset.
 */
export function extractInvoiceYears(invoices: Invoice[]): number[] {
    const years = new Set<number>();
    for (const inv of invoices) {
        if (inv.isDeleted) continue;
        const date = parseDate(inv.invoice_date);
        if (!date) continue;
        years.add(date.getFullYear());
    }
    // Ensure current year is present even if no invoices yet, for selection convenience
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
}

/**
 * Monthly totals for an arbitrary year.
 */
export function computeMonthlyTotalsForYear(
    invoices: Invoice[],
    year: number,
): MonthlyTotalItem[] {
    const monthlyTotalsMap: Record<string, number> = {};
    for (const inv of invoices) {
        if (inv.isDeleted) continue;
        const date = parseDate(inv.invoice_date);
        if (!date || date.getFullYear() !== year) continue;
        const net = typeof inv.total === 'number' ? inv.total : calculateInvoiceNet(inv);
        const monthKey = formatMonth(date);
        monthlyTotalsMap[monthKey] = (monthlyTotalsMap[monthKey] || 0) + net;
    }
    return Object.entries(monthlyTotalsMap)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([month, total]) => ({ month, total }));
}

/**
 * Revenue metrics for an arbitrary year. For non-current years, projection equals total and
 * averageMonthly is computed over 12 months.
 */
export function computeRevenueMetricsForYear(
    invoices: Invoice[],
    year: number,
    now: Date = new Date(),
): RevenueMetrics {
    const currentYear = now.getFullYear();
    const invoicesForYear = invoices.filter(inv => {
        if (inv.isDeleted) return false;
        const date = parseDate(inv.invoice_date);
        return date && date.getFullYear() === year;
    });

    if (invoicesForYear.length === 0) {
        return { averageMonthly: 0, projectedAnnual: 0, totalYTD: 0 };
    }

    const totalYTD = invoicesForYear.reduce((sum, inv) => {
        const net = typeof inv.total === 'number' ? inv.total : calculateInvoiceNet(inv);
        return sum + net;
    }, 0);

    if (year !== currentYear) {
        // Past or future year: no projection beyond the actual total; average over full year
        return {
            averageMonthly: totalYTD / 12,
            projectedAnnual: totalYTD,
            totalYTD,
        };
    }

    // Current year: use elapsed months and day-of-year projection
    const dates = invoicesForYear.map(inv => parseDate(inv.invoice_date)).filter(d => d !== null) as Date[];
    const firstDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const firstInvoiceMonthInYear = firstDate.getMonth();
    const currentMonth = now.getMonth();
    const monthsElapsed = Math.max(1, currentMonth - firstInvoiceMonthInYear + 1);
    const averageMonthly = totalYTD / monthsElapsed;
    const dayOfYearNow = dayOfYear(now);
    const projectedAnnual = dayOfYearNow > 0 ? (totalYTD / dayOfYearNow) * 365 : 0;

    return { averageMonthly, projectedAnnual, totalYTD };
}

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

export function computeKleinunternehmerMonitor(
    invoices: Invoice[],
    now: Date = new Date(),
): KleinunternehmerMonitor {
    const year = now.getFullYear();
    const prevYear = year - 1;

    let previousYearTotal = 0;
    let currentYearTotalYTD = 0;

    for (const inv of invoices) {
        if (inv.isDeleted) continue;
        const date = parseDate(inv.invoice_date);
        if (!date) continue;
        const net = typeof inv.total === 'number' ? inv.total : calculateInvoiceNet(inv);
        if (date.getFullYear() === prevYear) previousYearTotal += net;
        if (date.getFullYear() === year) currentYearTotalYTD += net;
    }

    const prevExceeded = previousYearTotal > 22000;

    // Simple projection based on YTD run-rate
    const doy = Math.max(1, dayOfYear(now));
    const projectedCurrentYear = (currentYearTotalYTD / doy) * 365;

    const projectionExceeded = projectedCurrentYear > 50000;
    const remainingTo50k = 50000 - currentYearTotalYTD;

    let estimatedDate: string | undefined = undefined;
    if (currentYearTotalYTD > 0) {
        const avgPerDay = currentYearTotalYTD / doy;
        if (avgPerDay > 0 && remainingTo50k > 0) {
            const daysNeeded = Math.ceil(remainingTo50k / avgPerDay);
            const target = new Date(now);
            target.setDate(target.getDate() + daysNeeded);
            estimatedDate = target.toISOString().split('T')[0];
        }
    }

    return {
        previousYearTotal,
        currentYearTotalYTD,
        kleinunternehmerPreviousYearExceeded: prevExceeded,
        kleinunternehmerCurrentYearProjection: projectedCurrentYear,
        kleinunternehmerCurrentYearProjectionExceeded: projectionExceeded,
        currentYearThresholdRemaining: remainingTo50k,
        estimatedThresholdCrossingDate: estimatedDate,
    };
}

export function estimateIncomeTaxes(
    invoices: Invoice[],
    tax: PersonalTaxSettings,
    now: Date = new Date(),
): IncomeTaxEstimate {
    const year = now.getFullYear();
    let revenueYTD = 0;
    for (const inv of invoices) {
        if (inv.isDeleted) continue;
        const date = parseDate(inv.invoice_date);
        if (!date || date.getFullYear() !== year) continue;
        const net = typeof inv.total === 'number' ? inv.total : calculateInvoiceNet(inv);
        revenueYTD += Math.max(0, net); // ignore negative rectifications for taxes payable
    }

    const doy = Math.max(1, dayOfYear(now));
    const projectedAnnualRevenue = (revenueYTD / doy) * 365;

    const annualDeductible = Math.max(0, tax.annualDeductibleExpenses || 0);
    const taxableAnnual = Math.max(0, projectedAnnualRevenue - annualDeductible);
    const taxableYTD = Math.max(0, revenueYTD - (annualDeductible * (doy / 365)));

    // Compute taxes for current YTD and projected annual
    const incomeTaxAnnual = germanIncomeTax2025(taxableAnnual, !!tax.jointAssessment);
    const incomeTaxCurrentOnly = germanIncomeTax2025(taxableYTD, !!tax.jointAssessment);
    const incomeTaxProjectedOnly = Math.max(0, incomeTaxAnnual - incomeTaxCurrentOnly);

    // Calculate church and solidarity taxes for current and projected
    const churchRate = Math.max(0, tax.churchTaxRatePercent || 0) / 100;
    const churchTaxCurrent = incomeTaxCurrentOnly * churchRate;
    const churchTaxProjected = incomeTaxProjectedOnly * churchRate;
    const churchTax = churchTaxCurrent + churchTaxProjected;

    const solidaritySurchargeCurrent = solidaritySurchargeAnnual(incomeTaxCurrentOnly);
    const solidaritySurchargeProjected = solidaritySurchargeAnnual(incomeTaxAnnual) - solidaritySurchargeCurrent;
    const solidaritySurcharge = solidaritySurchargeCurrent + solidaritySurchargeProjected;

    const prepayments = Math.max(0, tax.prepaymentsYearToDate || 0);
    const totalDue = incomeTaxAnnual + churchTax + solidaritySurcharge - prepayments;

    return {
        taxableBaseYTD: taxableAnnual, // Now represents projected annual taxable base
        incomeTax: incomeTaxAnnual,
        churchTax,
        solidaritySurcharge,
        prepaymentsYearToDate: prepayments,
        totalDueYTD: totalDue,
        // Current vs projected breakdown
        incomeTaxCurrent: incomeTaxCurrentOnly,
        incomeTaxProjected: incomeTaxProjectedOnly,
        churchTaxCurrent,
        churchTaxProjected,
        solidaritySurchargeCurrent,
        solidaritySurchargeProjected,
    };
}

// ===== German Income Tax (approximate, 2025) =====
// Uses simplified piecewise progression approximating §32a EStG
// Thresholds (approx): Grundfreibetrag 12,096; 42% from 68,429; 45% from 277,826
function germanIncomeTax2025(taxableAnnual: number, jointAssessment: boolean): number {
    if (taxableAnnual <= 0) return 0;
    let base = taxableAnnual;
    if (jointAssessment) {
        // Splittingtarif approximation: compute on half, then double
        const half = germanIncomeTax2025(base / 2, false);
        return half * 2;
    }

    const gfb = 12096; // basic allowance
    const t2 = 68429; // start of 42%
    const t3 = 277826; // start of 45%

    if (base <= gfb) return 0;

    // Progressive segment approx: linearly rising from 14% to 42%
    const rateAtStart = 0.14;
    const rateAtEnd = 0.42;

    const taxAtT2 = (() => {
        const span = t2 - gfb;
        const avgRate = (rateAtStart + rateAtEnd) / 2; // crude average
        return Math.max(0, (base >= t2 ? 1 : (Math.max(0, base - gfb) / span))) * 0; // placeholder, replaced below
    })();

    // Compute tax progressively with continuity
    if (base <= t2) {
        const span = t2 - gfb;
        const x = (base - gfb) / span;
        const rate = rateAtStart + (rateAtEnd - rateAtStart) * x;
        // integrate linearly changing rate: average rate * taxable above gfb
        const avgRate = (rateAtStart + rate) / 2;
        return avgRate * Math.max(0, base - gfb);
    }

    // Tax up to t2
    const taxUpToT2 = (() => {
        const span = t2 - gfb;
        const avgRate = (rateAtStart + rateAtEnd) / 2;
        return avgRate * span;
    })();

    if (base <= t3) {
        return taxUpToT2 + 0.42 * (base - t2);
    }

    const taxUpToT3 = taxUpToT2 + 0.42 * (t3 - t2);
    return taxUpToT3 + 0.45 * (base - t3);
}

function solidaritySurchargeAnnual(incomeTaxAnnual: number): number {
    // Very rough exemption threshold approximation; below threshold -> 0
    const threshold = 17000; // approx
    if (incomeTaxAnnual <= threshold) return 0;
    return incomeTaxAnnual * 0.055;
}


