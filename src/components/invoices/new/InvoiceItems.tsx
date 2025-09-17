// ===== IMPORTS =====
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import type { InvoiceItemsProps } from './types';
import type { ItemForm } from './types';

// ===== COMPONENT =====

export function InvoiceItems({
    formState,
    dispatch,
    allProducts,
    onApplyMonthlyHoursToItem,
}: InvoiceItemsProps) {
    const roundToStep = (value: number, step: number) => {
        if (!Number.isFinite(value)) return 0;
        return Math.round(value / step) * step;
    };
    const [openIndex, setOpenIndex] = React.useState<number | null>(null);
    const onSelectProduct = (index: number, productName: string) => {
        const product = allProducts.find(p => p.name === productName);
        if (product) {
            dispatch({
                type: 'UPDATE_ITEM',
                index,
                payload: {
                    name: product.name,
                    price: Number(product.price) || 0,
                    description: product.description || ''
                }
            });
            setOpenIndex(null);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-neutral-200 p-4 flex flex-col" style={{ height: '400px' }}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-neutral-900">Invoice Items</h3>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => dispatch({ type: 'ADD_ITEM' })}
                    className="h-8 px-3 text-xs"
                >
                    + Add Item
                </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto space-y-2 pr-2">
                {formState.items.map((it, idx) => (
                    <div key={idx} className="border border-neutral-200 rounded-md p-3 bg-neutral-50">
                        {/* Product Selection Row */}
                        <div className="mb-2">
                            <Popover open={openIndex === idx} onOpenChange={(o) => setOpenIndex(o ? idx : null)}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openIndex === idx}
                                        className="w-full justify-between h-8 text-sm"
                                    >
                                        <span className="truncate pr-2">
                                            {it.name ? it.name : 'Select product/service...'}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="start" sideOffset={4} className="w-[520px] max-w-[95vw] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search products..." />
                                        <CommandEmpty>No product found.</CommandEmpty>
                                        <CommandList className="max-h-72 overflow-auto">
                                            <CommandGroup>
                                                <CommandItem
                                                    key="__monthly_hours__"
                                                    value="Monthly hours (x h)"
                                                    onSelect={() => {
                                                        setOpenIndex(null);
                                                        onApplyMonthlyHoursToItem(idx);
                                                    }}
                                                    className="py-2"
                                                >
                                                    <div className="flex items-start gap-2 w-full">
                                                        <Check className={'mt-0.5 h-4 w-4 opacity-0'} />
                                                        <div className="flex flex-col text-left">
                                                            <div className="font-medium leading-5">Monthly hours (x h)</div>
                                                            <div className="text-xs text-neutral-500 leading-4">Insert tracked hours for selected month</div>
                                                        </div>
                                                    </div>
                                                </CommandItem>
                                                {allProducts.map(product => (
                                                    <CommandItem
                                                        key={product.id}
                                                        value={product.name}
                                                        onSelect={(value) => onSelectProduct(idx, value)}
                                                        className="py-2"
                                                    >
                                                        <div className="flex items-start gap-2 w-full">
                                                            <Check className={'mt-0.5 h-4 w-4 ' + (product.name === it.name ? 'opacity-100' : 'opacity-0')} />
                                                            <div className="flex flex-col text-left">
                                                                <div className="font-medium leading-5">{product.name}</div>
                                                                {product.description && (
                                                                    <div className="text-xs text-neutral-500 leading-4">{product.description}</div>
                                                                )}
                                                                <div className="text-xs text-neutral-600 leading-4">€{Number(product.price).toFixed(2)}</div>
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

                        {/* Quantity, Price, Description Row */}
                        <div className="grid grid-cols-11 gap-2 items-center">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Qty</label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={String(it.quantity)}
                                    onChange={e => {
                                        const raw = Number(e.target.value);
                                        const rounded = Math.max(0, roundToStep(raw, 0.5));
                                        dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { quantity: rounded } });
                                    }}
                                    className="text-sm h-8"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Price €</label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    value={String(it.price)} 
                                    onChange={e => dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { price: Number(e.target.value) } })}
                                    className="text-sm h-8"
                                />
                            </div>
                            <div className="col-span-5">
                                <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
                                <Input 
                                    placeholder="Additional details..." 
                                    value={it.description || ''} 
                                    onChange={e => dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { description: e.target.value } })}
                                    className="text-sm h-8"
                                />
                            </div>
                            <div className="col-span-2 flex flex-col items-end">
                                <div className="text-xs font-medium text-neutral-900 mb-1">
                                    €{(Number(it.quantity) * Number(it.price)).toFixed(2)}
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => dispatch({ type: 'REMOVE_ITEM', index: idx })}
                                    disabled={formState.items.length === 1}
                                    className="h-6 w-6 p-0 text-neutral-500 hover:text-red-600"
                                >
                                    ×
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
}
