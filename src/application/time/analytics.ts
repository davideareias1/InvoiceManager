import { CustomerData } from '@/domain/models';
import { CustomerTimeIndex } from '@/infrastructure/contexts/TimeAnalyticsContext';

export type TimeViewMode = 'monthly' | 'daily';

export interface TimeChartSeriesRow {
    label: string; // YYYY-MM or YYYY-MM-DD
    [customerName: string]: string | number;
}

export interface TimeChartPrepared {
    rows: TimeChartSeriesRow[];
    customerNames: string[];
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

export function prepareTimeChartData(
    index: CustomerTimeIndex[],
    viewMode: TimeViewMode,
    selectedYear: number,
    selectedMonth?: number,
): TimeChartPrepared {
    const customerNames = index.map(i => i.customerName);

    if (viewMode === 'monthly') {
        const rows: TimeChartSeriesRow[] = [];
        for (let m = 1; m <= 12; m++) {
            const label = `${selectedYear}-${String(m).padStart(2, '0')}`;
            const row: TimeChartSeriesRow = { label };
            for (const ci of index) {
                const minutes = ci.perMonthMinutes[label] || 0;
                row[ci.customerName] = Math.round((minutes / 60) * 10) / 10; // hours with 0.1 precision
            }
            rows.push(row);
        }
        return { rows, customerNames };
    }

    // daily view for a specific month
    const month = selectedMonth || new Date().getMonth() + 1;
    const totalDays = daysInMonth(selectedYear, month);
    const rows: TimeChartSeriesRow[] = [];
    for (let d = 1; d <= totalDays; d++) {
        const date = `${selectedYear}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const row: TimeChartSeriesRow = { label: date };
        for (const ci of index) {
            const minutes = ci.perDayMinutes[date] || 0;
            row[ci.customerName] = Math.round((minutes / 60) * 10) / 10; // hours
        }
        rows.push(row);
    }
    return { rows, customerNames };
}

export interface RoiItem {
    customerName: string;
    totalHours: number;
    revenue: number;
    roiPerHour: number; // EUR per hour (revenue / hours)
}

export function computeROI(index: CustomerTimeIndex[]): RoiItem[] {
    // legacy: compute ROI based on hourlyRate when available (kept for compatibility)
    const items: RoiItem[] = index.map(ci => {
        const totalMinutes = Object.values(ci.perDayMinutes).reduce((s, v) => s + v, 0);
        const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
        const revenue = 0;
        const roi = 0;
        return {
            customerName: ci.customerName,
            totalHours,
            revenue,
            roiPerHour: roi,
        };
    });
    return items.sort((a, b) => b.roiPerHour - a.roiPerHour || b.revenue - a.revenue);
}

export function computeInvoiceBasedROI(
    perClientTotals: { client: string; total: number }[],
    index: CustomerTimeIndex[],
    year: number,
): RoiItem[] {
    const minutesByClientThisYear: Record<string, number> = {};
    for (const ci of index) {
        let sum = 0;
        Object.entries(ci.perMonthMinutes).forEach(([key, minutes]) => {
            const y = Number(key.split('-')[0]);
            if (y === year) sum += minutes;
        });
        minutesByClientThisYear[ci.customerName] = sum;
    }

    const items: RoiItem[] = perClientTotals.map(({ client, total }) => {
        const minutes = minutesByClientThisYear[client] || 0;
        const hours = Math.round((minutes / 60) * 10) / 10;
        const revenue = Math.max(0, total);
        const roiPerHour = hours > 0 ? Math.round((revenue / hours) * 100) / 100 : 0;
        return { customerName: client, totalHours: hours, revenue, roiPerHour };
    });
    return items.sort((a, b) => b.roiPerHour - a.roiPerHour || b.revenue - a.revenue);
}

export function computeAvailablePeriods(index: CustomerTimeIndex[]): { years: number[]; monthsByYear: Record<number, number[]> } {
    const yearsSet = new Set<number>();
    const monthsByYear: Record<number, Set<number>> = {};
    for (const ci of index) {
        Object.keys(ci.perMonthMinutes).forEach(key => {
            const [yStr, mStr] = key.split('-');
            const y = Number(yStr);
            const m = Number(mStr);
            if (Number.isNaN(y) || Number.isNaN(m)) return;
            yearsSet.add(y);
            if (!monthsByYear[y]) monthsByYear[y] = new Set<number>();
            monthsByYear[y].add(m);
        });
    }
    return {
        years: Array.from(yearsSet).sort((a, b) => b - a),
        monthsByYear: Object.fromEntries(Object.entries(monthsByYear).map(([y, set]) => [Number(y), Array.from(set as Set<number>).sort((a, b) => a - b)])),
    };
}

// ===== TIME-BASED REVENUE ESTIMATION =====
/**
 * Estimate realized revenue from tracked time for each month of a given year.
 * Uses each customer's hourlyRate when available. Returns a map keyed by 'YYYY-MM'.
 */
export function estimateTimeBasedRevenueByMonth(
    index: CustomerTimeIndex[],
    year: number,
): Record<string, number> {
    const result: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        let sum = 0;
        for (const ci of index) {
            const minutes = ci.perMonthMinutes[key] || 0;
            const hourlyRate = typeof ci.hourlyRate === 'number' ? ci.hourlyRate : 0;
            if (minutes > 0 && hourlyRate > 0) {
                sum += (minutes / 60) * hourlyRate;
            }
        }
        result[key] = Math.round(sum * 100) / 100; // cents precision
    }
    return result;
}

function computeRecentAverage(values: number[], maxCount: number): number {
    const nonZero = values.filter(v => v > 0);
    if (nonZero.length === 0) return 0;
    const last = nonZero.slice(-maxCount);
    const avg = last.reduce((s, v) => s + v, 0) / last.length;
    return Math.round(avg * 100) / 100;
}

/**
 * Compute monthly projection values using tracked time and hourly rates.
 * - For the current month: scale realized time-revenue by elapsed month fraction.
 * - For future months (in the current year): use the recent average (up to 3 months) of time-revenue.
 * - Past months and non-current years return null.
 */
export function computeTimeBasedMonthlyProjections(
    index: CustomerTimeIndex[],
    year: number,
    now: Date = new Date(),
): Record<string, number | null> {
    const projections: Record<string, number | null> = {};
    const currentYear = now.getFullYear();

    // Default to nulls
    for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        projections[key] = null;
    }

    if (year !== currentYear) return projections;

    const currentMonthIndex = now.getMonth(); // 0-11
    const daysTotal = daysInMonth(year, currentMonthIndex + 1);
    const dayOfMonth = now.getDate();
    const elapsedFraction = Math.min(1, Math.max(0.05, dayOfMonth / daysTotal));

    const realizedByMonth = estimateTimeBasedRevenueByMonth(index, year);
    const realizedValuesBeforeCurrent = Array.from({ length: currentMonthIndex }, (_, i) => realizedByMonth[`${year}-${String(i + 1).padStart(2, '0')}`] || 0);
    const recentAvg = computeRecentAverage(realizedValuesBeforeCurrent, 3);

    // Current month projection
    const currentKey = `${year}-${String(currentMonthIndex + 1).padStart(2, '0')}`;
    const realizedCurrent = realizedByMonth[currentKey] || 0;
    const projectedCurrent = realizedCurrent > 0 ? Math.round((realizedCurrent / elapsedFraction) * 100) / 100 : 0;
    projections[currentKey] = projectedCurrent > 0 ? projectedCurrent : (recentAvg > 0 ? recentAvg : null);

    // Future months projection baseline
    const baseline = recentAvg > 0 ? recentAvg : 0;
    for (let m = currentMonthIndex + 2; m <= 12; m++) { // months strictly after current
        const key = `${year}-${String(m).padStart(2, '0')}`;
        projections[key] = baseline > 0 ? baseline : null;
    }

    return projections;
}


