"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CustomerData } from '@/domain/models';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeTrackingProvider, useTimeTracking } from '@/infrastructure/contexts/TimeTrackingContext';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { format } from 'date-fns';
import { getSavedDirectoryHandle } from '@/infrastructure/filesystem/fileSystemStorage';
import { setDirectoryHandle, findCustomerByIdSync, loadCustomers } from '@/infrastructure/repositories/customerRepository';

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


function formatDuration(minutes: number): string {
    if (minutes === 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

function TimeTable({ customer }: { customer: CustomerData }) {
    const { isInitialized, hasPermission } = useFileSystem();
    const { timesheet, stats, isLoading, isSaving, loadMonth, upsertEntry, deleteEntry, listAvailableMonths } = useTimeTracking();
    const now = new Date();
    const [ym, setYm] = useState<{ year: number; month: number }>({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const [options, setOptions] = useState<Array<{ year: number; month: number }>>([]);

    useEffect(() => {
        if (!isInitialized || !hasPermission) return;
        loadMonth(customer.id, customer.name, ym.year, ym.month, customer.hourlyRate);
        listAvailableMonths(customer.id, customer.name).then(setOptions).catch(() => setOptions([]));
    }, [isInitialized, hasPermission, customer, ym.year, ym.month, loadMonth, listAvailableMonths]);

    const addOrUpdate = async (dateISO: string, start?: string, pause?: number, end?: string, notes?: string) => {
        await upsertEntry({ date: dateISO, start, pauseMinutes: pause, end, notes });
    };

    const remove = async (dateISO: string) => { await deleteEntry(dateISO); };





    return (
        <div className="space-y-4 h-full overflow-auto">
            <div className="flex items-center justify-between">
                <div className="text-xl font-medium">{customer.name}</div>
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
                                <Input defaultValue={entry?.start || ''} onBlur={(e) => addOrUpdate(dateISO, e.target.value || undefined, entry?.pauseMinutes, entry?.end, entry?.notes)} placeholder="HH:mm" />
                                <Input type="number" defaultValue={typeof entry?.pauseMinutes === 'number' ? String(entry?.pauseMinutes) : ''} onBlur={(e) => addOrUpdate(dateISO, entry?.start, e.target.value ? Number(e.target.value) : undefined, entry?.end, entry?.notes)} placeholder="0" />
                                <Input defaultValue={entry?.end || ''} onBlur={(e) => addOrUpdate(dateISO, entry?.start, entry?.pauseMinutes, e.target.value || undefined, entry?.notes)} placeholder="HH:mm" />
                                <div className="text-sm">{formatDuration(entry?.durationMinutes || 0)}</div>
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



