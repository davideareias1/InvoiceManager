"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { useFileSystem } from '../../infrastructure/contexts/FileSystemContext';
import { isFileSystemAccessSupported } from '../../infrastructure/filesystem/fileSystemStorage';
import { getSavedDirectoryHandle, setDirectoryHandle as setFsHandle } from '../../infrastructure/filesystem/fileSystemStorage';
import { setDirectoryHandle as setCustomerHandle } from '../../infrastructure/repositories/customerRepository';
import { setDirectoryHandle as setProductHandle } from '../../infrastructure/repositories/productRepository';
import { setDirectoryHandle as setInvoiceHandle } from '../../infrastructure/repositories/invoiceRepository';
import { invoiceRepositoryAdapter } from '../../infrastructure/repositories/invoiceRepository';
import { generateInvoicePDF } from '../../infrastructure/pdf/pdfUtils';
import { Invoice, InvoiceStatus } from '../../domain/models';
import { formatCurrency, formatDate } from '../../shared/formatters';
import { format as formatDateFn } from 'date-fns';
import { InvoicesFilters } from '@/components/invoices/InvoicesFilters';
import { DeleteDialog } from '@/components/invoices/DeleteDialog';
import { RectifyDialog } from '@/components/invoices/RectifyDialog';
import type { StatusFilter } from '@/components/invoices/types';
import { getDisplayStatus, getStatusLabel } from '@/application/invoices/presentation';
import { InvoicesTable } from '@/components/invoices/InvoicesTable';
import { InvoicesPagination } from '@/components/invoices/InvoicesPagination';
import { useCompany } from '../../infrastructure/contexts/CompanyContext';

// helpers and dialogs are now imported from application/components layers

export default function InvoicesPage() {
    const { isInitialized, hasPermission, loadInvoices, refreshInvoices, requestPermission } = useFileSystem();
    const isFSA = typeof window !== 'undefined' && isFileSystemAccessSupported();
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { companyInfo } = useCompany();

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

    // helpers are defined at file scope: getStatusLabel, isRectificationInvoice, getDisplayStatus

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
                const numberStr = (inv.invoice_number || '').toLowerCase();
                const rawDateStr = (inv.invoice_date || '').toLowerCase();
                const formattedDateStr = (formatDate(inv.invoice_date) || '').toLowerCase();
                const customerStr = (inv.customer?.name || '').toLowerCase();
                const notesStr = (inv.notes || '').toLowerCase();
                const emailStr = (inv.client_email || '').toLowerCase();
                const amountRawStr = (typeof inv.total === 'number' ? String(inv.total) : '').toLowerCase();
                const amountFormattedStr = (typeof inv.total === 'number' ? formatCurrency(inv.total) : '').toLowerCase();
                const statusStr = String(getDisplayStatus(inv) || '').toLowerCase();
                const rectifiedStr = (inv.rectifiedBy
                    ? `rectified by #${inv.rectifiedBy}`
                    : (inv.isRectified || inv.status === InvoiceStatus.Rectified)
                        ? 'rectified'
                        : '').toLowerCase();

                return (
                    numberStr.includes(q) ||
                    rawDateStr.includes(q) ||
                    formattedDateStr.includes(q) ||
                    customerStr.includes(q) ||
                    amountRawStr.includes(q) ||
                    amountFormattedStr.includes(q) ||
                    statusStr.includes(q) ||
                    rectifiedStr.includes(q) ||
                    notesStr.includes(q) ||
                    emailStr.includes(q)
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
            const blob = await generateInvoicePDF(invoice, companyInfo);
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
                        <Button onClick={handleGrantAccess} disabled={isLoading || !isFSA}>{isLoading ? 'Processing…' : (isFSA ? 'Grant Folder Access' : 'Folder Access Not Supported') }</Button>
                        {!isFSA && (
                            <div className="text-sm text-neutral-600">
                                Your browser does not support selecting a local folder. On Firefox, this feature is unavailable.
                                You can still use the app to generate and download PDFs, or switch to a Chromium-based browser (Chrome, Edge, Brave) to enable folder access.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 h-[calc(100vh-4rem)] box-border flex flex-col">
            <Card className="flex-1 flex min-h-0">
                <CardHeader className="shrink-0">
                    <CardTitle>Invoices</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col space-y-3">
                    <InvoicesFilters
                        query={query}
                        setQuery={setQuery}
                        status={status}
                        setStatus={setStatus}
                        customers={customers}
                        customer={customer}
                        setCustomer={setCustomer}
                        dateRange={dateRange}
                        setDateRange={setDateRange}
                        fromDate={fromDate}
                        toDate={toDate}
                        setFromDate={setFromDate}
                        setToDate={setToDate}
                        perPage={perPage}
                        setPerPage={setPerPage}
                        resetFilters={resetFilters}
                    />

                    <div className="flex-1 min-h-0">
                        <InvoicesTable
                            invoices={current}
                            isLoading={isLoading}
                            onTogglePaid={togglePaid}
                            onDownload={download}
                            onRectify={setConfirmRectifyFor}
                            onDelete={setConfirmDeleteFor}
                        />
                    </div>

                    <InvoicesPagination page={page} totalPages={totalPages} setPage={setPage} />
                    
                    <RectifyDialog
                        open={!!confirmRectifyFor}
                        invoice={confirmRectifyFor}
                        isLoading={isLoading}
                        onCancel={() => setConfirmRectifyFor(null)}
                        onConfirm={performRectify}
                    />

                    <DeleteDialog
                        open={!!confirmDeleteFor}
                        invoice={confirmDeleteFor}
                        isLoading={isLoading}
                        onCancel={() => setConfirmDeleteFor(null)}
                        onConfirm={performDelete}
                    />
                </CardContent>
            </Card>
        </div>
    );
}


