// ===== IMPORTS =====
import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { InvoiceSidebarProps } from './types';

// ===== COMPONENT =====

export function InvoiceSidebar({
    plannedNumber,
    formState,
    dispatch,
    totals,
    taxRate,
    onPreview,
    isBusy,
    isValid,
}: InvoiceSidebarProps) {
    const router = useRouter();

    return (
        <div className="md:col-span-4 space-y-6">
            <div className="rounded-lg border border-neutral-200 p-4 bg-white shadow-sm">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Invoice details</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Invoice number</label>
                        <div className="text-lg font-mono font-semibold text-neutral-900 bg-neutral-100 p-2 rounded">
                            #{plannedNumber}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Invoice date</label>
                        <Input 
                            type="date" 
                            value={formState.invoiceDate} 
                            onChange={e => dispatch({ type: 'SET_FIELD', field: 'invoiceDate', value: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Due date</label>
                        <Input 
                            type="date" 
                            value={formState.dueDate} 
                            onChange={e => dispatch({ type: 'SET_FIELD', field: 'dueDate', value: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-neutral-200 p-4 bg-white shadow-sm">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Summary</h3>
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-neutral-600">Subtotal</span>
                        <span className="font-medium">€{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-neutral-600">VAT ({taxRate}%)</span>
                        <span className="font-medium">€{totals.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-neutral-300 pt-3">
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span>€{totals.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <Button
                    onClick={onPreview}
                    disabled={isBusy || !isValid}
                    size="lg"
                    className="w-full"
                >
                    {isBusy ? 'Loading...' : 'Preview Invoice'}
                </Button>
                <Button
                    variant="outline"
                    onClick={() => router.push('/invoices')}
                    size="lg"
                    className="w-full"
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
}
