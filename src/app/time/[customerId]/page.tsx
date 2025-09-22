"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CustomerData } from '@/domain/models';
import { Input } from '@/components/ui/input';
import { TimeTrackingProvider, useTimeTracking } from '@/infrastructure/contexts/TimeTrackingContext';
import { parseBulkTimeTextFromDay, normalizeTime, parsePauseToMinutes } from '@/application/time/presentation';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { format } from 'date-fns';
import { getSavedDirectoryHandle } from '@/infrastructure/filesystem/fileSystemStorage';
import { setDirectoryHandle, findCustomerByIdSync, loadCustomers } from '@/infrastructure/repositories/customerRepository';

function MonthSelector({ value, onChange }: { value: { year: number; month: number }; onChange: (v: { year: number; month: number }) => void; }) {
    const current = `${value.year}-${String(value.month).padStart(2, '0')}`;
    return (
        <Input
            type="month"
            value={current}
            onChange={(e) => {
                const val = e.target.value; // yyyy-MM
                const [y, m] = val.split('-').map(Number);
                if (!Number.isNaN(y) && !Number.isNaN(m)) onChange({ year: y, month: m });
            }}
            className="w-[160px]"
        />
    );
}


function formatDuration(minutes: number): string {
    if (minutes === 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

function TimeTable({ customer }: { customer: CustomerData }) {
    const { isInitialized, hasPermission } = useFileSystem();
    const { timesheet, stats, isLoading, isSaving, loadMonth, upsertEntry, deleteEntry } = useTimeTracking();
    const now = new Date();
    const [ym, setYm] = useState<{ year: number; month: number }>({ year: now.getFullYear(), month: now.getMonth() + 1 });
    

    useEffect(() => {
        if (!isInitialized || !hasPermission) return;
        loadMonth(customer.id, customer.name, ym.year, ym.month, customer.hourlyRate);
    }, [isInitialized, hasPermission, customer, ym.year, ym.month, loadMonth]);

    const addOrUpdate = async (dateISO: string, start?: string, pause?: number, end?: string, notes?: string) => {
        await upsertEntry({ date: dateISO, start, pauseMinutes: pause, end, notes });
    };

    const remove = async (dateISO: string) => { await deleteEntry(dateISO); };





    // ===== ACTION HANDLERS =====
    const handlePaste = async (
        e: React.ClipboardEvent<HTMLInputElement>,
        dayNumber: number,
        column: 'start' | 'pause' | 'end' | 'notes'
    ) => {
        if (!timesheet) return;
        const text = e.clipboardData.getData('text');
        if (!text) return;

        const normalized = text.replace(/\r\n/g, '\n');
        const lines = normalized.split('\n');
        if (lines.length <= 1) return; // allow normal single-paste behaviour

        e.preventDefault();

        const timeRegex = /(\d{1,2})\s*[:\.]\s*(\d{2})/g;
        const hasAnyTime = lines.some(l => (l.match(timeRegex) || []).length >= 1);
        const hasLineWithTwoTimes = lines.some(l => (l.match(timeRegex) || []).length >= 2);

        // Helper to get entry by date
        const getEntry = (dateISO: string) => timesheet.entries.find(e => e.date === dateISO);

        if (column === 'notes') {
            // Notes-only paste
            let day = dayNumber;
            for (const line of lines) {
                const date = new Date(ym.year, ym.month - 1, day);
                if (date.getMonth() + 1 !== ym.month) break;
                const dateISO = format(date, 'yyyy-MM-dd');
                const cur = getEntry(dateISO);
                const note = line.trim() || undefined;
                if (!note && !cur) { day++; continue; }
                await upsertEntry({
                    date: dateISO,
                    start: cur?.start,
                    pauseMinutes: cur?.pauseMinutes,
                    end: cur?.end,
                    notes: note,
                });
                day++;
            }
            return;
        }

        if (column === 'pause' && !hasLineWithTwoTimes) {
            // Pause-only paste (minutes or h:mm)
            let day = dayNumber;
            for (const line of lines) {
                const date = new Date(ym.year, ym.month - 1, day);
                if (date.getMonth() + 1 !== ym.month) break;
                const dateISO = format(date, 'yyyy-MM-dd');
                const cur = getEntry(dateISO);
                const pm = parsePauseToMinutes(line.trim());
                await upsertEntry({
                    date: dateISO,
                    start: cur?.start,
                    pauseMinutes: typeof pm === 'number' ? pm : undefined,
                    end: cur?.end,
                    notes: cur?.notes,
                });
                day++;
            }
            return;
        }

        if (hasLineWithTwoTimes) {
            // Full time lines paste; parse and apply from selected day
            const parsed = parseBulkTimeTextFromDay(normalized, ym.year, ym.month, dayNumber);
            for (const item of parsed) {
                if (item.parsed.isEmpty) {
                    await deleteEntry(item.date);
                } else {
                    await upsertEntry({
                        date: item.date,
                        start: item.parsed.start,
                        pauseMinutes: item.parsed.pauseMinutes,
                        end: item.parsed.end,
                        notes: item.parsed.notes,
                    });
                }
            }
            return;
        }

        if (hasAnyTime && (column === 'start' || column === 'end')) {
            // Single time per line -> fill the targeted column only
            let day = dayNumber;
            for (const line of lines) {
                const date = new Date(ym.year, ym.month - 1, day);
                if (date.getMonth() + 1 !== ym.month) break;
                const dateISO = format(date, 'yyyy-MM-dd');
                const cur = getEntry(dateISO);
                const timeToken = (line.match(timeRegex) || [])[0] || '';
                const time = normalizeTime(timeToken) || undefined;
                await upsertEntry({
                    date: dateISO,
                    start: column === 'start' ? time : cur?.start,
                    pauseMinutes: cur?.pauseMinutes,
                    end: column === 'end' ? time : cur?.end,
                    notes: cur?.notes,
                });
                day++;
            }
            return;
        }

        // Fallback: treat as notes even if in time field
        let day = dayNumber;
        for (const line of lines) {
            const date = new Date(ym.year, ym.month - 1, day);
            if (date.getMonth() + 1 !== ym.month) break;
            const dateISO = format(date, 'yyyy-MM-dd');
            const cur = getEntry(dateISO);
            const note = line.trim() || undefined;
            await upsertEntry({
                date: dateISO,
                start: cur?.start,
                pauseMinutes: cur?.pauseMinutes,
                end: cur?.end,
                notes: note,
            });
            day++;
        }
    };

    return (
        <div className="space-y-4 h-full overflow-auto">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xl font-medium">{customer.name}</div>
                <MonthSelector value={ym} onChange={setYm} />
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Timesheet {ym.year}-{String(ym.month).padStart(2, '0')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-12 gap-2 text-sm font-medium text-neutral-600">
                        <div className="col-span-2">Kalendertag</div>
                        <div>Beginn</div>
                        <div>Pause (Min)</div>
                        <div>Ende</div>
                        <div>Dauer</div>
                        <div className="col-span-6">Bemerkungen</div>
                    </div>
                    {/* Render 31 rows, bind values if an entry exists */}
                    {Array.from({ length: 31 }).map((_, idx) => {
                        const date = new Date(ym.year, ym.month - 1, idx + 1);
                        if (date.getMonth() + 1 !== ym.month) return null;
                        const dateISO = format(date, 'yyyy-MM-dd');
                        const entry = timesheet?.entries.find(e => e.date === dateISO);
                        return (
                            <div key={`${dateISO}-${entry?.start || ''}-${entry?.pauseMinutes ?? ''}-${entry?.end || ''}-${entry?.notes || ''}`} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-2 text-sm">{format(date, 'dd.MM.yyyy (EEE)')}</div>
                                <Input defaultValue={entry?.start || ''} onPaste={(e) => handlePaste(e, idx + 1, 'start')} onBlur={(e) => addOrUpdate(dateISO, e.target.value || undefined, entry?.pauseMinutes, entry?.end, entry?.notes)} placeholder="HH:mm" />
                                <Input type="number" defaultValue={typeof entry?.pauseMinutes === 'number' ? String(entry?.pauseMinutes) : ''} onPaste={(e) => handlePaste(e, idx + 1, 'pause')} onBlur={(e) => addOrUpdate(dateISO, entry?.start, e.target.value ? Number(e.target.value) : undefined, entry?.end, entry?.notes)} placeholder="0" />
                                <Input defaultValue={entry?.end || ''} onPaste={(e) => handlePaste(e, idx + 1, 'end')} onBlur={(e) => addOrUpdate(dateISO, entry?.start, entry?.pauseMinutes, e.target.value || undefined, entry?.notes)} placeholder="HH:mm" />
                                <div className="text-sm">{formatDuration(entry?.durationMinutes || 0)}</div>
                                <Input className="col-span-6" defaultValue={entry?.notes || ''} onPaste={(e) => handlePaste(e, idx + 1, 'notes')} onBlur={(e) => addOrUpdate(dateISO, entry?.start, entry?.pauseMinutes, entry?.end, e.target.value || undefined)} placeholder="" />
                            </div>
                        );
                    })}
                    <div className="text-xs text-neutral-500">{isSaving ? 'Saving…' : ''}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Statistics</CardTitle></CardHeader>
                <CardContent className="text-sm">
                    <div>Total this month: {Math.round((stats?.totalMinutesThisMonth || 0) / 60)} h</div>
                    <div>Average monthly (YTD): {Math.round((stats?.averageMonthlyMinutesThisYear || 0) / 60)} h</div>
                    {typeof stats?.totalRevenueThisMonth === 'number' && (
                        <div>Revenue estimate this month: € {stats!.totalRevenueThisMonth}</div>
                    )}
                    {timesheet && (
                        <div className="mt-2 text-neutral-600">
                            Sum: {Math.floor((timesheet.entries.reduce((s, e) => s + (e.durationMinutes || 0), 0)) / 60)}h {((timesheet.entries.reduce((s, e) => s + (e.durationMinutes || 0), 0)) % 60)}m
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function Page() {
    const params = useParams();
    const { isInitialized, hasPermission } = useFileSystem();
    const customerId = String(params.customerId);
    const [customer, setCustomer] = useState<CustomerData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCustomer = async () => {
            if (!isInitialized || !hasPermission || !customerId) return;

            setIsLoading(true);
            try {
                const handle = await getSavedDirectoryHandle();
                if (handle) {
                    setDirectoryHandle(handle);
                }
                await loadCustomers(); // Ensures cache is warm
                const cust = findCustomerByIdSync(customerId);
                if (cust) {
                    setCustomer(cust as unknown as CustomerData);
                } else {
                    console.warn(`Customer with id ${customerId} not found.`);
                    // Optionally, redirect to a not-found page or show an error
                }
            } catch (error) {
                console.error("Failed to load customer data", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCustomer();
    }, [isInitialized, hasPermission, customerId]);

    if (isLoading) {
        return <div className="p-6">Loading customer data…</div>;
    }

    if (!customer) {
        return <div className="p-6">Customer not found.</div>;
    }

    return (
        <div className="p-6 h-[calc(100vh-6rem)] overflow-auto">
            <TimeTrackingProvider>
                <TimeTable customer={customer} />
            </TimeTrackingProvider>
        </div>
    );
}



