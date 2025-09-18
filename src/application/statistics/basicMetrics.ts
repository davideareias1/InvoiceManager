import { Invoice } from '@/domain/models';

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

function calculateInvoiceNet(invoice: Invoice): number {
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
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
