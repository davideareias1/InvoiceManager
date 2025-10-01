// ===== BILLING CUTOFF HELPERS =====

/**
 * Compute the effective billing period (year, month) for a given date.
 * If the day of month is less than cutoffDay, rolls back to the previous month.
 * Handles year boundaries.
 */
export function computeEffectiveBillingPeriod(
    date: Date,
    cutoffDay: number = 20,
): { year: number; month: number } {
    const year = date.getFullYear();
    const monthIndex = date.getMonth(); // 0-11
    const day = date.getDate();

    if (day < cutoffDay) {
        // Previous month
        const prev = new Date(year, monthIndex, 0); // last day of previous month
        return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
    }

    // Current month
    return { year, month: monthIndex + 1 };
}

/**
 * Convenience formatter for labeling a billing period.
 */
export function formatBillingPeriodLabel(
    year: number,
    month: number,
    locale?: string | string[]
): string {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleString(locale, { month: 'long', year: 'numeric' });
}
