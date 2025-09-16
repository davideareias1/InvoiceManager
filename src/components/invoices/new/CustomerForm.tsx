// ===== IMPORTS =====
import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Pencil, Save } from 'lucide-react';
import type { CustomerFormProps } from './types';

// ===== COMPONENT =====

export function CustomerForm({
    formState,
    dispatch,
    allCustomers,
    matchedCustomer,
    isEditingClient,
    setIsEditingClient,
    onUpdateCustomer,
    onRememberCustomer,
    isVatEnabled,
    isBusy,
}: CustomerFormProps) {
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState<boolean>(false);
    const customerInputRef = useRef<HTMLInputElement>(null);

    const filteredCustomers = useMemo(() => {
        const q = formState.customerName.trim().toLowerCase();
        if (!q) return allCustomers.slice(0, 8);
        return allCustomers.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
    }, [allCustomers, formState.customerName]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">Customer</h3>
                {matchedCustomer && (
                    isEditingClient ? (
                        <Button variant="outline" size="sm" onClick={onUpdateCustomer} disabled={isBusy}>
                            <Save className="h-4 w-4 mr-2" />
                            Save changes
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => setIsEditingClient(true)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    )
                )}
            </div>

            <div className="space-y-3">
                <div className="relative">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Customer</label>
                    <Popover open={showCustomerSuggestions} onOpenChange={setShowCustomerSuggestions}>
                        <PopoverTrigger asChild>
                            <Input
                                ref={customerInputRef}
                                placeholder="Search or type customer..."
                                value={formState.customerName}
                                onChange={e => {
                                    dispatch({ type: 'SET_FIELD', field: 'customerName', value: e.target.value });
                                    setShowCustomerSuggestions(true);
                                }}
                                onFocus={() => setShowCustomerSuggestions(true)}
                                className="w-full"
                            />
                        </PopoverTrigger>
                        <PopoverContent className="p-0" align="start">
                            <Command>
                                <CommandInput 
                                    placeholder="Search customers..." 
                                    value={formState.customerName} 
                                    onValueChange={v => dispatch({ type: 'SET_FIELD', field: 'customerName', value: v })} 
                                />
                                <CommandList>
                                    <CommandEmpty>No results.</CommandEmpty>
                                    <CommandGroup>
                                        {filteredCustomers.map(c => (
                                            <CommandItem
                                                key={c.id}
                                                value={c.name}
                                                onSelect={() => {
                                                    dispatch({
                                                        type: 'SET_ALL_FIELDS',
                                                        payload: {
                                                            customerName: c.name,
                                                            customerAddress: c.address || '',
                                                            customerCity: c.city || '',
                                                            hourlyRate: typeof (c as any).hourlyRate === 'number' ? String((c as any).hourlyRate) : '',
                                                        }
                                                    });
                                                    setShowCustomerSuggestions(false);
                                                    customerInputRef.current?.blur();
                                                }}
                                            >
                                                <div>
                                                    <div className="font-medium">{c.name}</div>
                                                    {(c.address || c.city) && (
                                                        <div className="text-xs text-neutral-500 mt-1">{c.address} {c.city}</div>
                                                    )}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Address</label>
                        <Input 
                            placeholder="Street and number" 
                            value={formState.customerAddress} 
                            onChange={e => dispatch({ type: 'SET_FIELD', field: 'customerAddress', value: e.target.value })} 
                            disabled={!!matchedCustomer && !isEditingClient} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">City/ZIP</label>
                        <Input 
                            placeholder="City, ZIP" 
                            value={formState.customerCity} 
                            onChange={e => dispatch({ type: 'SET_FIELD', field: 'customerCity', value: e.target.value })} 
                            disabled={!!matchedCustomer && !isEditingClient} 
                        />
                    </div>
                </div>

                {isVatEnabled && (
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Customer VAT ID (optional)</label>
                        <Input 
                            placeholder="e.g., DE123456789" 
                            value={formState.clientVatId} 
                            onChange={e => dispatch({ type: 'SET_FIELD', field: 'clientVatId', value: e.target.value })} 
                            className="max-w-sm" 
                            disabled={!!matchedCustomer && !isEditingClient} 
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Hourly rate (€)</label>
                    <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        placeholder="e.g., 80" 
                        value={formState.hourlyRate} 
                        onChange={e => dispatch({ type: 'SET_FIELD', field: 'hourlyRate', value: e.target.value })} 
                        className="max-w-xs" 
                        disabled={!!matchedCustomer && !isEditingClient} 
                    />
                </div>

                {formState.customerName.trim() && !matchedCustomer && (
                    <div className="flex justify-start">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isBusy}
                            onClick={onRememberCustomer}
                            className="text-sm"
                        >
                            💾 Save "{formState.customerName}" as new customer
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
