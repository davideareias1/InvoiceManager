"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Invoice } from '@/domain/models';

export type DeleteDialogProps = {
    open: boolean;
    invoice: Invoice | null;
    isLoading: boolean;
    onCancel: () => void;
    onConfirm: (invoice: Invoice) => void;
};

export function DeleteDialog({ open, invoice, isLoading, onCancel, onConfirm }: DeleteDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete invoice #{invoice?.invoice_number}</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the invoice from your storage.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={isLoading} onClick={() => invoice && onConfirm(invoice)}>
                        Delete invoice
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}


