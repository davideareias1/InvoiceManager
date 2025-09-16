import { TimeEntry, TimeSheetMonth, TimeStats } from '@/domain/models';

export function calculateDurationMinutes(start?: string, end?: string, pauseMinutes?: number): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if ([sh, sm, eh, em].some(v => Number.isNaN(v))) return 0;
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const raw = Math.max(0, endMin - startMin);
    return Math.max(0, raw - (pauseMinutes || 0));
}

export function upsertEntryInState(entries: TimeEntry[], entry: TimeEntry): TimeEntry[] {
    const idx = entries.findIndex(e => e.date === entry.date);
    const next = idx >= 0 ? entries.slice(0, idx).concat(entry, entries.slice(idx + 1)) : entries.concat(entry);
    return next.sort((a, b) => a.date.localeCompare(b.date));
}

export function computeStats(timesheet: TimeSheetMonth, hourlyRate?: number): TimeStats {
    const total = timesheet.entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
    const now = new Date();
    const thisYear = timesheet.year === now.getFullYear();
    // Average minutes this year across months present in files is better, but at app-level we can still show YTD average: total/number of months till current month
    const monthsSoFar = thisYear ? now.getMonth() + 1 : 12;
    const average = Math.round(total / Math.max(1, monthsSoFar));
    const revenue = typeof hourlyRate === 'number' ? Math.round((total / 60) * hourlyRate) : undefined;
    return {
        totalMinutesThisMonth: total,
        averageMonthlyMinutesThisYear: average,
        totalRevenueThisMonth: revenue,
    };
}



