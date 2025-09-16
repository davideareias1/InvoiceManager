'use client';

import { TimeEntry, TimeSheetMonth, TimeTrackingRepository } from '../../domain/models';
import * as XLSX from 'xlsx';
import { getSavedDirectoryHandle, verifyHandlePermission } from '../filesystem/fileSystemStorage';

// Directory structure: timesheets/<sanitized-customer-name>/<year>/<customerName-year-month.xlsx>
const TIMESHEETS_DIRECTORY = 'timesheets';

let directoryHandle: FileSystemDirectoryHandle | null = null;

export const setDirectoryHandle = (handle: FileSystemDirectoryHandle) => {
    directoryHandle = handle;
};

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function getOrCreateDirectory(parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
    return parent.getDirectoryHandle(name, { create: true });
}

async function ensureRoot(): Promise<FileSystemDirectoryHandle> {
    let root = directoryHandle || (await getSavedDirectoryHandle());
    if (!root) throw new Error('Root directory handle not found. Grant permission first.');
    const ok = await verifyHandlePermission(root);
    if (!ok) throw new Error('Permission denied for the root directory.');
    return root;
}

function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

function buildWorkbookFromTimesheet(ts: TimeSheetMonth): XLSX.WorkBook {
    // Normalize to include ALL days of the month
    const totalDays = daysInMonth(ts.year, ts.month);
    const byDate = new Map<string, TimeEntry>();
    ts.entries.forEach(e => byDate.set(e.date, e));

    const header = ['Kalendertag', 'Beginn', 'Pause (Min)', 'Ende', 'Dauer (Min)', 'Bemerkungen'];
    const rows: any[][] = [header];

    const metaRows: any[][] = [['id', 'date']];

    for (let d = 1; d <= totalDays; d++) {
        const date = `${ts.year}-${String(ts.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const e = byDate.get(date) || {
            id: crypto.randomUUID(),
            date,
            start: '',
            pauseMinutes: undefined,
            end: '',
            durationMinutes: 0,
            notes: ''
        };
        rows.push([
            e.date,
            e.start || '',
            typeof e.pauseMinutes === 'number' ? e.pauseMinutes : '',
            e.end || '',
            e.durationMinutes || 0,
            e.notes || ''
        ]);
        metaRows.push([e.id, e.date]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Auto column widths based on max content length
    const colMax = new Array(header.length).fill(0);
    rows.forEach(r => {
        for (let i = 0; i < header.length; i++) {
            const cell = r[i];
            const str = typeof cell === 'number' ? String(cell) : (cell || '').toString();
            colMax[i] = Math.max(colMax[i], str.length, header[i].length);
        }
    });
    // Add some padding
    ws['!cols'] = colMax.map(len => ({ wch: Math.min(60, Math.max(10, len + 2)) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');

    // Metadata sheet for app state (ids for every day)
    const meta = XLSX.utils.aoa_to_sheet(metaRows);
    XLSX.utils.book_append_sheet(wb, meta, '_meta');
    return wb;
}

function parseWorkbookToTimesheet(
    wb: XLSX.WorkBook,
    customerId: string,
    customerName: string,
    year: number,
    month: number
): TimeSheetMonth {
    const ws = wb.Sheets['Timesheet'];
    const meta = wb.Sheets['_meta'];
    const rows: any[][] = ws ? XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][] : [];
    const metaRows: any[][] = meta ? XLSX.utils.sheet_to_json(meta, { header: 1 }) as any[][] : [];

    // Build map from date -> id from meta
    const idByDate = new Map<string, string>();
    if (metaRows.length > 1) {
        for (let i = 1; i < metaRows.length; i++) {
            const r = metaRows[i];
            const id = String(r[0] || '').trim();
            const date = String(r[1] || '').trim();
            if (id && date) idByDate.set(date, id);
        }
    }

    const entries: TimeEntry[] = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const date = String(r[0] || '').trim();
        if (!date) continue;
        const start = String(r[1] || '').trim() || undefined;
        const pauseStr = r[2];
        const pauseMinutes = typeof pauseStr === 'number' ? pauseStr : (String(pauseStr || '').trim() ? Number(String(pauseStr).trim()) : undefined);
        const end = String(r[3] || '').trim() || undefined;
        const durationVal = r[4];
        const durationMinutes = typeof durationVal === 'number' ? durationVal : Number(String(durationVal || '0')) || 0;
        const notes = String(r[5] || '').trim() || undefined;
        const id = idByDate.get(date) || crypto.randomUUID();
        entries.push({ id, date, start, pauseMinutes, end, durationMinutes, notes });
    }

    return {
        customerId,
        customerName,
        year,
        month,
        entries,
        lastModified: new Date().toISOString(),
    };
}

function computeDurationMinutes(start?: string, end?: string, pauseMinutes?: number): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if ([sh, sm, eh, em].some(v => Number.isNaN(v))) return 0;
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const raw = Math.max(0, endMin - startMin);
    return Math.max(0, raw - (pauseMinutes || 0));
}

async function getTimesheetFileHandle(
    customerName: string,
    year: number,
    month: number,
    create: boolean
): Promise<FileSystemFileHandle> {
    const root = await ensureRoot();
    const timesheetsDir = await getOrCreateDirectory(root, TIMESHEETS_DIRECTORY);
    const customerDir = await getOrCreateDirectory(timesheetsDir, sanitizeFilename(customerName));
    const yearDir = await getOrCreateDirectory(customerDir, String(year));
    const fileName = `${sanitizeFilename(customerName)}_${year}_${String(month).padStart(2, '0')}.xlsx`;
    return yearDir.getFileHandle(fileName, { create });
}

export const loadMonth = async (
    customerId: string,
    customerName: string,
    year: number,
    month: number
): Promise<TimeSheetMonth> => {
    try {
        const fileHandle = await getTimesheetFileHandle(customerName, year, month, false);
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        return parseWorkbookToTimesheet(wb, customerId, customerName, year, month);
    } catch (e) {
        // If not found, start with empty entries for days of month? We'll keep empty and add rows as user edits.
        return { customerId, customerName, year, month, entries: [], lastModified: new Date().toISOString() };
    }
};

export const saveMonth = async (ts: TimeSheetMonth): Promise<TimeSheetMonth> => {
    const wb = buildWorkbookFromTimesheet(ts);
    const fileHandle = await getTimesheetFileHandle(ts.customerName, ts.year, ts.month, true);
    const writable = await fileHandle.createWritable();
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await writable.write(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    await writable.close();
    return { ...ts, lastModified: new Date().toISOString() };
};

export const upsertEntry = async (
    customerId: string,
    customerName: string,
    year: number,
    month: number,
    entry: TimeEntry
): Promise<TimeSheetMonth> => {
    const current = await loadMonth(customerId, customerName, year, month);
    const durationMinutes = computeDurationMinutes(entry.start, entry.end, entry.pauseMinutes);
    const newEntry: TimeEntry = { ...entry, durationMinutes, id: entry.id || crypto.randomUUID() };
    const idx = current.entries.findIndex(e => e.date === newEntry.date);
    if (idx >= 0) current.entries[idx] = newEntry; else current.entries.push(newEntry);
    // sort by date asc
    current.entries.sort((a, b) => a.date.localeCompare(b.date));
    return await saveMonth(current);
};

export const deleteEntry = async (
    customerId: string,
    customerName: string,
    year: number,
    month: number,
    dateISO: string
): Promise<TimeSheetMonth> => {
    const current = await loadMonth(customerId, customerName, year, month);
    current.entries = current.entries.filter(e => e.date !== dateISO);
    return await saveMonth(current);
};

export const listAvailableMonths = async (
    customerId: string,
    customerName: string
): Promise<Array<{ year: number; month: number }>> => {
    const root = await ensureRoot();
    const timesheetsDir = await getOrCreateDirectory(root, TIMESHEETS_DIRECTORY);
    const customerDir = await getOrCreateDirectory(timesheetsDir, sanitizeFilename(customerName));
    const result: Array<{ year: number; month: number }> = [];
    for await (const yearEntry of customerDir.values()) {
        if (yearEntry.kind === 'directory') {
            const y = Number(yearEntry.name);
            try {
                const yearDir = await customerDir.getDirectoryHandle(yearEntry.name);
                for await (const fileEntry of yearDir.values()) {
                    if (fileEntry.kind === 'file' && fileEntry.name.endsWith('.xlsx')) {
                        const parts = fileEntry.name.split('_');
                        const monthPart = parts[parts.length - 1]; // e.g., 2025_09.xlsx
                        const mStr = monthPart.replace('.xlsx', '').split('_').pop() || '';
                        const m = Number(mStr);
                        if (!Number.isNaN(y) && !Number.isNaN(m)) {
                            result.push({ year: y, month: m });
                        }
                    }
                }
            } catch {
                // ignore invalid directories
            }
        }
    }
    // sort desc by year,month
    return result.sort((a, b) => b.year - a.year || b.month - a.month);
};

export const timeTrackingRepositoryAdapter: TimeTrackingRepository = {
    setDirectoryHandle,
    loadMonth,
    saveMonth,
    upsertEntry,
    deleteEntry,
    listAvailableMonths,
};



