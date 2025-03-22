'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { PlusCircle, Save, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    calculateTotal,
    getIssuerData,
    getBankDetails,
    saveIssuerData,
    saveBankDetails
} from '../utils/invoiceUtils';
import { InvoiceItem, CustomerData, IssuerData, BankDetails, Invoice } from '../interfaces';
import { useFileSystem } from '../contexts/FileSystemContext';
import { useCompany } from '../contexts/CompanyContext';
import { v4 as uuidv4 } from 'uuid';
import { showSuccess, showError, showLoading } from '../utils/notifications';
import { FormInput } from './ui/form-input';
import { Separator } from './ui/separator';
import { CustomerSelector } from './CustomerSelector';
import ProductSelector from './ProductSelector';

interface InvoiceFormProps {
    existingInvoice?: Invoice;
}

export function InvoiceForm({ existingInvoice }: InvoiceFormProps) {
    const router = useRouter();
    const { saveInvoices, hasPermission, loadInvoices } = useFileSystem();
    const { companyInfo } = useCompany();

    // Form state
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
    const [dueDate, setDueDate] = useState<Date>(new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000)); // 14 days from today
    const [buyerReference, setBuyerReference] = useState('');
    const [clientVatId, setClientVatId] = useState('');
    const [clientVatExempt, setClientVatExempt] = useState(false);
    const [clientElectronicAddress, setClientElectronicAddress] = useState('');
    const [taxExemptionReason, setTaxExemptionReason] = useState('');
    // Set initial tax rate based on company VAT settings
    const [taxRate, setTaxRate] = useState<number>(companyInfo.is_vat_enabled ? companyInfo.default_tax_rate : 0);
    const [issuer, setIssuer] = useState<IssuerData>({
        name: '',
        address: '',
        city: ''
    });
    const [customer, setCustomer] = useState<CustomerData>({
        name: '',
        address: '',
        city: '',
        number: ''
    });
    const [items, setItems] = useState<InvoiceItem[]>([
        { name: '', quantity: 1, price: 0 }
    ]);
    const [bankDetails, setBankDetails] = useState<BankDetails>({
        name: '',
        iban: '',
        bic: ''
    });

    // Generate invoice number if it's a new invoice
    useEffect(() => {
        if (!existingInvoice && !invoiceNumber) {
            const currentYear = new Date().getFullYear().toString().substring(2);
            const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const randomDigits = Math.floor(Math.random() * 9000 + 1000);
            setInvoiceNumber(`INV-${currentYear}${currentMonth}-${randomDigits}`);
        }
    }, [existingInvoice, invoiceNumber]);

    // Load saved data
    useEffect(() => {
        const savedIssuer = getIssuerData();
        const savedBank = getBankDetails();

        // First check if we have company info from the context
        if (companyInfo && companyInfo.name) {
            setIssuer({
                name: companyInfo.name,
                address: companyInfo.address?.split('\n')[0] || '',
                city: companyInfo.address?.split('\n')[1] || '',
            });

            setBankDetails({
                name: companyInfo.bank_name || '',
                iban: companyInfo.iban || '',
                bic: companyInfo.swift_bic || '',
            });
        }
        // Fall back to saved data if no context data
        else if (savedIssuer) {
            setIssuer(savedIssuer);
        }

        if (!companyInfo.bank_name && savedBank) {
            setBankDetails(savedBank);
        }

        // If editing an existing invoice, populate the form
        if (existingInvoice) {
            setInvoiceNumber(existingInvoice.invoice_number);
            setInvoiceDate(new Date(existingInvoice.invoice_date));
            setDueDate(new Date(existingInvoice.due_date || ''));
            setBuyerReference(existingInvoice.buyer_reference || '');
            setClientVatId(existingInvoice.client_vat_id || '');
            setClientVatExempt(existingInvoice.client_vat_exempt || false);
            setClientElectronicAddress(existingInvoice.client_electronic_address || '');
            setTaxExemptionReason(existingInvoice.tax_exemption_reason || '');
            setTaxRate(existingInvoice.tax_rate || 19);
            setIssuer(existingInvoice.issuer);
            setCustomer(existingInvoice.customer);
            setItems(existingInvoice.items);
            setBankDetails(existingInvoice.bank_details);
        }
    }, [existingInvoice, companyInfo]);

    // Effect to update tax fields when company VAT settings or client VAT exemption changes
    useEffect(() => {
        if (!existingInvoice) {
            if (!companyInfo.is_vat_enabled) {
                // Company is VAT exempt (Kleinunternehmerregelung)
                setTaxRate(0);
                setTaxExemptionReason('Gemäß § 19 UStG keine Umsatzsteuer (Kleinunternehmerregelung)');
            } else if (clientVatExempt) {
                // Client is VAT exempt, but company is not
                setTaxRate(0);
                setTaxExemptionReason('Umsatzsteuerfreie Leistung (innergemeinschaftliche Lieferung/Reverse-Charge)');
            } else {
                // Standard case - both company and client pay VAT
                setTaxRate(companyInfo.default_tax_rate);
                setTaxExemptionReason('');
            }
        }
    }, [companyInfo.is_vat_enabled, companyInfo.default_tax_rate, clientVatExempt, existingInvoice]);

    // Add a new item row
    const addItem = () => {
        setItems([...items, { name: '', quantity: 1, price: 0 }]);
    };

    // Remove an item row
    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    // Update an invoice item
    const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
        const updatedItems = [...items];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setItems(updatedItems);
    };

    // Handle product selection for an item
    const handleProductSelect = (index: number, product: any) => {
        const updatedItems = [...items];
        updatedItems[index] = {
            ...updatedItems[index],
            name: product.name,
            price: product.price,
            description: product.description || '',
        };
        setItems(updatedItems);
    };

    // Calculate total
    const total = calculateTotal(items);

    // Submit form
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!hasPermission) {
            showError("Storage permission is required to save invoices. Please grant permission first.");
            return;
        }

        const loadingToast = showLoading("Saving invoice...");

        try {
            // Save issuer and bank details for future use
            saveIssuerData(issuer);
            saveBankDetails(bankDetails);

            // Create invoice object
            const invoice: Invoice = {
                id: existingInvoice?.id || uuidv4(),
                invoice_number: invoiceNumber,
                invoice_date: format(invoiceDate, 'yyyy-MM-dd'),
                due_date: format(dueDate, 'yyyy-MM-dd'),
                client_name: customer.name,
                client_address: `${customer.address}\n${customer.city}`,
                client_vat_id: clientVatId,
                client_vat_exempt: clientVatExempt,
                client_electronic_address: clientElectronicAddress,
                buyer_reference: buyerReference,
                tax_exemption_reason: taxExemptionReason,
                tax_rate: taxRate,
                issuer,
                customer,
                items,
                total,
                bank_details: bankDetails,
                is_paid: false
            };

            // Save invoice using FileSystem API
            const invoicesToSave = existingInvoice
                ? await updateExistingInvoice(invoice)
                : [invoice];

            const success = await saveInvoices(invoicesToSave);

            if (success) {
                loadingToast.success("Invoice saved successfully!");
                router.push('/invoices');
            } else {
                loadingToast.error("Failed to save invoice.");
            }
        } catch (error) {
            console.error("Error saving invoice:", error);
            loadingToast.error("An error occurred while saving the invoice.");
        }
    };

    // Helper function to update an existing invoice
    const updateExistingInvoice = async (updatedInvoice: Invoice): Promise<Invoice[]> => {
        try {
            // Get all invoices and update the matching one
            const allInvoices = await loadInvoices();

            // Find and replace the existing invoice
            const updatedInvoices = allInvoices.map(inv =>
                inv.id === updatedInvoice.id ? updatedInvoice : inv
            );

            return updatedInvoices;
        } catch (error) {
            console.error("Error updating invoice:", error);
            return [updatedInvoice]; // Fall back to just this invoice if loading others fails
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Invoice Details</CardTitle>
                    <CardDescription>Basic information about your invoice</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div>
                            <div className="mb-1.5">
                                <label htmlFor="invoice_number" className="text-sm font-medium">
                                    Invoice Number
                                </label>
                            </div>
                            <input
                                id="invoice_number"
                                type="text"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <p className="text-xs text-muted-foreground mt-1.5">
                                Unique identifier for this invoice
                            </p>
                        </div>

                        <div>
                            <div className="mb-1.5">
                                <label htmlFor="invoice_date" className="text-sm font-medium">
                                    Invoice Date
                                </label>
                            </div>
                            <DatePicker
                                id="invoice_date"
                                selected={invoiceDate}
                                onChange={(date: Date) => setInvoiceDate(date)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                dateFormat="yyyy-MM-dd"
                                required
                            />
                        </div>

                        <div>
                            <div className="mb-1.5">
                                <label htmlFor="due_date" className="text-sm font-medium">
                                    Due Date
                                </label>
                            </div>
                            <DatePicker
                                id="due_date"
                                selected={dueDate}
                                onChange={(date: Date) => setDueDate(date)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                dateFormat="yyyy-MM-dd"
                                required
                            />
                            <p className="text-xs text-muted-foreground mt-1.5">
                                When payment is due (default: 14 days from now)
                            </p>
                        </div>

                        <div>
                            <div className="mb-1.5">
                                <label htmlFor="buyer_reference" className="text-sm font-medium flex items-center">
                                    Buyer Reference (XRechnung BT-10)
                                    <span className="relative ml-1 cursor-help group z-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <path d="M12 16v-4"></path>
                                            <path d="M12 8h.01"></path>
                                        </svg>
                                        <div className="absolute left-0 md:left-full top-full md:top-0 z-50 w-72 p-2 bg-black text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
                                            A Buyer Reference (BT-10) is mandatory for public sector clients in Germany (XRechnung standard). For private clients, it's optional but recommended to include your invoice number or any client reference number to help with payment reconciliation.
                                        </div>
                                    </span>
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    id="buyer_reference"
                                    type="text"
                                    value={buyerReference}
                                    onChange={(e) => setBuyerReference(e.target.value)}
                                    placeholder="Reference number of the buyer (e.g. PO number)"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!buyerReference) {
                                            setBuyerReference(invoiceNumber);
                                        }
                                    }}
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10"
                                    title="Use invoice number as buyer reference"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                    </svg>
                                    <span className="ml-1">Copy Invoice #</span>
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                                Required for public sector clients, optional for private clients
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Issuer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormInput
                        label="Name"
                        type="text"
                        value={issuer.name}
                        onChange={(e) => setIssuer({ ...issuer, name: e.target.value })}
                        required
                    />
                    <FormInput
                        label="Address"
                        type="text"
                        value={issuer.address}
                        onChange={(e) => setIssuer({ ...issuer, address: e.target.value })}
                        required
                    />
                    <FormInput
                        label="City, Postal Code"
                        type="text"
                        value={issuer.city}
                        onChange={(e) => setIssuer({ ...issuer, city: e.target.value })}
                        required
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Customer Information</CardTitle>
                    <CardDescription>Details about your customer or client</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <CustomerSelector
                        currentCustomer={customer}
                        onSelectCustomer={(selectedCustomer) => setCustomer(selectedCustomer)}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div>
                            <div className="mb-1.5">
                                <label htmlFor="customer_name" className="text-sm font-medium">
                                    Name
                                </label>
                            </div>
                            <input
                                id="customer_name"
                                type="text"
                                value={customer.name}
                                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            />
                        </div>

                        <div>
                            <div className="mb-1.5">
                                <label htmlFor="customer_number" className="text-sm font-medium">
                                    Customer Number
                                </label>
                            </div>
                            <input
                                id="customer_number"
                                type="text"
                                value={customer.number || ''}
                                onChange={(e) => setCustomer({ ...customer, number: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Optional identifier for your customer"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <div className="mb-1.5">
                                <label htmlFor="customer_address" className="text-sm font-medium">
                                    Address
                                </label>
                            </div>
                            <input
                                id="customer_address"
                                type="text"
                                value={customer.address}
                                onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            />
                        </div>

                        <div className="md:col-span-2">
                            <div className="mb-1.5">
                                <label htmlFor="customer_city" className="text-sm font-medium">
                                    City, Postal Code
                                </label>
                            </div>
                            <input
                                id="customer_city"
                                type="text"
                                value={customer.city}
                                onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            />
                        </div>
                    </div>

                    <Separator className="my-2" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div>
                            <div className="mb-1.5">
                                <label htmlFor="client_vat_id" className="text-sm font-medium">
                                    VAT ID / Tax Number
                                </label>
                            </div>
                            <input
                                id="client_vat_id"
                                type="text"
                                value={clientVatId}
                                onChange={(e) => setClientVatId(e.target.value)}
                                placeholder="Customer's VAT ID or tax number"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <div>
                            <div className="mb-1.5">
                                <label htmlFor="client_leitweg_id" className="text-sm font-medium flex items-center">
                                    Leitweg-ID
                                    <span className="relative ml-1 cursor-help group z-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <path d="M12 16v-4"></path>
                                            <path d="M12 8h.01"></path>
                                        </svg>
                                        <div className="absolute left-0 md:left-full top-full md:top-0 z-50 w-72 p-2 bg-black text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
                                            A Leitweg-ID is required only for German public sector clients. It's a routing identifier used to direct electronic invoices within public administration. Private companies don't use a Leitweg-ID. Format: 991-XXXXX-XX.
                                        </div>
                                    </span>
                                </label>
                            </div>
                            <input
                                id="client_leitweg_id"
                                type="text"
                                value={clientElectronicAddress}
                                onChange={(e) => setClientElectronicAddress(e.target.value)}
                                placeholder="Required for public sector clients (format: 991-XXXXX-XX)"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <div className="flex items-center space-x-2 pl-1">
                                <input
                                    type="checkbox"
                                    id="client_vat_exempt"
                                    checked={clientVatExempt}
                                    onChange={(e) => setClientVatExempt(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <label htmlFor="client_vat_exempt" className="text-sm font-medium flex items-center">
                                    VAT exempt client (EU cross-border/reverse charge)
                                    <span className="relative ml-1 cursor-help group z-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <path d="M12 16v-4"></path>
                                            <path d="M12 8h.01"></path>
                                        </svg>
                                        <div className="absolute left-0 md:left-full top-full md:top-0 z-50 w-72 p-2 bg-black text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
                                            Check this box for EU businesses outside Germany with a valid VAT ID (Reverse Charge procedure) or for other VAT-exempt clients. This will set the tax rate to 0% and add an appropriate legal notice to the invoice.
                                        </div>
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>Invoice Items</span>
                        <Button type="button" onClick={addItem} variant="outline" className="flex items-center">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Item
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {items.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-4 mb-4 items-end">
                            <div className="col-span-5">
                                <div className="mb-2">
                                    {index === 0 && <label className="text-sm font-medium">Item Name</label>}
                                    <ProductSelector
                                        selectedProduct={{
                                            name: item.name,
                                            price: item.price,
                                            description: item.description || '',
                                            unit: ''
                                        }}
                                        onSelectProduct={(product) => handleProductSelect(index, product)}
                                    />
                                </div>
                                <FormInput
                                    label={undefined}
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="col-span-2">
                                <FormInput
                                    label={index === 0 ? "Quantity" : undefined}
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                                    required
                                />
                            </div>
                            <div className="col-span-3">
                                <FormInput
                                    label={index === 0 ? "Price" : undefined}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.price}
                                    onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                                    required
                                />
                            </div>
                            <div className="col-span-2">
                                {items.length > 1 && (
                                    <Button
                                        type="button"
                                        onClick={() => removeItem(index)}
                                        variant="destructive"
                                        className="w-full"
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}

                    <div className="text-right mt-6">
                        <div className="text-lg font-semibold">
                            Total: ${total.toFixed(2)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tax Information</CardTitle>
                    <CardDescription>
                        {!companyInfo.is_vat_enabled
                            ? "Your company doesn't charge VAT (Kleinunternehmerregelung)"
                            : clientVatExempt
                                ? "Client is VAT exempt - no VAT will be charged"
                                : "Standard VAT settings apply"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {companyInfo.is_vat_enabled && !clientVatExempt ? (
                            <>
                                <div>
                                    <FormInput
                                        label="Tax Rate (%)"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={taxRate}
                                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Standard German rate: 19%, Reduced rate: 7%
                                    </p>
                                </div>
                                {taxRate === 0 && (
                                    <div>
                                        <FormInput
                                            label="Tax Exemption Reason"
                                            type="text"
                                            value={taxExemptionReason}
                                            onChange={(e) => setTaxExemptionReason(e.target.value)}
                                            placeholder="Tax exemption reason (if applicable)"
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="col-span-2">
                                <div className="rounded-md bg-gray-100 p-3">
                                    <p className="text-sm font-medium">
                                        {!companyInfo.is_vat_enabled
                                            ? "This invoice will include the Kleinunternehmerregelung notice (§19 UStG)"
                                            : "This invoice will use reverse-charge or other VAT exemption rules"}
                                    </p>
                                </div>
                                <FormInput
                                    label="Tax Exemption Text"
                                    type="text"
                                    value={taxExemptionReason}
                                    onChange={(e) => setTaxExemptionReason(e.target.value)}
                                    className="mt-3"
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Bank Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormInput
                        label="Bank Name"
                        type="text"
                        value={bankDetails.name}
                        onChange={(e) => setBankDetails({ ...bankDetails, name: e.target.value })}
                        required
                    />
                    <FormInput
                        label="IBAN"
                        type="text"
                        value={bankDetails.iban}
                        onChange={(e) => setBankDetails({ ...bankDetails, iban: e.target.value })}
                        required
                    />
                    <FormInput
                        label="BIC"
                        type="text"
                        value={bankDetails.bic}
                        onChange={(e) => setBankDetails({ ...bankDetails, bic: e.target.value })}
                        required
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button
                    type="submit"
                    className="flex items-center"
                    disabled={!hasPermission}
                >
                    <Save className="mr-2 h-4 w-4" />
                    Save Invoice
                </Button>
            </div>
        </form>
    );
} 