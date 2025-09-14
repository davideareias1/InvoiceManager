"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Invoice } from '@/domain/models';

export type RectifyDialogProps = {
    open: boolean;
    invoice: Invoice | null;
    isLoading: boolean;
    onCancel: () => void;
    onConfirm: (invoice: Invoice) => void;
};

export function RectifyDialog({ open, invoice, isLoading, onCancel, onConfirm }: RectifyDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Rectify invoice #{invoice?.invoice_number}</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will create a rectification (negative) invoice and mark the original as rectified.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction disabled={isLoading} onClick={() => invoice && onConfirm(invoice)}>
                        Create rectification
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}


