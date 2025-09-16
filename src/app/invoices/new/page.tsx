"use client";

import React, { useEffect, useMemo, useRef, useState, useReducer } from 'react';
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
import { InvoiceForm } from '@/components/invoices/new/InvoiceForm';
import type { InvoiceFormState, InvoiceFormAction, ItemForm } from '@/components/invoices/new/types';
const PdfViewer = dynamic(() => import('@/components/PdfViewer').then(m => m.PdfViewer), { ssr: false });

type Step = 'edit' | 'preview';

const initialFormState: InvoiceFormState = {
    invoiceDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    customerName: '',
    customerAddress: '',
    customerCity: '',
    clientVatId: '',
    hourlyRate: '',
    notes: '',
    items: [{ name: '', quantity: 1, price: 0, description: '' }],
};

function formReducer(state: InvoiceFormState, action: InvoiceFormAction): InvoiceFormState {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.value };
        case 'SET_ALL_FIELDS':
            return { ...state, ...action.payload };
        case 'ADD_ITEM':
            return { ...state, items: [...state.items, { name: '', quantity: 1, price: 0, description: '' }] };
        case 'REMOVE_ITEM':
            if (state.items.length === 1) return state;
            return { ...state, items: state.items.filter((_, i) => i !== action.index) };
        case 'UPDATE_ITEM':
            return {
                ...state,
                items: state.items.map((item, i) => (i === action.index ? { ...item, ...action.payload } : item)),
            };
        default:
            return state;
    }
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
    const [formState, dispatch] = useReducer(formReducer, initialFormState);

    // PDF preview
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const previewUrlRef = useRef<string>('');

    const taxRate = useMemo(() => {
        if (!companyInfo.is_vat_enabled) return 0;
        return companyInfo.default_tax_rate ?? 0;
    }, [companyInfo]);

    const computedTotals = useMemo(() => {
        const subtotal = formState.items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.price || 0)), 0);
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;
        return { subtotal, taxAmount, total };
    }, [formState.items, taxRate]);

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
        if (!formState.customerName.trim()) return null;
        return allCustomers.find(c => c.name.toLowerCase() === formState.customerName.trim().toLowerCase()) || null;
    }, [allCustomers, formState.customerName]);

    const filteredCustomers = useMemo(() => {
        const q = formState.customerName.trim().toLowerCase();
        const arr = !q ? allCustomers.slice(0, 8) : allCustomers.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
        return arr;
    }, [allCustomers, formState.customerName]);

    useEffect(() => {
        if (matchedCustomer) {
            dispatch({ type: 'SET_FIELD', field: 'customerAddress', value: matchedCustomer.address || '' });
            dispatch({ type: 'SET_FIELD', field: 'customerCity', value: matchedCustomer.city || '' });
            if (typeof matchedCustomer.hourlyRate === 'number') {
                dispatch({ type: 'SET_FIELD', field: 'hourlyRate', value: String(matchedCustomer.hourlyRate) });
            }
        }
        setIsEditingClient(false);
    }, [matchedCustomer]);

    const addItemRow = () => {
        dispatch({ type: 'ADD_ITEM' });
    };

    const removeItemRow = (index: number) => {
        dispatch({ type: 'REMOVE_ITEM', index });
    };

    const updateItem = (index: number, patch: Partial<ItemForm>) => {
        dispatch({ type: 'UPDATE_ITEM', index, payload: patch });
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
                name: formState.customerName.trim(),
                address: formState.customerAddress,
                city: formState.customerCity,
                hourlyRate: formState.hourlyRate ? Number(formState.hourlyRate) : undefined,
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
        if (!formState.customerName.trim()) return;
        setIsBusy(true);
        try {
            const existing = allCustomers.find(c => c.name.toLowerCase() === formState.customerName.trim().toLowerCase());
            if (existing) return; // already known
            const now = new Date().toISOString();
            const saved = await saveCustomer({
                id: uuidv4(),
                name: formState.customerName.trim(),
                address: formState.customerAddress,
                city: formState.customerCity,
                hourlyRate: formState.hourlyRate ? Number(formState.hourlyRate) : undefined,
                lastModified: now,
            } as CustomerData);
            setAllCustomers(prev => [...prev, saved as unknown as CustomerData]);
            showSuccess(`Customer "${formState.customerName}" saved successfully!`);
        } catch (error) {
            console.error('Failed to save customer:', error);
            showError('Failed to save customer. Please try again.');
        } finally {
            setIsBusy(false);
        }
    };

    const rememberProduct = async (index: number) => {
        const it = formState.items[index];
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
            name: formState.customerName.trim(),
            address: formState.customerAddress,
            city: formState.customerCity,
            lastModified: new Date().toISOString(),
        };
        const invoiceItems: InvoiceItem[] = formState.items
            .filter(it => it.name.trim() && Number(it.quantity) > 0)
            .map(it => ({ name: it.name.trim(), quantity: Number(it.quantity), price: Number(it.price), description: it.description || '' }));
        const subtotal = invoiceItems.reduce((sum, it) => sum + (it.quantity * it.price), 0);
        const effectiveTaxRate = taxRate || 0;
        const total = subtotal + (subtotal * (effectiveTaxRate / 100));
        const invoice: Invoice = {
            id: uuidv4(),
            invoice_number: (number || plannedNumber || '').toString(),
            invoice_date: formState.invoiceDate,
            due_date: formState.dueDate,
            issuer,
            customer,
            items: invoiceItems,
            total,
            bank_details: bank,
            tax_rate: effectiveTaxRate,
            notes: formState.notes,
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
        invoice.client_vat_id = formState.clientVatId || '';
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
        const rate = Number(formState.hourlyRate || '0');
        if (!rate || Number.isNaN(rate)) {
            showError('Please enter an hourly rate first.');
            return;
        }
        try {
            const date = new Date(formState.invoiceDate || new Date());
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
            const row = { name: label, quantity: hours, price: rate, description: `Time tracking for ${matchedCustomer.name}` } as ItemForm;
            
            // If there's only one item and it's empty, replace it
            if (formState.items.length === 1 && !formState.items[0].name.trim()) {
                dispatch({ type: 'UPDATE_ITEM', index: 0, payload: row });
                return;
            }

            const idx = formState.items.findIndex(i => i.name === label);
            if (idx >= 0) {
                dispatch({ type: 'UPDATE_ITEM', index: idx, payload: row });
            } else {
                dispatch({ type: 'ADD_ITEM' });
                // This is a bit of a hack, but it works for now.
                setTimeout(() => dispatch({ type: 'UPDATE_ITEM', index: formState.items.length, payload: row }), 0);
            }
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
                        <InvoiceForm
                            allCustomers={allCustomers}
                            allProducts={allProducts}
                            plannedNumber={plannedNumber}
                            taxRate={taxRate}
                            isVatEnabled={companyInfo.is_vat_enabled}
                            isBusy={isBusy}
                            initialState={initialFormState}
                            totals={computedTotals}
                            isValid={isValid}
                            matchedCustomer={matchedCustomer}
                            isEditingClient={isEditingClient}
                            setIsEditingClient={setIsEditingClient}
                            onUpdateCustomer={handleUpdateCustomer}
                            onRememberCustomer={rememberCustomer}
                            onRememberProduct={rememberProduct}
                            onInsertThisMonthHours={insertThisMonthHours}
                            onPreview={goPreview}
                            dispatch={dispatch}
                            formState={formState}
                        />
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


