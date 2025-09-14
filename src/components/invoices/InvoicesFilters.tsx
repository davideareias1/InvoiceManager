"use client";

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePicker from 'react-datepicker';
import { RotateCcw } from 'lucide-react';
import { format as formatDateFn } from 'date-fns';
import { InvoiceStatus } from '@/domain/models';
import type { StatusFilter } from './types';

export type InvoicesFiltersProps = {
    query: string;
    setQuery: (q: string) => void;
    status: StatusFilter;
    setStatus: (s: StatusFilter) => void;
    customers: string[];
    customer: string;
    setCustomer: (c: string) => void;
    dateRange: [Date | null, Date | null];
    setDateRange: (r: [Date | null, Date | null]) => void;
    fromDate: string;
    toDate: string;
    setFromDate: (d: string) => void;
    setToDate: (d: string) => void;
    perPage: number;
    setPerPage: (n: number) => void;
    resetFilters: () => void;
};

export function InvoicesFilters({
    query,
    setQuery,
    status,
    setStatus,
    customers,
    customer,
    setCustomer,
    dateRange,
    setDateRange,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    perPage,
    setPerPage,
    resetFilters,
}: InvoicesFiltersProps) {
    return (
        <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
                <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value={InvoiceStatus.Unpaid}>Unpaid</SelectItem>
                    <SelectItem value={InvoiceStatus.Paid}>Paid</SelectItem>
                    <SelectItem value={InvoiceStatus.Overdue}>Overdue</SelectItem>
                    <SelectItem value={InvoiceStatus.Rectified}>Rectified</SelectItem>
                </SelectContent>
            </Select>
            <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                    {customers.map(c => (
                        <SelectItem key={c} value={c}>
                            {c === 'all' ? 'All customers' : c}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <DatePicker
                selectsRange
                monthsShown={2}
                startDate={dateRange[0]}
                endDate={dateRange[1]}
                onChange={(update: [Date | null, Date | null]) => {
                    setDateRange(update);
                    const [start, end] = update;
                    setFromDate(start ? formatDateFn(start, 'yyyy-MM-dd') : '');
                    setToDate(end ? formatDateFn(end, 'yyyy-MM-dd') : '');
                }}
                placeholderText="Date range"
                className="h-9 rounded-md border border-neutral-200 px-3 text-sm bg-white shadow-sm"
                popperClassName="!z-50"
            />
            {(fromDate || toDate) && (
                <Button
                    variant="outline"
                    size="sm"
                    aria-label="Clear date range"
                    title="Clear date range"
                    onClick={() => {
                        setDateRange([null, null]);
                        setFromDate('');
                        setToDate('');
                    }}
                >
                    <RotateCcw className="h-4 w-4" />
                </Button>
            )}
            <Button variant="outline" onClick={resetFilters}>Reset</Button>
            <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-neutral-500">Per page</span>
                <Select value={perPage.toString()} onValueChange={(value) => setPerPage(parseInt(value, 10))}>
                    <SelectTrigger className="w-[80px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {[10, 30, 50].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}


