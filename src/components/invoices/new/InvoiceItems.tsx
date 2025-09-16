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
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-neutral-900">Items</h3>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => dispatch({ type: 'ADD_ITEM' })}>
                        + Add item
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {formState.items.map((it, idx) => (
                    <div key={idx} className="p-4 border border-neutral-200 rounded-lg bg-neutral-50 space-y-3">
                        {/* Product/Service Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-neutral-700 mb-2">Product/Service</label>
                                <Popover open={openIndex === idx} onOpenChange={(o) => setOpenIndex(o ? idx : null)}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openIndex === idx}
                                            className="w-full justify-between"
                                        >
                                            <span className="truncate pr-2">
                                                {it.name ? it.name : 'Select product...'}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                        </div>

                        {/* Quantity, Price, Description */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">Quantity</label>
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
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">Unit price (€)</label>
                                <Input type="number" step="0.01" min="0" value={String(it.price)} onChange={e => dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { price: Number(e.target.value) } })} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-neutral-700 mb-2">Description (optional)</label>
                                <Input placeholder="Additional details..." value={it.description || ''} onChange={e => dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { description: e.target.value } })} />
                            </div>
                        </div>

                        {/* Item Total & Actions */}
                        <div className="flex justify-between items-center pt-2">
                            <div className="text-sm text-neutral-600">
                                Total: <span className="font-medium">€{(Number(it.quantity) * Number(it.price)).toFixed(2)}</span>
                            </div>
                            <div className="flex gap-2 items-center">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => dispatch({ type: 'REMOVE_ITEM', index: idx })}
                                    disabled={formState.items.length === 1}
                                >
                                    Remove
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Notes (optional)</label>
                <Input 
                    placeholder="Additional notes for this invoice..." 
                    value={formState.notes} 
                    onChange={e => dispatch({ type: 'SET_FIELD', field: 'notes', value: e.target.value })} 
                />
            </div>
        </div>
    );
}
