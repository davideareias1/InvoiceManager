"use client";

import React, { useEffect, useMemo, useRef, useState, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { getSavedDirectoryHandle, setDirectoryHandle as setFsHandle } from '@/infrastructure/filesystem/fileSystemStorage';
import { setDirectoryHandle as setCustomerHandle, loadCustomers } from '@/infrastructure/repositories/customerRepository';
import { setDirectoryHandle as setProductHandle, loadProducts } from '@/infrastructure/repositories/productRepository';
import { setDirectoryHandle as setInvoiceHandle, invoiceRepositoryAdapter } from '@/infrastructure/repositories/invoiceRepository';
import { setDirectoryHandle as setTimeHandle, loadMonth as loadTimeMonth } from '@/infrastructure/repositories/timeTrackingRepository';
import { CreateInvoice } from '@/application/usecases';
import { useCompany } from '@/infrastructure/contexts/CompanyContext';
import { generateInvoicePDF } from '@/infrastructure/pdf/pdfUtils';
import { addDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { CompanyInfo, CustomerData, Invoice, InvoiceItem, ProductData } from '@/domain/models';
import { showSuccess, showError } from '@/shared/notifications';
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
        case 'ADD_ITEM_WITH_PAYLOAD':
            return { ...state, items: [...state.items, action.payload] };
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

    const isValid = useMemo(() => {
        if (!formState.customerName.trim()) return false;
        if (formState.items.length === 0) return false;
        if (formState.items.some(it => !it.name.trim() || !(Number(it.quantity) > 0) || !(Number(it.price) >= 0))) return false;
        return true;
    }, [formState]);

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

    // Removed free-text product picking; products are selected from a list in the items section

    const filteredProducts = (query: string) => {
        const q = query.trim().toLowerCase();
        const arr = !q ? allProducts.slice(0, 8) : allProducts.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
        return arr;
    };

    // Removed save-new-customer and save-product flows to streamline UX

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

    const applyMonthlyHoursToItem = async (index: number) => {
        try {
            const date = new Date(formState.invoiceDate || new Date());
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            const label = `Hours ${date.toLocaleString(undefined, { month: 'long', year: 'numeric' })}`;

            // If no customer selected, create labeled empty row
            if (!matchedCustomer) {
                dispatch({ type: 'UPDATE_ITEM', index, payload: { name: label, quantity: 0, price: 0, description: '' } });
                return;
            }

            // Load tracked time for the selected customer and month
            const ts = await loadTimeMonth(matchedCustomer.id, matchedCustomer.name, year, month);
            const totalMinutes = ts.entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
            const rawHours = Math.round((totalMinutes / 60) * 100) / 100; // 2 decimals
            const hours = Math.round(rawHours / 0.5) * 0.5; // round to nearest 0.5

            // Use rate if provided, otherwise set price to 0 but still show hours
            const rate = Number(formState.hourlyRate || '0');
            const price = Number.isFinite(rate) && rate > 0 ? rate : 0;

            const row: Partial<ItemForm> = {
                name: label,
                quantity: hours > 0 ? hours : 0,
                price,
                description: `Softwareentwicklung – ${matchedCustomer.name} (Abrechnung nach Stunden)`,
            };
            dispatch({ type: 'UPDATE_ITEM', index, payload: row });
        } catch (e) {
            console.error('Failed to apply monthly hours', e);
            const date = new Date(formState.invoiceDate || new Date());
            const label = `Hours ${date.toLocaleString(undefined, { month: 'long', year: 'numeric' })}`;
            dispatch({ type: 'UPDATE_ITEM', index, payload: { name: label, quantity: 0, price: 0 } });
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
        <div className="h-screen flex flex-col bg-neutral-50">
            {step === 'edit' && (
                <div className="p-4 h-full">
                    <InvoiceForm
                        allCustomers={allCustomers}
                        allProducts={allProducts}
                        plannedNumber={plannedNumber}
                        taxRate={taxRate}
                        isBusy={isBusy}
                        totals={computedTotals}
                        isValid={isValid}
                        onApplyMonthlyHoursToItem={applyMonthlyHoursToItem}
                        onPreview={goPreview}
                        dispatch={dispatch}
                        formState={formState}
                    />
                </div>
            )}

            {step === 'preview' && (
                <div className="h-full flex flex-col">
                    {/* Preview Header */}
                    <div className="bg-white border-b border-neutral-200 px-6 py-4 shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-neutral-900">Invoice Preview</h1>
                                <p className="text-sm text-neutral-600 mt-1">Review before saving</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" onClick={() => setStep('edit')}>
                                    Back to Edit
                                </Button>
                                <Button 
                                    onClick={save} 
                                    disabled={isBusy}
                                    className="bg-neutral-900 hover:bg-neutral-800"
                                >
                                    {isBusy ? 'Saving...' : 'Save Invoice'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Preview Content */}
                    <div className="flex-1 min-h-0 p-4">
                        {previewUrl ? (
                            <PdfViewer src={previewUrl} className="border border-neutral-200 rounded-lg w-full h-full shadow-sm" />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-neutral-600">Generating preview…</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
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


