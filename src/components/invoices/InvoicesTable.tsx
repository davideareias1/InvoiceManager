"use client";

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Invoice, InvoiceStatus } from '@/domain/models';
import { formatCurrency, formatDate } from '@/shared/formatters';
import { getDisplayStatus, getValidActions, isRectificationInvoice } from '@/application/invoices/presentation';

export type InvoicesTableProps = {
    invoices: Invoice[];
    isLoading: boolean;
    onTogglePaid: (invoice: Invoice) => void;
    onDownload: (invoice: Invoice) => void;
    onRectify: (invoice: Invoice) => void;
    onDelete: (invoice: Invoice) => void;
};

export function InvoicesTable({ invoices, isLoading, onTogglePaid, onDownload, onRectify, onDelete }: InvoicesTableProps) {
    return (
        <div className="h-full overflow-auto">
            <Table className="table-fixed">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[10%]">Number</TableHead>
                        <TableHead className="w-[10%]">Date</TableHead>
                        <TableHead className="w-[20%]">Customer</TableHead>
                        <TableHead className="w-[10%]">Amount</TableHead>
                        <TableHead className="w-[10%]">Status</TableHead>
                        <TableHead className="w-[30%]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="py-4">Loading…</TableCell>
                        </TableRow>
                    ) : invoices.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="py-4">No invoices found.</TableCell>
                        </TableRow>
                    ) : invoices.map(inv => (
                        <TableRow
                            key={inv.id}
                            className={
                                isRectificationInvoice(inv)
                                    ? 'bg-zinc-200 dark:bg-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-200 cursor-default'
                                    : (inv.status === InvoiceStatus.Rectified || inv.isRectified)
                                        ? 'bg-zinc-200 dark:bg-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-200 cursor-default'
                                        : undefined
                            }
                        >
                            <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                            <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                            <TableCell>{inv.customer?.name || '-'}</TableCell>
                            <TableCell>{formatCurrency(inv.total)}</TableCell>
                            <TableCell>{getDisplayStatus(inv)}{(inv.status === InvoiceStatus.Rectified || inv.isRectified) && inv.rectifiedBy ? ` (rectified by #${inv.rectifiedBy})` : ''}</TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-2">
                                    {(() => {
                                        const actions = getValidActions(inv);
                                        return (
                                            <>
                                                {actions.canMarkPaid && (
                                                    <Button size="sm" variant="outline" className="w-24" onClick={() => onTogglePaid(inv)}>
                                                        {inv.is_paid ? 'Mark unpaid' : 'Mark paid'}
                                                    </Button>
                                                )}
                                                {actions.canDownload && (
                                                    <Button size="sm" variant="outline" className="w-24" onClick={() => onDownload(inv)}>
                                                        Download
                                                    </Button>
                                                )}
                                                {actions.canRectify && (
                                                    <Button size="sm" variant="outline" className="w-24" onClick={() => onRectify(inv)}>
                                                        Rectify
                                                    </Button>
                                                )}
                                                {actions.canDelete && (
                                                    <Button size="sm" variant="destructive" className="w-24" onClick={() => onDelete(inv)}>
                                                        Delete
                                                    </Button>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}


