import { Invoice } from '@/domain/models';
import { MonthlyTotalItem } from './basicMetrics';

// ===== TYPES =====
export interface RevenueMetrics {
    averageMonthly: number;
    projectedAnnual: number;
    totalYTD: number;
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

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetweenInclusive(start: Date, end: Date): number {
    const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    if (endUTC < startUTC) return 0;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor((endUTC - startUTC) / oneDay) + 1;
}

function calculateInvoiceNet(invoice: Invoice): number {
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
}

// ===== PUBLIC METRICS =====
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
    
    // Project from the first month with earnings; ignore months before earnings started
    const periodStart = startOfDay(firstDate);
    const periodEnd = new Date(year, 11, 31);
    const daysElapsed = Math.max(1, daysBetweenInclusive(periodStart, startOfDay(now)));
    const daysInPeriod = Math.max(daysElapsed, daysBetweenInclusive(periodStart, periodEnd));
    const projectedAnnual = (totalYTD / daysElapsed) * daysInPeriod;

    return { averageMonthly, projectedAnnual, totalYTD };
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
    // Project from the first month with earnings; ignore months before earnings started
    const periodStart = startOfDay(firstDate);
    const periodEnd = new Date(year, 11, 31);
    const daysElapsed = Math.max(1, daysBetweenInclusive(periodStart, startOfDay(now)));
    const daysInPeriod = Math.max(daysElapsed, daysBetweenInclusive(periodStart, periodEnd));
    const projectedAnnual = (totalYTD / daysElapsed) * daysInPeriod;

    return { averageMonthly, projectedAnnual, totalYTD };
}
