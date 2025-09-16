// ===== IMPORTS =====
import React, { useReducer } from 'react';
import { CustomerForm } from './CustomerForm';
import { InvoiceItems } from './InvoiceItems';
import { InvoiceSidebar } from './InvoiceSidebar';
import type { InvoiceFormState, InvoiceFormAction, Totals } from './types';
import type { CustomerData, ProductData } from '@/domain/models';

// ===== PROPS =====

interface InvoiceFormProps {
    allCustomers: CustomerData[];
    allProducts: ProductData[];
    plannedNumber: string;
    taxRate: number;
    isVatEnabled: boolean;
    isBusy: boolean;
    initialState: InvoiceFormState;
    totals: Totals;
    isValid: boolean;
    matchedCustomer: CustomerData | null;
    isEditingClient: boolean;
    setIsEditingClient: (isEditing: boolean) => void;
    
    onUpdateCustomer: () => Promise<void>;
    onRememberCustomer: () => Promise<void>;
    onRememberProduct: (index: number) => Promise<void>;
    onInsertThisMonthHours: () => Promise<void>;
    onPreview: () => void;
    
    dispatch: React.Dispatch<InvoiceFormAction>;
    formState: InvoiceFormState;
}

// ===== COMPONENT =====

export function InvoiceForm({
    allCustomers,
    allProducts,
    plannedNumber,
    taxRate,
    isVatEnabled,
    isBusy,
    totals,
    isValid,
    matchedCustomer,
    isEditingClient,
    setIsEditingClient,
    onUpdateCustomer,
    onRememberCustomer,
    onRememberProduct,
    onInsertThisMonthHours,
    onPreview,
    dispatch,
    formState,
}: InvoiceFormProps) {

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left column: Customer + Items */}
                <div className="md:col-span-8 space-y-6">
                    <CustomerForm
                        formState={formState}
                        dispatch={dispatch}
                        allCustomers={allCustomers}
                        matchedCustomer={matchedCustomer}
                        isEditingClient={isEditingClient}
                        setIsEditingClient={setIsEditingClient}
                        onUpdateCustomer={onUpdateCustomer}
                        onRememberCustomer={onRememberCustomer}
                        isVatEnabled={isVatEnabled}
                        isBusy={isBusy}
                    />
                    <InvoiceItems
                        formState={formState}
                        dispatch={dispatch}
                        allProducts={allProducts}
                        onRememberProduct={onRememberProduct}
                        onInsertThisMonthHours={onInsertThisMonthHours}
                        canInsertHours={!!matchedCustomer}
                        isBusy={isBusy}
                    />
                </div>

                {/* Right column: Details + Totals + Actions */}
                <InvoiceSidebar
                    plannedNumber={plannedNumber}
                    formState={formState}
                    dispatch={dispatch}
                    totals={totals}
                    taxRate={taxRate}
                    onPreview={onPreview}
                    isBusy={isBusy}
                    isValid={isValid}
                />
            </div>
        </div>
    );
}
