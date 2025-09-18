// ===== IMPORTS =====
import React from 'react';
import { InvoiceItems } from './InvoiceItems';
import { InvoiceSidebar } from './InvoiceSidebar';
import type { InvoiceFormState, InvoiceFormAction, Totals } from './types';
import type { CustomerData, ProductData } from '@/domain/models';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';

// ===== PROPS =====

interface InvoiceFormProps {
    allCustomers: CustomerData[];
    allProducts: ProductData[];
    plannedNumber: string;
    taxRate: number;
    isBusy: boolean;
    totals: Totals;
    isValid: boolean;
    onApplyMonthlyHoursToItem: (index: number) => Promise<void>;
    onSaveProduct: (product: Partial<ProductData>) => Promise<ProductData>;
    onPreview: () => void;
    
    dispatch: React.Dispatch<InvoiceFormAction>;
    formState: InvoiceFormState;
    onRefreshTimeLinkedItem?: (index: number) => void;
}

// ===== COMPONENT =====

export function InvoiceForm({
    allCustomers,
    allProducts,
    plannedNumber,
    taxRate,
    isBusy,
    totals,
    isValid,
    onApplyMonthlyHoursToItem,
    onSaveProduct,
    onPreview,
    dispatch,
    formState,
    onRefreshTimeLinkedItem,
}: InvoiceFormProps) {

    const [customerOpen, setCustomerOpen] = React.useState(false);
    const selectedCustomerName = formState.customerName;

    const onSelectCustomer = (value: string) => {
        const customer = allCustomers.find(c => c.name === value);
        if (customer) {
            dispatch({
                type: 'SET_ALL_FIELDS',
                payload: {
                    customerName: customer.name,
                    customerAddress: customer.address || '',
                    customerCity: customer.city || '',
                    hourlyRate: typeof (customer as any).hourlyRate === 'number' ? String((customer as any).hourlyRate) : '',
                }
            });
            setCustomerOpen(false);
        } else {
            dispatch({ type: 'SET_FIELD', field: 'customerName', value: value });
        }
    };

    return (
        <div className="h-full grid grid-cols-12 gap-4">
            {/* Left Column: Customer & Items */}
            <div className="col-span-8 flex flex-col gap-4">
                {/* Customer Selection */}
                <div className="bg-white rounded-lg border border-neutral-200 p-4">
                    <h3 className="text-base font-semibold text-neutral-900 mb-3">Customer</h3>
                    <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={customerOpen}
                                className="w-full justify-between h-10"
                            >
                                <span className="truncate pr-2">
                                    {selectedCustomerName ? selectedCustomerName : 'Select customer...'}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" sideOffset={4} className="w-[420px] max-w-[90vw] p-0">
                            <Command>
                                <CommandInput placeholder="Search customers..." />
                                <CommandEmpty>No customer found.</CommandEmpty>
                                <CommandList className="max-h-72 overflow-auto">
                                    <CommandGroup>
                                        {allCustomers.map((customer) => (
                                            <CommandItem
                                                key={customer.id}
                                                value={customer.name}
                                                onSelect={onSelectCustomer}
                                                className="py-2"
                                            >
                                                <div className="flex items-start gap-2 w-full">
                                                    <Check
                                                        className={
                                                            'mt-0.5 h-4 w-4 ' + (customer.name === selectedCustomerName ? 'opacity-100' : 'opacity-0')
                                                        }
                                                    />
                                                    <div className="flex flex-col text-left">
                                                        <div className="font-medium leading-5">{customer.name}</div>
                                                        {(customer.address || customer.city) && (
                                                            <div className="text-xs text-neutral-500 leading-4">
                                                                {customer.address} {customer.city}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Items Section */}
                <div>
                    <InvoiceItems
                        formState={formState}
                        dispatch={dispatch}
                        allProducts={allProducts}
                        onApplyMonthlyHoursToItem={onApplyMonthlyHoursToItem}
                        onSaveProduct={onSaveProduct}
                        onRefreshTimeLinkedItem={onRefreshTimeLinkedItem}
                    />
                </div>
            </div>

            {/* Right Column: Invoice Details & Summary */}
            <div className="col-span-4">
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
