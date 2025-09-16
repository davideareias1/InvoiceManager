"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { getSavedDirectoryHandle, setDirectoryHandle as setFsHandle } from '@/infrastructure/filesystem/fileSystemStorage';
import { setDirectoryHandle as setCustomerHandle, loadCustomers, searchCustomers, saveCustomer } from '@/infrastructure/repositories/customerRepository';
import { setDirectoryHandle as setProductHandle, loadProducts, searchProducts, saveProduct } from '@/infrastructure/repositories/productRepository';
import { setDirectoryHandle as setInvoiceHandle, invoiceRepositoryAdapter } from '@/infrastructure/repositories/invoiceRepository';
import { setDirectoryHandle as setTimeHandle, loadMonth as loadTimeMonth } from '@/infrastructure/repositories/timeTrackingRepository';
import { CreateInvoice } from '@/application/usecases';
import { useCompany } from '@/infrastructure/contexts/CompanyContext';
import { generateInvoicePDF } from '@/infrastructure/pdf/pdfUtils';
import { addDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { CompanyInfo, CustomerData, Invoice, InvoiceItem, ProductData } from '@/domain/models';
import { showSuccess, showError } from '@/shared/notifications';
import { Pencil, Save } from 'lucide-react';
const PdfViewer = dynamic(() => import('@/components/PdfViewer').then(m => m.PdfViewer), { ssr: false });

type Step = 'edit' | 'preview';

interface ItemForm {
    id?: string;
    name: string;
    quantity: number;
    price: number;
    description?: string;
}

export default function NewInvoicePage() {
    const router = useRouter();
    const { isInitialized, hasPermission, requestPermission, loadInvoices } = useFileSystem();
    const { companyInfo } = useCompany();

    const [step, setStep] = useState<Step>('edit');
    const [isBusy, setIsBusy] = useState(false);
    const [isEditingClient, setIsEditingClient] = useState(false);
    const [allCustomers, setAllCustomers] = useState<CustomerData[]>([]);
    const [allProducts, setAllProducts] = useState<ProductData[]>([]);
    const [plannedNumber, setPlannedNumber] = useState<string>('—');
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState<boolean>(false);
    const [openProductSuggestIndex, setOpenProductSuggestIndex] = useState<number | null>(null);
    const customerInputRef = useRef<HTMLInputElement>(null);
    const productInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

    // Form state
    const [invoiceDate, setInvoiceDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [dueDate, setDueDate] = useState<string>(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
    const [customerName, setCustomerName] = useState<string>('');
    const [customerAddress, setCustomerAddress] = useState<string>('');
    const [customerCity, setCustomerCity] = useState<string>('');
    const [clientVatId, setClientVatId] = useState<string>('');
    const [hourlyRate, setHourlyRate] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [items, setItems] = useState<ItemForm[]>([{ name: '', quantity: 1, price: 0, description: '' }]);

    // PDF preview
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const previewUrlRef = useRef<string>('');

    const taxRate = useMemo(() => {
        if (!companyInfo.is_vat_enabled) return 0;
        return companyInfo.default_tax_rate ?? 0;
    }, [companyInfo]);

    const computedTotals = useMemo(() => {
        const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.price || 0)), 0);
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;
        return { subtotal, taxAmount, total };
    }, [items, taxRate]);

    useEffect(() => {
        const setup = async () => {
            if (!isInitialized) return;
            if (!hasPermission) return;
            try {
                const handle = await getSavedDirectoryHandle();
                if (handle) {
                    setFsHandle(handle);
                    setCustomerHandle(handle);
                    setProductHandle(handle);
                    setInvoiceHandle(handle);
                    setTimeHandle(handle);
                }
            } catch (e) {
                console.warn('Failed to sync directory handle:', e);
            }

            // Load reference data
            const [customers, products, invoices] = await Promise.all([
                loadCustomers(),
                loadProducts(),
                loadInvoices(),
            ]);
            setAllCustomers(customers.slice().sort((a, b) => a.name.localeCompare(b.name)));
            setAllProducts(products.slice().sort((a, b) => a.name.localeCompare(b.name)));

            // Compute planned next number without reserving it
            let maxNum = 0;
            invoices.forEach(inv => {
                const num = parseInt(inv.invoice_number, 10);
                if (!isNaN(num)) maxNum = Math.max(maxNum, num);
            });
            setPlannedNumber(String(maxNum + 1).padStart(3, '0'));
        };
        setup();
    }, [isInitialized, hasPermission, loadInvoices]);

    const handleGrantAccess = async () => {
        setIsBusy(true);
        try {
            await requestPermission();
        } finally {
            setIsBusy(false);
        }
    };

    const matchedCustomer = useMemo(() => {
        if (!customerName.trim()) return null;
        return allCustomers.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase()) || null;
    }, [allCustomers, customerName]);

    const filteredCustomers = useMemo(() => {
        const q = customerName.trim().toLowerCase();
        const arr = !q ? allCustomers.slice(0, 8) : allCustomers.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
        return arr;
    }, [allCustomers, customerName]);

    useEffect(() => {
        if (matchedCustomer) {
            setCustomerAddress(matchedCustomer.address || '');
            setCustomerCity(matchedCustomer.city || '');
            if (typeof matchedCustomer.hourlyRate === 'number') {
                setHourlyRate(String(matchedCustomer.hourlyRate));
            }
        }
        setIsEditingClient(false);
    }, [matchedCustomer]);

    const addItemRow = () => {
        setItems(prev => [...prev, { name: '', quantity: 1, price: 0, description: '' }]);
    };

    const removeItemRow = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, patch: Partial<ItemForm>) => {
        setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    };

    const onPickProductByName = (index: number, name: string) => {
        const product = allProducts.find(p => p.name.toLowerCase() === name.toLowerCase());
        const patch: Partial<ItemForm> = { name };
        if (product) {
            patch.price = Number(product.price) || 0;
            patch.description = product.description || '';
        }
        updateItem(index, patch);
    };

    const filteredProducts = (query: string) => {
        const q = query.trim().toLowerCase();
        const arr = !q ? allProducts.slice(0, 8) : allProducts.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
        return arr;
    };

    const handleUpdateCustomer = async () => {
        if (!matchedCustomer) return;
        setIsBusy(true);
        try {
            const customerToSave: CustomerData = {
                ...matchedCustomer,
                name: customerName.trim(),
                address: customerAddress,
                city: customerCity,
                hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
                lastModified: new Date().toISOString(),
            };
            const saved = await saveCustomer(customerToSave);
            setAllCustomers(prev => {
                const next = prev.map(c => c.id === saved.id ? (saved as unknown as CustomerData) : c);
                return next.slice().sort((a, b) => a.name.localeCompare(b.name));
            });
            showSuccess(`Customer "${saved.name}" updated successfully!`);
            setIsEditingClient(false);
        } catch (error) {
            console.error('Failed to update customer:', error);
            showError('Failed to update customer. Please try again.');
        } finally {
            setIsBusy(false);
        }
    };

    const rememberCustomer = async () => {
        if (!customerName.trim()) return;
        setIsBusy(true);
        try {
            const existing = allCustomers.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase());
            if (existing) return; // already known
            const now = new Date().toISOString();
            const saved = await saveCustomer({
                id: uuidv4(),
                name: customerName.trim(),
                address: customerAddress,
                city: customerCity,
                hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
                lastModified: now,
            } as CustomerData);
            setAllCustomers(prev => [...prev, saved as unknown as CustomerData]);
            showSuccess(`Customer "${customerName}" saved successfully!`);
        } catch (error) {
            console.error('Failed to save customer:', error);
            showError('Failed to save customer. Please try again.');
        } finally {
            setIsBusy(false);
        }
    };

    const rememberProduct = async (index: number) => {
        const it = items[index];
        if (!it || !it.name.trim()) return;
        setIsBusy(true);
        try {
            const exists = allProducts.find(p => p.name.toLowerCase() === it.name.trim().toLowerCase());
            if (exists) return;
            const saved = await saveProduct({
                name: it.name.trim(),
                price: Number(it.price) || 0,
                description: it.description || '',
            });
            setAllProducts(prev => [...prev, saved]);
            showSuccess(`Product "${it.name}" saved successfully!`);
        } catch (error) {
            console.error('Failed to save product:', error);
            showError('Failed to save product. Please try again.');
        } finally {
            setIsBusy(false);
        }
    };

    const buildInvoice = (number?: string): Invoice => {
        const issuer = mapCompanyToIssuer(companyInfo);
        const bank = mapCompanyToBank(companyInfo);
        const customer: CustomerData = matchedCustomer || {
            id: uuidv4(),
            name: customerName.trim(),
            address: customerAddress,
            city: customerCity,
            lastModified: new Date().toISOString(),
        };
        const invoiceItems: InvoiceItem[] = items
            .filter(it => it.name.trim() && Number(it.quantity) > 0)
            .map(it => ({ name: it.name.trim(), quantity: Number(it.quantity), price: Number(it.price), description: it.description || '' }));
        const subtotal = invoiceItems.reduce((sum, it) => sum + (it.quantity * it.price), 0);
        const effectiveTaxRate = taxRate || 0;
        const total = subtotal + (subtotal * (effectiveTaxRate / 100));
        const invoice: Invoice = {
            id: uuidv4(),
            invoice_number: (number || plannedNumber || '').toString(),
            invoice_date: invoiceDate,
            due_date: dueDate,
            issuer,
            customer,
            items: invoiceItems,
            total,
            bank_details: bank,
            tax_rate: effectiveTaxRate,
            notes,
            is_paid: false,
            status: undefined,
            lastModified: new Date().toISOString(),
            isDeleted: false,
            isRectified: false,
        };
        if (!companyInfo.is_vat_enabled) {
            invoice.tax_exemption_reason = 'Gemäß § 19 UStG keine Umsatzsteuer (Kleinunternehmerregelung)';
        }
        // Client presentation fields (used by PDF)
        invoice.client_name = customer.name;
        invoice.client_address = `${customer.address || ''}${customer.city ? `\n${customer.city}` : ''}`;
        invoice.client_vat_id = clientVatId || '';
        return invoice;
    };

    const goPreview = async () => {
        setIsBusy(true);
        try {
            const inv = buildInvoice();
            const blob = await generateInvoicePDF(inv, companyInfo);
            // Cleanup previous
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
            const url = URL.createObjectURL(blob);
            previewUrlRef.current = url;
            setPreviewUrl(url);
            setStep('preview');
        } finally {
            setIsBusy(false);
        }
    };

    const save = async () => {
        setIsBusy(true);
        try {
            // Persist through use case to generate the definitive number
            const usecase = new CreateInvoice(invoiceRepositoryAdapter);
            const inv = buildInvoice(undefined);
            const { id, invoice_number, ...rest } = inv;
            // We let use case set invoice_number and repository set id
            const saved = await usecase.execute({ ...rest });
            router.push('/invoices');
        } catch (e) {
            console.error('Failed to save invoice', e);
        } finally {
            setIsBusy(false);
        }
    };

    const insertThisMonthHours = async () => {
        if (!matchedCustomer) return;
        const rate = Number(hourlyRate || '0');
        if (!rate || Number.isNaN(rate)) {
            showError('Please enter an hourly rate first.');
            return;
        }
        try {
            const date = new Date(invoiceDate || new Date());
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const ts = await loadTimeMonth(matchedCustomer.id, matchedCustomer.name, year, month);
            const totalMinutes = ts.entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
            const hours = Math.round((totalMinutes / 60) * 100) / 100; // 2 decimals
            if (hours <= 0) {
                showError('No hours found for the selected month.');
                return;
            }
            const label = `Hours ${date.toLocaleString(undefined, { month: 'long', year: 'numeric' })}`;
            // Upsert or append
            setItems(prev => {
                const row = { name: label, quantity: hours, price: rate, description: `Time tracking for ${matchedCustomer.name}` } as ItemForm;
                
                // If there's only one item and it's empty, replace it
                if (prev.length === 1 && !prev[0].name.trim()) {
                    return [row];
                }

                const idx = prev.findIndex(i => i.name === label);
                if (idx >= 0) {
                    const next = prev.slice();
                    next[idx] = row;
                    return next;
                }
                return [...prev, row];
            });
            showSuccess('Inserted this month\'s hours.');
        } catch (e) {
            console.error('Failed to load timesheet', e);
            showError('Failed to insert hours from timesheet.');
        }
    };

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        };
    }, []);

    if (!isInitialized) {
        return <div className="p-6">Loading…</div>;
    }

    if (!hasPermission) {
        return (
            <div className="p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Create Invoice</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-sm text-neutral-600">
                            Grant access to your InvoiceManager folder to create invoices. Select the folder that contains the subfolders "invoices", "customers", and "products".
                        </div>
                        <Button onClick={handleGrantAccess} disabled={isBusy}>{isBusy ? 'Processing…' : 'Grant Folder Access'}</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${step === 'preview' ? 'p-3' : 'p-6'}`}>
            <Card>
                <CardHeader>
                    <CardTitle>New Invoice</CardTitle>
                </CardHeader>
                <CardContent className={step === 'preview' ? 'space-y-2' : 'space-y-4'}>
                    {step === 'edit' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                {/* Left column: Customer + Items */}
                                <div className="md:col-span-8 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-neutral-900">Customer</h3>
                                            {matchedCustomer && (
                                                isEditingClient ? (
                                                    <Button variant="outline" size="sm" onClick={handleUpdateCustomer} disabled={isBusy}>
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
                                                            value={customerName}
                                                            onChange={e => {
                                                                setCustomerName(e.target.value);
                                                                setShowCustomerSuggestions(true);
                                                            }}
                                                            onFocus={() => setShowCustomerSuggestions(true)}
                                                            className="w-full"
                                                        />
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search customers..." value={customerName} onValueChange={v => setCustomerName(v)} />
                                                            <CommandList>
                                                                <CommandEmpty>No results.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {filteredCustomers.map(c => (
                                                                        <CommandItem
                                                                            key={c.id}
                                                                            value={c.name}
                                                                            onSelect={() => {
                                                                                setCustomerName(c.name);
                                                                                setCustomerAddress(c.address || '');
                                                                                setCustomerCity(c.city || '');
                                                                                if (typeof (c as any).hourlyRate === 'number') setHourlyRate(String((c as any).hourlyRate));
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
                                                <Input placeholder="Street and number" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} disabled={!!matchedCustomer && !isEditingClient} />
                                            </div>
                                            <div>
                                                    <label className="block text-sm font-medium text-neutral-700 mb-2">City/ZIP</label>
                                                <Input placeholder="City, ZIP" value={customerCity} onChange={e => setCustomerCity(e.target.value)} disabled={!!matchedCustomer && !isEditingClient} />
                                                </div>
                                            </div>
                                            {companyInfo.is_vat_enabled && (
                                                <div>
                                                    <label className="block text-sm font-medium text-neutral-700 mb-2">Customer VAT ID (optional)</label>
                                                    <Input placeholder="e.g., DE123456789" value={clientVatId} onChange={e => setClientVatId(e.target.value)} className="max-w-sm" disabled={!!matchedCustomer && !isEditingClient} />
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-700 mb-2">Hourly rate (€)</label>
                                                <Input type="number" step="0.01" min="0" placeholder="e.g., 80" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} className="max-w-xs" disabled={!!matchedCustomer && !isEditingClient} />
                                            </div>
                                            {customerName.trim() && !matchedCustomer && (
                                                <div className="flex justify-start">
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        size="sm"
                                                        disabled={isBusy} 
                                                        onClick={rememberCustomer}
                                                        className="text-sm"
                                                    >
                                                        💾 Save "{customerName}" as new customer
                                                </Button>
                                            </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <h3 className="text-lg font-semibold text-neutral-900">Items</h3>
                                            <div className="flex items-center gap-2">
                                                <Button type="button" variant="outline" onClick={addItemRow}>
                                                    + Add item
                                                </Button>
                                                <Button type="button" variant="secondary" onClick={insertThisMonthHours} disabled={!matchedCustomer}>
                                                    Insert this month hours
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            {items.map((it, idx) => (
                                                <div key={idx} className="p-4 border border-neutral-200 rounded-lg bg-neutral-50 space-y-3">
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
                                                                        <CommandInput placeholder="Search products..." value={it.name} onValueChange={v => onPickProductByName(idx, v)} />
                                                                        <CommandList>
                                                                            <CommandEmpty>No results.</CommandEmpty>
                                                                            <CommandGroup>
                                                                                {filteredProducts(it.name).map(p => (
                                                                                    <CommandItem
                                                                                        key={p.id}
                                                                                        value={p.name}
                                                                                        onSelect={() => {
                                                                                            updateItem(idx, { name: p.name, price: Number(p.price) || 0, description: p.description || '' });
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
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        <div>
                                                            <label className="block text-sm font-medium text-neutral-700 mb-2">Quantity</label>
                                                            <Input type="number" step="0.5" min="0" value={String(it.quantity)} onChange={e => updateItem(idx, { quantity: Number(e.target.value) })} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-neutral-700 mb-2">Unit price (€)</label>
                                                        <Input type="number" step="0.01" min="0" value={String(it.price)} onChange={e => updateItem(idx, { price: Number(e.target.value) })} />
                                                    </div>
                                                        <div className="md:col-span-2">
                                                            <label className="block text-sm font-medium text-neutral-700 mb-2">Description (optional)</label>
                                                            <Input placeholder="Additional details..." value={it.description || ''} onChange={e => updateItem(idx, { description: e.target.value })} />
                                                        </div>
                                                    </div>
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
                                                                    onClick={() => rememberProduct(idx)}
                                                                    className="text-xs"
                                                                >
                                                                    💾 Save product
                                                                </Button>
                                                            )}
                                                            <Button 
                                                                type="button" 
                                                                size="sm" 
                                                                variant="destructive" 
                                                                onClick={() => removeItemRow(idx)}
                                                                disabled={items.length === 1}
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
                                            <Input placeholder="Additional notes for this invoice..." value={notes} onChange={e => setNotes(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {/* Right column: Details + Totals + Actions */}
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
                                                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-700 mb-2">Due date</label>
                                                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-neutral-200 p-4 bg-white shadow-sm">
                                        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Summary</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-neutral-600">Subtotal</span>
                                                <span className="font-medium">€{computedTotals.subtotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-neutral-600">VAT ({taxRate}%)</span>
                                                <span className="font-medium">€{computedTotals.taxAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="border-t border-neutral-300 pt-3">
                                                <div className="flex justify-between text-lg font-bold">
                                                    <span>Total</span>
                                                    <span>€{computedTotals.total.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Button 
                                            onClick={goPreview} 
                                            disabled={isBusy || items.every(it => !it.name.trim()) || !customerName.trim()}
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
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-2">
                            <div className="text-sm text-neutral-600">Preview of invoice #{plannedNumber} (final number assigned on save)</div>
                            {previewUrl ? (
                                <PdfViewer src={previewUrl} className="border border-neutral-200 rounded" />
                            ) : (
                                <div className="p-4">Generating preview…</div>
                            )}
                            <div className="flex justify-between">
                                <Button variant="outline" onClick={() => setStep('edit')}>Back</Button>
                                <Button onClick={save} disabled={isBusy}>Save</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function mapCompanyToIssuer(company: CompanyInfo): { name: string; address: string; city: string } {
    const name = company.is_freelancer && company.full_name ? company.full_name : company.name;
    const addressLines = (company.address || '').split('\n');
    const address = addressLines[0] || '';
    const city = addressLines.slice(1).join(' ') || '';
    return { name, address, city };
}

function mapCompanyToBank(company: CompanyInfo): { name: string; iban: string; bic: string } {
    return {
        name: company.bank_name || '',
        iban: company.iban || '',
        bic: company.swift_bic || '',
    };
}


