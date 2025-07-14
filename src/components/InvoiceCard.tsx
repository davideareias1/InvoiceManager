'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, FileText, Mail, Trash2, Download, Eye, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Invoice } from '@/interfaces';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showConfirmation } from '@/utils/notifications';
import { Badge } from '@/components/ui/badge';

interface InvoiceCardProps {
    invoice: Invoice;
    onDelete?: (invoiceNumber: string) => Promise<void>;
    onViewPdf?: (invoice: Invoice) => Promise<void>;
    onSendEmail?: (invoice: Invoice) => Promise<void>;
    onRectify?: (invoice: Invoice) => Promise<void>;
}

export function InvoiceCard({ invoice, onDelete, onViewPdf, onSendEmail, onRectify }: InvoiceCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRectifying, setIsRectifying] = useState(false);

    // Calculate total
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const tax = subtotal * (invoice.tax_rate || 0 / 100);
    const total = subtotal + tax;

    // Determine if invoice is overdue
    const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && !invoice.is_paid;

    // Get invoice status
    const getInvoiceStatus = () => {
        if (invoice.isRectified) return { label: 'Rectified', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
        if (invoice.is_paid) return { label: 'Paid', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
        if (isOverdue) return { label: 'Overdue', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' };
        return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' };
    };

    const status = getInvoiceStatus();

    // Handle delete confirmation
    const handleDelete = async () => {
        if (!onDelete) return;

        const confirmed = await showConfirmation(
            `Are you sure you want to delete invoice #${invoice.invoice_number}?`,
            'Delete',
            'Cancel'
        );

        if (confirmed) {
            setIsDeleting(true);
            try {
                await onDelete(invoice.invoice_number);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    // Handle rectification confirmation
    const handleRectify = async () => {
        if (!onRectify) return;

        const confirmed = await showConfirmation(
            `Are you sure you want to rectify invoice #${invoice.invoice_number}?\n\nThis will create a cancellation invoice with negative amounts and then open the form to create a corrected invoice.`,
            'Rectify Invoice',
            'Cancel'
        );

        if (confirmed) {
            setIsRectifying(true);
            try {
                await onRectify(invoice);
            } finally {
                setIsRectifying(false);
            }
        }
    };

    return (
        <Card className={`w-full ${invoice.isRectified ? 'opacity-60 bg-gray-50' : ''}`}>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className={`text-lg ${invoice.isRectified ? 'text-gray-500 line-through' : ''}`}>
                            {invoice.client_name}
                        </CardTitle>
                        <CardDescription className={`mt-1 ${invoice.isRectified ? 'text-gray-400' : ''}`}>
                            Invoice #{invoice.invoice_number}
                            {invoice.isRectified && (
                                <span className="block text-xs text-gray-400 mt-1">
                                    Rectified by #{invoice.rectifiedBy}
                                </span>
                            )}
                        </CardDescription>
                    </div>
                    <Badge className={cn("ml-2", status.color)}>
                        {status.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="pb-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <p className="text-muted-foreground">Date:</p>
                        <p>{formatDate(invoice.invoice_date)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Due Date:</p>
                        <p>{formatDate(invoice.due_date || '')}</p>
                    </div>
                    <div className="col-span-2 mt-2">
                        <p className="text-muted-foreground">Amount:</p>
                        <p className="text-xl font-semibold">{formatCurrency(total)}</p>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="pt-2 flex justify-between">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/invoices/${invoice.invoice_number}`}>
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>View invoice details</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="flex gap-2">
                    {onViewPdf && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onViewPdf(invoice)}
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Download PDF</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                                asChild={!invoice.isRectified}
                                disabled={invoice.isRectified}
                                className={invoice.isRectified ? 'text-gray-400 cursor-not-allowed' : ''}
                            >
                                {invoice.isRectified ? (
                                    <span>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Cannot edit rectified invoice
                                    </span>
                                ) : (
                                    <Link href={`/invoices/${invoice.invoice_number}/edit`}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Edit Invoice
                                    </Link>
                                )}
                            </DropdownMenuItem>

                            {onRectify && (
                                <DropdownMenuItem
                                    onClick={handleRectify}
                                    disabled={isRectifying || invoice.isRectified}
                                    className={`${
                                        invoice.isRectified 
                                            ? 'text-gray-400 cursor-not-allowed' 
                                            : 'text-orange-600 focus:text-orange-600'
                                    }`}
                                >
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    {isRectifying ? 'Rectifying...' : 
                                     invoice.isRectified ? 'Cannot rectify rectified invoice' :
                                     'Rectify Invoice'}
                                </DropdownMenuItem>
                            )}

                            {onSendEmail && (
                                <DropdownMenuItem onClick={() => onSendEmail(invoice)}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send by Email
                                </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {onDelete && (
                                <DropdownMenuItem
                                    className="text-red-500 focus:text-red-500"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {isDeleting ? 'Deleting...' : 'Delete Invoice'}
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardFooter>
        </Card>
    );
} 