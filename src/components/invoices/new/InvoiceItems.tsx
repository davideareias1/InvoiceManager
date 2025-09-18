// ===== IMPORTS =====
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Unlink2, RotateCcw, Save } from 'lucide-react';
import type { InvoiceItemsProps } from './types';
import type { ItemForm } from './types';
import type { ProductData } from '@/domain/models';
import { showSuccess, showError } from '@/shared/notifications';

// ===== COMPONENT =====

export function InvoiceItems({
    formState,
    dispatch,
    allProducts,
    onApplyMonthlyHoursToItem,
    onSaveProduct,
    onRefreshTimeLinkedItem,
}: InvoiceItemsProps) {
    const roundToStep = (value: number, step: number) => {
        if (!Number.isFinite(value)) return 0;
        return Math.round(value / step) * step;
    };
    const [openIndex, setOpenIndex] = React.useState<number | null>(null);
    const [queryByIndex, setQueryByIndex] = React.useState<Record<number, string>>({});

    const boundProductForItem = (item: ItemForm): ProductData | undefined => {
        if (item.id) return allProducts.find(p => p.id === item.id);
        if (item.name) return allProducts.find(p => p.name === item.name);
        return undefined;
    };

    const onSelectProduct = (index: number, productName: string) => {
        const product = allProducts.find(p => p.name === productName);
        if (product) {
            dispatch({
                type: 'UPDATE_ITEM',
                index,
                payload: {
                    id: product.id,
                    name: product.name,
                    price: Number(product.price) || 0,
                    description: product.description || ''
                }
            });
            setOpenIndex(null);
        }
    };

    const createProductFromItem = async (index: number, item: ItemForm) => {
        try {
            const saved = await onSaveProduct({ name: String(item.name || '').trim(), price: Number(item.price) || 0, description: item.description || '' });
            dispatch({ type: 'UPDATE_ITEM', index, payload: { id: saved.id, name: saved.name, price: Number(saved.price) || 0, description: saved.description || '' } });
            showSuccess('Product saved');
        } catch (e) {
            console.error(e);
            showError('Failed to save product');
        }
    };

    const updateBoundProductFromItem = async (index: number, item: ItemForm, product: ProductData) => {
        try {
            await onSaveProduct({ id: product.id, name: item.name, price: Number(item.price) || 0, description: item.description || '' });
            showSuccess('Product updated');
        } catch (e) {
            console.error(e);
            showError('Failed to update product');
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
                    <div key={`${idx}-${it.name}-${it.quantity}-${it.price}-${it.timeLink ? `${it.timeLink.customerId}-${it.timeLink.year}-${it.timeLink.month}` : ''}`} className="border border-neutral-200 rounded-md p-3 bg-neutral-50">
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
                                        <CommandInput
                                            placeholder="Search or type a new product..."
                                            value={queryByIndex[idx] ?? ''}
                                            onValueChange={(v: string) => setQueryByIndex(q => ({ ...q, [idx]: v }))}
                                        />
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
                                                {(queryByIndex[idx] || '').trim() && !allProducts.some(p => p.name.toLowerCase() === (queryByIndex[idx] || '').trim().toLowerCase()) && (
                                                    <CommandItem
                                                        key="__use_custom__"
                                                        value={`Add "${(queryByIndex[idx] || '').trim()}" as one-time item`}
                                                        onSelect={() => {
                                                            const name = (queryByIndex[idx] || '').trim();
                                                            setOpenIndex(null);
                                                            dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { id: undefined, name, price: 0, description: '' } });
                                                        }}
                                                        className="py-2"
                                                    >
                                                        <div className="flex items-start gap-2 w-full">
                                                            <Unlink2 className="mt-0.5 h-4 w-4" />
                                                            <div className="flex flex-col text-left">
                                                                <div className="font-medium leading-5">Add "{(queryByIndex[idx] || '').trim()}" as one-time item</div>
                                                                <div className="text-xs text-neutral-500 leading-4">Use for this invoice only</div>
                                                            </div>
                                                        </div>
                                                    </CommandItem>
                                                )}
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

                        {/* Time link badge and refresh */}
                        {it.timeLink && (
                            <div className="mt-2 flex items-center justify-between text-xs">
                                <div className="text-neutral-600">
                                    Linked to time: {it.timeLink.customerName || '—'} {it.timeLink.year}-{String(it.timeLink.month).padStart(2, '0')}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs"
                                        onClick={() => onRefreshTimeLinkedItem?.(idx)}
                                    >
                                        Refresh hours
                                    </Button>
                                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                        onClick={() => dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { timeLink: undefined } })}
                                    >
                                        Unlink
                                    </Button>
                                </div>
                            </div>
                        )}

                        {(() => {
                            const bound = boundProductForItem(it);
                            if (!bound) return null;
                            const priceChanged = Number(it.price) !== Number(bound.price);
                            const descChanged = (it.description || '') !== (bound.description || '');
                            if (!priceChanged && !descChanged) return null;
                            return (
                                <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
                                        <span className="font-medium">Changes detected</span>
                                        <span>for product "{bound.name}". Update product?</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => updateBoundProductFromItem(idx, it, bound)}
                                        >
                                            <Save className="h-3.5 w-3.5 mr-1" /> Update product
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { id: undefined } })}
                                        >
                                            <Unlink2 className="h-3.5 w-3.5 mr-1" /> Detach item
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => dispatch({ type: 'UPDATE_ITEM', index: idx, payload: { price: bound.price, description: bound.description || '' } })}
                                        >
                                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Revert to product
                                        </Button>
                                        {null}
                                    </div>
                                </div>
                            );
                        })()}

                        {(() => {
                            const bound = boundProductForItem(it);
                            if (bound) return null;
                            if (!it.name?.trim()) return null;
                            return (
                                <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-blue-900">
                                        <span className="font-medium">One-time item</span>
                                        <span>Save as reusable product for future invoices?</span>
                                    </div>
                                    <div className="mt-2">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="h-7 px-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-900"
                                            onClick={() => createProductFromItem(idx, it)}
                                        >
                                            <Save className="h-3.5 w-3.5 mr-1" /> Save as product
                                        </Button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ))}
            </div>

        </div>
    );
}
