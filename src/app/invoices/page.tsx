"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import DatePicker from 'react-datepicker';
import { RotateCcw } from 'lucide-react';
import { useFileSystem } from '../../infrastructure/contexts/FileSystemContext';
import { getSavedDirectoryHandle, setDirectoryHandle as setFsHandle } from '../../infrastructure/filesystem/fileSystemStorage';
import { setDirectoryHandle as setCustomerHandle } from '../../infrastructure/repositories/customerRepository';
import { setDirectoryHandle as setProductHandle } from '../../infrastructure/repositories/productRepository';
import { setDirectoryHandle as setInvoiceHandle } from '../../infrastructure/repositories/invoiceRepository';
import { invoiceRepositoryAdapter } from '../../infrastructure/repositories/invoiceRepository';
import { generateInvoicePDF } from '../../infrastructure/pdf/pdfUtils';
import { Invoice, InvoiceStatus } from '../../domain/models';
import { formatCurrency, formatDate } from '../../shared/formatters';
import { format as formatDateFn } from 'date-fns';

type StatusFilter = 'all' | InvoiceStatus.Unpaid | InvoiceStatus.Paid | InvoiceStatus.Overdue | InvoiceStatus.Rectified;

export default function InvoicesPage() {
    const { isInitialized, hasPermission, loadInvoices, refreshInvoices, requestPermission } = useFileSystem();
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<StatusFilter>('all');
    const [customer, setCustomer] = useState<string>('all');
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

    // Pagination
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [confirmRectifyFor, setConfirmRectifyFor] = useState<Invoice | null>(null);
    const [confirmDeleteFor, setConfirmDeleteFor] = useState<Invoice | null>(null);

    useEffect(() => {
        const run = async () => {
            if (!isInitialized || !hasPermission) return;
            // Ensure repositories share the latest directory handle
            try {
                const handle = await getSavedDirectoryHandle();
                if (handle) {
                    setFsHandle(handle);
                    setCustomerHandle(handle);
                    setProductHandle(handle);
                    setInvoiceHandle(handle);
                }
            } catch (e) {
                console.warn('Failed to sync directory handle:', e);
            }
            setIsLoading(true);
            try {
                const list = await loadInvoices();
                setAllInvoices(list);
            } finally {
                setIsLoading(false);
            }
        };
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInitialized, hasPermission]);

    const handleGrantAccess = async () => {
        setIsLoading(true);
        try {
            const granted = await requestPermission();
            if (granted) {
                const list = await loadInvoices();
                setAllInvoices(list);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Unique customers for filter
    const customers = useMemo(() => {
        const set = new Set<string>();
        allInvoices.forEach(inv => {
            if (inv.customer?.name) set.add(inv.customer.name);
        });
        return ['all', ...Array.from(set).sort()];
    }, [allInvoices]);

    function getStatusLabel(invoice: Invoice): InvoiceStatus {
        if (invoice.status === InvoiceStatus.Rectified || invoice.isRectified) return InvoiceStatus.Rectified;
        if (invoice.is_paid) return InvoiceStatus.Paid;
        if (
            invoice.status === InvoiceStatus.Unpaid ||
            invoice.status === InvoiceStatus.Paid ||
            invoice.status === InvoiceStatus.Overdue
        ) {
            return invoice.status;
        }
        // Derive when missing: overdue if past due date, else unpaid
        if (invoice.due_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const due = new Date(invoice.due_date);
            if (!isNaN(due.getTime())) {
                due.setHours(0, 0, 0, 0);
                if (due.getTime() < today.getTime()) return InvoiceStatus.Overdue;
            }
        }
        return InvoiceStatus.Unpaid;
    }

    function isRectificationInvoice(invoice: Invoice): boolean {
        if (typeof invoice.total === 'number' && invoice.total < 0) return true;
        if (Array.isArray(invoice.items) && invoice.items.some(i => typeof i.price === 'number' && i.price < 0)) return true;
        const notes = (invoice.notes || '').toLowerCase();
        if (notes.includes('stornorechnung') || notes.includes('storno')) return true;
        const firstName = (invoice.items?.[0]?.name || '').toLowerCase();
        if (firstName.includes('stornorechnung')) return true;
        return false;
    }

    function getDisplayStatus(invoice: Invoice): string {
        if (isRectificationInvoice(invoice)) return 'Rectification';
        return getStatusLabel(invoice);
    }

    // Filtered invoices
    const filtered = useMemo(() => {
        let list = allInvoices;

        if (status !== 'all') {
            list = list.filter(inv => getStatusLabel(inv) === status);
        }
        if (customer !== 'all') {
            list = list.filter(inv => inv.customer?.name === customer);
        }
        if (fromDate) {
            const from = new Date(fromDate).getTime();
            list = list.filter(inv => new Date(inv.invoice_date).getTime() >= from);
        }
        if (toDate) {
            const to = new Date(toDate).getTime();
            list = list.filter(inv => new Date(inv.invoice_date).getTime() <= to);
        }
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(inv => {
                return (
                    (inv.invoice_number || '').toLowerCase().includes(q) ||
                    (inv.customer?.name || '').toLowerCase().includes(q) ||
                    (inv.notes || '').toLowerCase().includes(q) ||
                    (inv.client_email || '').toLowerCase().includes(q)
                );
            });
        }
        // Sort by date desc then number desc
        return list.slice().sort((a, b) => {
            const d = new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
            if (d !== 0) return d;
            return (parseInt(b.invoice_number, 10) || 0) - (parseInt(a.invoice_number, 10) || 0);
        });
    }, [allInvoices, status, customer, fromDate, toDate, query]);

    // Pagination calculation
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const current = useMemo(() => {
        const start = (page - 1) * perPage;
        return filtered.slice(start, start + perPage);
    }, [filtered, page, perPage]);

    useEffect(() => {
        // Reset to first page on filters/perPage change
        setPage(1);
    }, [status, customer, fromDate, toDate, query, perPage]);

    const togglePaid = async (invoice: Invoice) => {
        setIsLoading(true);
        try {
            await invoiceRepositoryAdapter.saveInvoice({ id: invoice.id, is_paid: !invoice.is_paid, status: !invoice.is_paid ? InvoiceStatus.Paid : InvoiceStatus.Unpaid });
            await refreshInvoices();
            const list = await loadInvoices();
            setAllInvoices(list);
        } finally {
            setIsLoading(false);
        }
    };

    const resetFilters = () => {
        setQuery('');
        setStatus('all');
        setCustomer('all');
        setFromDate('');
        setToDate('');
        setDateRange([null, null]);
        setPerPage(10);
    };

    // Removed in-calendar Clear; we'll provide an external reset icon next to the input

    const download = async (invoice: Invoice) => {
        try {
            const blob = await generateInvoicePDF(invoice, invoice.issuer as any);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-${invoice.invoice_number}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to generate PDF', e);
        }
    };

    const performRectify = async (invoice: Invoice) => {
        setIsLoading(true);
        try {
            // Create negative balance invoice manually from original
            const negative: Invoice = {
                ...invoice,
                id: crypto.randomUUID(),
                invoice_number: (parseInt(invoice.invoice_number, 10) + 1).toString().padStart(3, '0'),
                items: invoice.items.map(i => ({ ...i, price: -Math.abs(i.price) })),
                total: -Math.abs(invoice.total),
                is_paid: false,
                // This is a Stornorechnung. Leave status undefined; it will be derived.
                status: undefined,
                lastModified: new Date().toISOString(),
                isRectified: false,
                rectifiedBy: undefined,
            };

            // Mark original as rectified
            await invoiceRepositoryAdapter.saveInvoice({ id: invoice.id, isRectified: true, rectifiedBy: negative.invoice_number });
            await invoiceRepositoryAdapter.saveInvoice(negative);
            const list = await loadInvoices();
            setAllInvoices(list);
        } finally {
            setIsLoading(false);
            setConfirmRectifyFor(null);
        }
    };

    const performDelete = async (invoice: Invoice) => {
        setIsLoading(true);
        try {
            await invoiceRepositoryAdapter.deleteInvoice(invoice.id);
            const list = await loadInvoices();
            setAllInvoices(list);
        } finally {
            setIsLoading(false);
            setConfirmDeleteFor(null);
        }
    };

    if (!isInitialized) {
        return <div className="p-6">Loading…</div>;
    }

    if (!hasPermission) {
        return (
            <div className="p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Invoices</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-sm text-neutral-600">
                            Grant access to your InvoiceManager folder to load invoices. Select the folder that contains the subfolders "invoices", "customers", and "products".
                        </div>
                        <Button onClick={handleGrantAccess} disabled={isLoading}>{isLoading ? 'Processing…' : 'Grant Folder Access'}</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Invoices</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Input placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
                        <select className="h-9 rounded-md border border-neutral-200 px-2 text-sm" value={status} onChange={e => setStatus(e.target.value as StatusFilter)}>
                            <option value="all">All statuses</option>
                            <option value={InvoiceStatus.Unpaid}>Unpaid</option>
                            <option value={InvoiceStatus.Paid}>Paid</option>
                            <option value={InvoiceStatus.Overdue}>Overdue</option>
                            <option value={InvoiceStatus.Rectified}>Rectified</option>
                        </select>
                        <select className="h-9 rounded-md border border-neutral-200 px-2 text-sm" value={customer} onChange={e => setCustomer(e.target.value)}>
                            {customers.map(c => (
                                <option key={c} value={c}>{c === 'all' ? 'All customers' : c}</option>
                            ))}
                        </select>
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
                            <select className="h-9 rounded-md border border-neutral-200 px-2 text-sm" value={perPage} onChange={e => setPerPage(parseInt(e.target.value, 10))}>
                                {[10, 20, 50].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-neutral-200 text-left">
                                    <th className="py-2 pr-3">Number</th>
                                    <th className="py-2 pr-3">Date</th>
                                    <th className="py-2 pr-3">Customer</th>
                                    <th className="py-2 pr-3 text-right">Amount</th>
                                    <th className="py-2 pr-3">Status</th>
                                    <th className="py-2 pr-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td className="py-4" colSpan={6}>Loading…</td></tr>
                                ) : current.length === 0 ? (
                                    <tr><td className="py-4" colSpan={6}>No invoices found.</td></tr>
                                ) : current.map(inv => (
                                    <tr key={inv.id} className="border-b border-neutral-100">
                                        <td className="py-2 pr-3 font-medium">{inv.invoice_number}</td>
                                        <td className="py-2 pr-3">{formatDate(inv.invoice_date)}</td>
                                        <td className="py-2 pr-3">{inv.customer?.name || '-'}</td>
                                        <td className="py-2 pr-3 text-right">{formatCurrency(inv.total)}</td>
                                        <td className="py-2 pr-3">{getDisplayStatus(inv)}{(inv.status === InvoiceStatus.Rectified || inv.isRectified) && inv.rectifiedBy ? ` (rectified by #${inv.rectifiedBy})` : ''}</td>
                                        <td className="py-2 pr-3">
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" onClick={() => togglePaid(inv)}>{inv.is_paid ? 'Mark unpaid' : 'Mark paid'}</Button>
                                                <Button size="sm" variant="outline" onClick={() => download(inv)}>Download</Button>
                                                <Button size="sm" variant="outline" onClick={() => setConfirmRectifyFor(inv)}>Rectify</Button>
                                                <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteFor(inv)}>Delete</Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="text-sm text-neutral-500">Page {page} of {totalPages}</div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
                            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
                        </div>
                    </div>
                    
                    {/* Rectify confirmation dialog */}
                    <AlertDialog open={!!confirmRectifyFor} onOpenChange={(open) => { if (!open) setConfirmRectifyFor(null); }}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Rectify invoice #{confirmRectifyFor?.invoice_number}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will create a rectification (negative) invoice and mark the original as rectified.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                                <AlertDialogAction disabled={isLoading} onClick={() => confirmRectifyFor && performRectify(confirmRectifyFor)}>
                                    Create rectification
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Delete confirmation dialog */}
                    <AlertDialog open={!!confirmDeleteFor} onOpenChange={(open) => { if (!open) setConfirmDeleteFor(null); }}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete invoice #{confirmDeleteFor?.invoice_number}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the invoice from your storage.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                                <AlertDialogAction disabled={isLoading} onClick={() => confirmDeleteFor && performDelete(confirmDeleteFor)}>
                                    Delete invoice
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
}


