// ===== IMPORTS =====
import React from 'react';
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

    return (
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <h3 className="text-base font-semibold text-neutral-900 mb-3">Invoice Details</h3>
            
            {/* Invoice Number */}
            <div className="mb-4">
                <label className="block text-xs font-medium text-neutral-600 mb-1">Invoice number</label>
                <div className="text-base font-mono font-semibold text-neutral-900 bg-neutral-100 p-2 rounded">
                    #{plannedNumber}
                </div>
            </div>
            
            {/* Invoice Dates */}
            <div className="space-y-3 mb-4">
                <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Invoice date</label>
                    <Input 
                        type="date" 
                        value={formState.invoiceDate} 
                        onChange={e => dispatch({ type: 'SET_FIELD', field: 'invoiceDate', value: e.target.value })}
                        className="text-sm h-8"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Due date</label>
                    <Input 
                        type="date" 
                        value={formState.dueDate} 
                        onChange={e => dispatch({ type: 'SET_FIELD', field: 'dueDate', value: e.target.value })}
                        className="text-sm h-8"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Notes (optional)</label>
                    <Input 
                        placeholder="Additional notes for this invoice..." 
                        value={formState.notes} 
                        onChange={e => dispatch({ type: 'SET_FIELD', field: 'notes', value: e.target.value })}
                        className="text-sm h-8"
                    />
                </div>
            </div>

            {/* Summary */}
            <div className="border-t border-neutral-200 pt-4">
                <h4 className="text-sm font-semibold text-neutral-900 mb-3">Summary</h4>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-neutral-600">Subtotal</span>
                        <span className="font-medium">€{totals.subtotal.toFixed(2)}</span>
                    </div>
                    {taxRate > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-neutral-600">VAT ({taxRate}%)</span>
                            <span className="font-medium">€{totals.taxAmount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="border-t border-neutral-200 pt-2 mt-3">
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span>€{totals.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                {/* Action Button */}
                <div className="mt-4 pt-4 border-t border-neutral-200">
                    <Button
                        onClick={onPreview}
                        disabled={isBusy || !isValid}
                        className="w-full bg-neutral-900 hover:bg-neutral-800"
                        size="lg"
                    >
                        {isBusy ? 'Loading...' : 'Preview & Save'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
