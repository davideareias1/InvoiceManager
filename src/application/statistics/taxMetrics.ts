import { Invoice, PersonalTaxSettings } from '@/domain/models';

// ===== TYPES =====
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

    const gfb = 12096; // basic allowance (Grundfreibetrag)
    const t2 = 68480; // start of top marginal rate 42% (approx 2025)
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

function solidaritySurchargeAnnual(incomeTaxAnnual: number, jointAssessment: boolean): number {
    // Apply Freigrenze and Milderungszone according to SolzG 1995 (post-2021 reform)
    // Thresholds reference the festgesetzte Einkommensteuer (not zvE)
    const FREE_SINGLE = 16956; // Freigrenze (Einzel)
    const FULL_SINGLE = 31527; // Ab hier voller Zuschlag (Einzel)
    const FREE = jointAssessment ? FREE_SINGLE * 2 : FREE_SINGLE;
    const FULL = jointAssessment ? FULL_SINGLE * 2 : FULL_SINGLE;
    if (incomeTaxAnnual <= 0) return 0;
    if (incomeTaxAnnual <= FREE) return 0;
    if (incomeTaxAnnual >= FULL) return incomeTaxAnnual * 0.055;
    // Milderungszone: linear phase-in with factor 11.9%
    return (incomeTaxAnnual - FREE) * 0.119;
}

function deriveChurchTaxRatePercent(tax: PersonalTaxSettings): number {
    // If user is church member, determine by Bundesland (BW/BY = 8%, others = 9%)
    if (tax.isChurchMember) {
        const lowRateStates: Record<string, true> = { BW: true, BY: true };
        const st = tax.federalState as string | undefined;
        if (st && lowRateStates[st]) return 8;
        return 9;
    }
    return Math.max(0, tax.churchTaxRatePercent || 0);
}

// ===== PUBLIC METRICS =====
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
    const taxableAnnualSelf = Math.max(0, projectedAnnualRevenue - annualDeductible);
    const taxableYTDSelf = Math.max(0, revenueYTD - (annualDeductible * (doy / 365)));

    // If joint assessment and partner income provided, apply splitting on combined taxable base
    const partnerAnnual = Math.max(0, tax.partnerTaxableAnnualProjection || 0);
    const combinedAnnual = tax.jointAssessment ? (taxableAnnualSelf + partnerAnnual) : taxableAnnualSelf;
    // For "current" vs projected split, approximate partner equally spread across the year: attach none to current
    const taxableAnnual = combinedAnnual;
    const taxableYTD = tax.jointAssessment ? taxableYTDSelf : taxableYTDSelf;

    // Compute taxes for current YTD and projected annual
    const incomeTaxAnnual = germanIncomeTax2025(taxableAnnual, !!tax.jointAssessment);
    const incomeTaxCurrentOnly = germanIncomeTax2025(taxableYTD, !!tax.jointAssessment);
    const incomeTaxProjectedOnly = Math.max(0, incomeTaxAnnual - incomeTaxCurrentOnly);

    // Calculate church and solidarity taxes for current and projected
    const churchRate = Math.max(0, deriveChurchTaxRatePercent(tax)) / 100;
    const churchTaxCurrent = incomeTaxCurrentOnly * churchRate;
    const churchTaxProjected = incomeTaxProjectedOnly * churchRate;
    const churchTax = churchTaxCurrent + churchTaxProjected;

    const solidaritySurchargeCurrent = solidaritySurchargeAnnual(incomeTaxCurrentOnly, !!tax.jointAssessment);
    const solidaritySurchargeProjected = solidaritySurchargeAnnual(incomeTaxAnnual, !!tax.jointAssessment) - solidaritySurchargeCurrent;
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
