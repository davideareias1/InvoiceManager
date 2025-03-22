'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Search, Check, Trash2 } from 'lucide-react';
import { SavedInvoice, deleteInvoice, loadInvoices, loadInvoicesSync, searchInvoices } from '../utils/invoiceUtils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { formatDateStringShort } from '../utils/dateUtils';
import { formatAmount } from '../utils/moneyUtils';
import { Badge } from './ui/badge';
import { showError, showSuccess } from '../utils/notifications';

interface InvoiceSelectorProps {
    onSelect: (invoice: SavedInvoice) => void;
}

export default function InvoiceSelector({ onSelect }: InvoiceSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<SavedInvoice | null>(null);
    const selectorRef = useRef<HTMLDivElement>(null);

    // Load invoices on component mount
    useEffect(() => {
        // Start with sync loading for immediate response
        setInvoices(loadInvoicesSync());

        // Then load async for complete data
        const loadAsync = async () => {
            const asyncInvoices = await loadInvoices();
            setInvoices(asyncInvoices);
        };

        loadAsync();
    }, []);

    // Update search results when query changes
    useEffect(() => {
        if (searchQuery) {
            setInvoices(searchInvoices(searchQuery));
        } else {
            // Start with sync loading for immediate response
            setInvoices(loadInvoicesSync());

            // Then load async for complete data
            const loadAsync = async () => {
                const asyncInvoices = await loadInvoices();
                setInvoices(asyncInvoices);
            };

            loadAsync();
        }
    }, [searchQuery]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Handle invoice selection
    const handleSelectInvoice = (invoice: SavedInvoice) => {
        onSelect(invoice);
        setShowResults(false);
        setSearchQuery('');
    };

    // Handle invoice deletion
    const handleDeleteInvoice = async () => {
        if (!invoiceToDelete) return;

        try {
            await deleteInvoice(invoiceToDelete.id);
            const updatedInvoices = await loadInvoices();
            setInvoices(updatedInvoices);
            setIsDeleteDialogOpen(false);
            setInvoiceToDelete(null);
            showSuccess('Invoice deleted successfully');
        } catch (error) {
            console.error('Error deleting invoice:', error);
            showError('Failed to delete invoice');
        }
    };

    // Open delete confirmation dialog
    const confirmDelete = (invoice: SavedInvoice, event: React.MouseEvent) => {
        event.stopPropagation();
        setInvoiceToDelete(invoice);
        setIsDeleteDialogOpen(true);
    };

    return (
        <div className="relative mb-4" ref={selectorRef}>
            <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search invoices..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowResults(true);
                        }}
                        onFocus={() => setShowResults(true)}
                        className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            </div>

            {showResults && invoices.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-80 overflow-auto">
                    {invoices.map((invoice) => (
                        <div
                            key={invoice.id}
                            className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 flex justify-between items-start"
                            onClick={() => handleSelectInvoice(invoice)}
                        >
                            <div className="flex-1">
                                <div className="font-medium flex items-center gap-2">
                                    <span>
                                        {invoice.invoiceNumber || 'No Invoice Number'}
                                    </span>
                                    {invoice.status && (
                                        <Badge
                                            className={`text-xs ${invoice.status === 'draft' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' :
                                                invoice.status === 'sent' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                                                    invoice.status === 'paid' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                                                        invoice.status === 'overdue' ? 'bg-red-100 text-red-800 hover:bg-red-100' :
                                                            'bg-gray-100 text-gray-800 hover:bg-gray-100'
                                                }`}
                                        >
                                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                    {invoice.customerName || 'No Customer'}
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                    <div className="text-xs text-gray-500">
                                        {invoice.date ? formatDateStringShort(invoice.date) : 'No Date'}
                                    </div>
                                    <div className="text-sm font-semibold">
                                        {formatAmount(invoice.totalAmount || 0)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-full"
                                    onClick={(e) => confirmDelete(invoice, e)}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-full"
                                >
                                    <Check className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showResults && searchQuery && invoices.length === 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg p-4 text-center">
                    <p className="text-gray-500">No invoices found</p>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Invoice</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete invoice{' '}
                            <span className="font-semibold">
                                {invoiceToDelete?.invoiceNumber || 'this invoice'}
                            </span>
                            ? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteInvoice}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
} 