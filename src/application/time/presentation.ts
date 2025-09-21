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

// ===== Bulk paste parsing =====

export interface ParsedBulkLine {
    isEmpty: boolean;
    start?: string;
    end?: string;
    pauseMinutes?: number;
    notes?: string;
}

export function normalizeTime(input: string): string | null {
    const cleaned = input.replace(/\./g, ':').trim();
    const m = cleaned.match(/^(\d{1,2})\s*[:](\d{1,2})$/);
    if (!m) return null;
    const hours = Number(m[1]);
    const minutes = Number(m[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parsePauseToMinutes(token: string | undefined): number | undefined {
    if (!token) return undefined;
    const t = token.trim();
    if (!t) return undefined;
    // Support formats: "90" (minutes), "1:00" (hours:minutes), "1.00" (hours.minutes -> treated like hours:minutes)
    const colonLike = t.replace(/\./g, ':');
    const mm = colonLike.match(/^(\d{1,3})\s*[:](\d{1,2})$/);
    if (mm) {
        const h = Number(mm[1]);
        const m = Number(mm[2]);
        if ([h, m].some(v => Number.isNaN(v))) return undefined;
        return Math.max(0, h * 60 + m);
    }
    const onlyNum = t.match(/^\d{1,4}$/);
    if (onlyNum) {
        const minutes = Number(t);
        return Number.isNaN(minutes) ? undefined : Math.max(0, minutes);
    }
    return undefined;
}

/**
 * Parse a multi-line bulk time text.
 * Each line maps to a day, starting from day 1 of the given month.
 * Line formats supported:
 * - "HH:mm    HH:mm"               => start, end, pause=0
 * - "HH:mm  MM  HH:mm"            => start, pause (minutes), end
 * - "HH:mm  H:MM  HH:mm"          => start, pause (h:mm), end
 * - Additional tokens between start and end that are not parseable as pause are treated as notes
 * - Empty line => empty day (delete entry)
 */
export function parseBulkTimeTextToMonth(
    rawText: string,
    year: number,
    month: number
): Array<{ date: string; parsed: ParsedBulkLine }> {
    const text = rawText.replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    const totalDays = new Date(year, month, 0).getDate();
    const result: Array<{ date: string; parsed: ParsedBulkLine }> = [];
    const max = Math.min(totalDays, lines.length);
    for (let idx = 0; idx < max; idx++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(idx + 1).padStart(2, '0')}`;
        const line = lines[idx] ?? '';
        const trimmed = line.trim();
        if (!trimmed) {
            result.push({ date, parsed: { isEmpty: true } });
            continue;
        }

        const tokens = trimmed.split(/\s+/).filter(Boolean);
        // Find first and last time-like tokens as start/end
        let startIdx = -1;
        let endIdx = -1;
        for (let i = 0; i < tokens.length; i++) {
            if (normalizeTime(tokens[i])) { startIdx = i; break; }
        }
        for (let j = tokens.length - 1; j >= 0; j--) {
            if (normalizeTime(tokens[j])) { endIdx = j; break; }
        }
        const startCandidate = startIdx >= 0 ? normalizeTime(tokens[startIdx]) : null;
        const endCandidate = endIdx >= 0 && endIdx > startIdx ? normalizeTime(tokens[endIdx]) : null;

        if (!startCandidate || !endCandidate) {
            // Not a valid time line -> treat as empty to be safe
            result.push({ date, parsed: { isEmpty: true } });
            continue;
        }

        // Determine pause and notes
        let pauseMinutes: number | undefined = undefined;
        let notes: string | undefined = undefined;
        if (endIdx - startIdx === 1) {
            // Explicit: start and end only -> no pause
            pauseMinutes = 0;
        } else if (endIdx - startIdx >= 2) {
            // Try to parse the first middle token as pause
            const middleTokens = tokens.slice(startIdx + 1, endIdx);
            const maybePause = parsePauseToMinutes(middleTokens[0]);
            if (typeof maybePause === 'number') {
                pauseMinutes = maybePause;
                if (middleTokens.length > 1) {
                    notes = middleTokens.slice(1).join(' ');
                }
            } else {
                // No parseable pause provided; treat all middle tokens as notes and pause = 0 per "space in middle means no pause"
                pauseMinutes = 0;
                notes = middleTokens.join(' ');
            }
        }

        // Append any trailing tokens after endIdx as notes as well
        const trailing = endIdx + 1 < tokens.length ? tokens.slice(endIdx + 1).join(' ') : '';
        notes = [notes, trailing].filter(Boolean).join(' ').trim() || undefined;

        result.push({
            date,
            parsed: {
                isEmpty: false,
                start: startCandidate,
                end: endCandidate,
                pauseMinutes,
                notes: notes || undefined,
            }
        });
    }
    return result;
}

/**
 * Same as parseBulkTimeTextToMonth, but starts mapping from a specific day index.
 * startDay is 1-based (1..daysInMonth).
 */
export function parseBulkTimeTextFromDay(
    rawText: string,
    year: number,
    month: number,
    startDay: number
): Array<{ date: string; parsed: ParsedBulkLine }> {
    const text = rawText.replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    const totalDays = new Date(year, month, 0).getDate();
    const result: Array<{ date: string; parsed: ParsedBulkLine }> = [];
    let day = Math.max(1, Math.min(totalDays, startDay));
    for (let idx = 0; idx < lines.length && day <= totalDays; idx++, day++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const line = lines[idx] ?? '';
        const trimmed = line.trim();
        if (!trimmed) {
            result.push({ date, parsed: { isEmpty: true } });
            continue;
        }

        const tokens = trimmed.split(/\s+/).filter(Boolean);
        // Identify first and last time-like tokens as start/end
        let startIdx = -1;
        let endIdx = -1;
        for (let i = 0; i < tokens.length; i++) {
            if (normalizeTime(tokens[i])) { startIdx = i; break; }
        }
        for (let j = tokens.length - 1; j >= 0; j--) {
            if (normalizeTime(tokens[j])) { endIdx = j; break; }
        }
        const startCandidate = startIdx >= 0 ? normalizeTime(tokens[startIdx]) : null;
        const endCandidate = endIdx >= 0 && endIdx > startIdx ? normalizeTime(tokens[endIdx]) : null;

        if (!startCandidate || !endCandidate) {
            result.push({ date, parsed: { isEmpty: true } });
            continue;
        }

        let pauseMinutes: number | undefined = undefined;
        let notes: string | undefined = undefined;
        if (endIdx - startIdx === 1) {
            pauseMinutes = 0;
        } else if (endIdx - startIdx >= 2) {
            const middleTokens = tokens.slice(startIdx + 1, endIdx);
            const maybePause = parsePauseToMinutes(middleTokens[0]);
            if (typeof maybePause === 'number') {
                pauseMinutes = maybePause;
                if (middleTokens.length > 1) notes = middleTokens.slice(1).join(' ');
            } else {
                pauseMinutes = 0;
                notes = middleTokens.join(' ');
            }
        }

        const trailing = endIdx + 1 < tokens.length ? tokens.slice(endIdx + 1).join(' ') : '';
        notes = [notes, trailing].filter(Boolean).join(' ').trim() || undefined;

        result.push({
            date,
            parsed: {
                isEmpty: false,
                start: startCandidate,
                end: endCandidate,
                pauseMinutes,
                notes,
            }
        });
    }
    return result;
}




