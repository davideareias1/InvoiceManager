"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeTrackingProvider, useTimeTracking } from '@/infrastructure/contexts/TimeTrackingContext';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { format } from 'date-fns';

function MonthSelector({ value, onChange, options }: { value: { year: number; month: number }; onChange: (v: { year: number; month: number }) => void; options: Array<{ year: number; month: number }> }) {
    const current = `${value.year}-${String(value.month).padStart(2, '0')}`;
    const handle = (val: string) => {
        const [y, m] = val.split('-').map(Number);
        onChange({ year: y, month: m });
    };
    const unique = useMemo(() => {
        const set = new Set(options.map(o => `${o.year}-${String(o.month).padStart(2, '0')}`));
        // Ensure current is present
        if (!set.has(current)) set.add(current);
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [options, current]);
    return (
        <Select value={current} onValueChange={handle}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
                {unique.map(k => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function TimeTable({ customerId, customerName, hourlyRate }: { customerId: string; customerName: string; hourlyRate?: number }) {
    const { isInitialized, hasPermission, requestPermission } = useFileSystem();
    const { timesheet, stats, isLoading, isSaving, loadMonth, upsertEntry, deleteEntry, listAvailableMonths } = useTimeTracking();
    const now = new Date();
    const [ym, setYm] = useState<{ year: number; month: number }>({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const [options, setOptions] = useState<Array<{ year: number; month: number }>>([]);

    useEffect(() => {
        if (!isInitialized || !hasPermission) return;
        loadMonth(customerId, customerName, ym.year, ym.month, hourlyRate);
        listAvailableMonths(customerId, customerName).then(setOptions).catch(() => setOptions([]));
    }, [isInitialized, hasPermission, customerId, customerName, ym.year, ym.month, hourlyRate, loadMonth, listAvailableMonths]);

    const addOrUpdate = async (dateISO: string, start?: string, pause?: number, end?: string, notes?: string) => {
        await upsertEntry({ date: dateISO, start, pauseMinutes: pause, end, notes });
    };

    const remove = async (dateISO: string) => { await deleteEntry(dateISO); };

    if (!isInitialized) return <div className="p-6">Loading…</div>;
    if (!hasPermission) return (
        <div className="p-6">
            <Card>
                <CardHeader><CardTitle>Time Tracking</CardTitle></CardHeader>
                <CardContent>
                    <Button onClick={() => requestPermission()}>Grant Folder Access</Button>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-xl font-medium">{customerName}</div>
                <MonthSelector value={ym} onChange={setYm} options={options} />
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
                        <div>Dauer (Min)</div>
                        <div className="col-span-6">Bemerkungen</div>
                    </div>
                    {/* Render 31 rows, bind values if an entry exists */}
                    {Array.from({ length: 31 }).map((_, idx) => {
                        const date = new Date(ym.year, ym.month - 1, idx + 1);
                        if (date.getMonth() + 1 !== ym.month) return null;
                        const dateISO = format(date, 'yyyy-MM-dd');
                        const entry = timesheet?.entries.find(e => e.date === dateISO);
                        return (
                            <div key={dateISO} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-2 text-sm">{format(date, 'dd.MM.yyyy (EEE)')}</div>
                                <Input defaultValue={entry?.start || ''} onBlur={(e) => addOrUpdate(dateISO, e.target.value || undefined, entry?.pauseMinutes, entry?.end, entry?.notes)} placeholder="HH:mm" />
                                <Input type="number" defaultValue={typeof entry?.pauseMinutes === 'number' ? String(entry?.pauseMinutes) : ''} onBlur={(e) => addOrUpdate(dateISO, entry?.start, e.target.value ? Number(e.target.value) : undefined, entry?.end, entry?.notes)} placeholder="0" />
                                <Input defaultValue={entry?.end || ''} onBlur={(e) => addOrUpdate(dateISO, entry?.start, entry?.pauseMinutes, e.target.value || undefined, entry?.notes)} placeholder="HH:mm" />
                                <div className="text-sm">{entry?.durationMinutes || 0}</div>
                                <Input className="col-span-6" defaultValue={entry?.notes || ''} onBlur={(e) => addOrUpdate(dateISO, entry?.start, entry?.pauseMinutes, entry?.end, e.target.value || undefined)} placeholder="" />
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
                </CardContent>
            </Card>
        </div>
    );
}

export default function Page() {
    const params = useParams();
    const search = useSearchParams();
    const customerId = String(params.customerId);
    const customerName = String(search.get('name') || '');
    const hourlyRate = search.get('rate') ? Number(search.get('rate')) : undefined;
    return (
        <div className="p-6">
            <TimeTrackingProvider>
                <TimeTable customerId={customerId} customerName={customerName} hourlyRate={hourlyRate} />
            </TimeTrackingProvider>
        </div>
    );
}



