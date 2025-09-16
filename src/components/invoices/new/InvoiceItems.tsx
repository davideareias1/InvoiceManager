// ===== IMPORTS =====
import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { InvoiceItemsProps } from './types';
import type { ItemForm } from './types';

// ===== COMPONENT =====

export function InvoiceItems({
    formState,
    dispatch,
    allProducts,
    onRememberProduct,
    onInsertThisMonthHours,
    canInsertHours,
    isBusy,
}: InvoiceItemsProps) {
    const [openProductSuggestIndex, setOpenProductSuggestIndex] = useState<number | null>(null);
    const productInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

    const filteredProducts = (query: string) => {
        const q = query.trim().toLowerCase();
        if (!q) return allProducts.slice(0, 8);
        return allProducts.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
    };

    const onPickProductByName = (index: number, name: string) => {
        const product = allProducts.find(p => p.name.toLowerCase() === name.toLowerCase());
        const patch: Partial<ItemForm> = { name };
        if (product) {
            patch.price = Number(product.price) || 0;
            patch.description = product.description || '';
        }
        dispatch({ type: 'UPDATE_ITEM', index, payload: patch });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-neutral-900">Items</h3>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => dispatch({ type: 'ADD_ITEM' })}>
                        + Add item
                    </Button>
                    <Button type="button" variant="secondary" onClick={onInsertThisMonthHours} disabled={!canInsertHours}>
                        Insert this month hours
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {formState.items.map((it, idx) => (
                    <div key={idx} className="p-4 border border-neutral-200 rounded-lg bg-neutral-50 space-y-3">
                        {/* Product/Service Input */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-neutral-700 mb-2">Product/Service</label>
                                <div className="relative">
                                    <Popover open={openProductSuggestIndex === idx} onOpenChange={(o) => setOpenProductSuggestIndex(o ? idx : null)}>
                                        <PopoverTrigger asChild>
                                            <Input
                                                ref={el => { productInputRefs.current[idx] = el; }}
                                                placeholder="Search or type product..."
                                                value={it.name}
                                                onChange={e => {
                                                    onPickProductByName(idx, e.target.value);
                                                    setOpenProductSuggestIndex(idx);
                                                }}
                                                onFocus={() => setOpenProductSuggestIndex(idx)}
                                                className="w-full"
                                            />
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" align="start">
                                            <Command>
                                                <CommandInput 
                                                    placeholder="Search products..." 
                                                    value={it.name} 
                                                    onValueChange={v => onPickProductByName(idx, v)} 
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No results.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredProducts(it.name).map(p => (
                                                            <CommandItem
                                                                key={p.id}
                                                                value={p.name}
                                                                onSelect={() => {
                                                                    dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { name: p.name, price: Number(p.price) || 0, description: p.description || '' } });
                                                                    setOpenProductSuggestIndex(null);
                                                                    productInputRefs.current[idx]?.blur();
                                                                }}
                                                            >
                                                                <div>
                                                                    <div className="font-medium">{p.name}</div>
                                                                    {p.description && (
                                                                        <div className="text-xs text-neutral-500 mt-1">{p.description}</div>
                                                                    )}
                                                                    <div className="text-xs text-neutral-600 mt-1">€{Number(p.price).toFixed(2)}</div>
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
                        </div>

                        {/* Quantity, Price, Description */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">Quantity</label>
                                <Input type="number" step="0.5" min="0" value={String(it.quantity)} onChange={e => dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { quantity: Number(e.target.value) } })} />
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
                                {it.name.trim() && !allProducts.find(p => p.name.toLowerCase() === it.name.trim().toLowerCase()) && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={isBusy}
                                        onClick={() => onRememberProduct(idx)}
                                        className="text-xs"
                                    >
                                        💾 Save product
                                    </Button>
                                )}
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
