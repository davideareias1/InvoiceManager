'use client';

import { BankDetails, Invoice, IssuerData } from '../interfaces';
import { v4 as uuidv4 } from 'uuid';
import { getItem, setItem } from './clientStorage';

// Local storage keys
const INVOICES_KEY = 'invoices';
const ISSUER_KEY = 'issuer_data';
const BANK_KEY = 'bank_details';

// Interface for saved invoices with additional properties
export interface SavedInvoice {
    id: string;
    invoiceNumber: string;
    customerName: string;
    date: string;
    totalAmount: number;
    status?: string;
}

// Save invoice to local storage
export const saveInvoice = (invoice: Invoice): void => {
    const invoices = getInvoices();

    // Check if we're updating an existing invoice
    const existingIndex = invoices.findIndex(inv => inv.invoice_number === invoice.invoice_number);

    if (existingIndex >= 0) {
        invoices[existingIndex] = invoice;
    } else {
        // Add a UUID if not present
        if (!invoice.id) {
            invoice.id = uuidv4();
        }
        invoices.push(invoice);
    }

    setItem(INVOICES_KEY, JSON.stringify(invoices));
};

// Get all invoices from local storage
export const getInvoices = (): Invoice[] => {
    const invoicesJson = getItem(INVOICES_KEY);
    return invoicesJson ? JSON.parse(invoicesJson) : [];
};

// Get invoice by invoice number
export const getInvoiceByNumber = (invoiceNumber: string): Invoice | null => {
    const invoices = getInvoices();
    return invoices.find(inv => inv.invoice_number === invoiceNumber) || null;
};

// Save issuer data to local storage
export const saveIssuerData = (data: IssuerData): void => {
    setItem(ISSUER_KEY, JSON.stringify(data));
};

// Get issuer data from local storage
export const getIssuerData = (): IssuerData | null => {
    const data = getItem(ISSUER_KEY);
    return data ? JSON.parse(data) : null;
};

// Save bank details to local storage
export const saveBankDetails = (details: BankDetails): void => {
    setItem(BANK_KEY, JSON.stringify(details));
};

// Get bank details from local storage
export const getBankDetails = (): BankDetails | null => {
    const details = getItem(BANK_KEY);
    return details ? JSON.parse(details) : null;
};

// Calculate total amount for an invoice
export const calculateTotal = (items: { quantity: number; price: number }[]): number => {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
};

// Group invoices by month for monthly totals
export const getMonthlyTotals = (invoices: Invoice[]): Record<string, number> => {
    const totals: Record<string, number> = {};

    invoices.forEach(invoice => {
        const date = new Date(invoice.invoice_date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!totals[monthYear]) {
            totals[monthYear] = 0;
        }

        totals[monthYear] += invoice.total;
    });

    return totals;
};

// Load invoices synchronously from localStorage
export function loadInvoicesSync(): SavedInvoice[] {
    if (typeof window === 'undefined') return [];

    try {
        const data = localStorage.getItem('saved-invoices');
        if (!data) return [];

        const invoices = JSON.parse(data);
        return invoices.map((invoice: Invoice) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoice_number,
            customerName: invoice.customer?.name || invoice.client_name || '',
            date: invoice.invoice_date,
            totalAmount: invoice.total,
            status: invoice.status
        }));
    } catch (error) {
        console.error('Error loading invoices from localStorage:', error);
        return [];
    }
}

// Load invoices asynchronously (simulating API call)
export async function loadInvoices(): Promise<SavedInvoice[]> {
    return new Promise((resolve) => {
        // Simulate delay for future API integration
        setTimeout(() => {
            resolve(loadInvoicesSync());
        }, 300);
    });
}

// Save invoices
export async function saveInvoices(invoices: Invoice[]): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
        localStorage.setItem('saved-invoices', JSON.stringify(invoices));
        return true;
    } catch (error) {
        console.error('Error saving invoices:', error);
        return false;
    }
}

// Delete an invoice by ID or invoice number
export async function deleteInvoice(idOrNumber: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
        // Try to delete by ID from saved-invoices
        const savedData = localStorage.getItem('saved-invoices');
        if (savedData) {
            const savedInvoices = JSON.parse(savedData);
            const filteredSavedInvoices = savedInvoices.filter((invoice: Invoice) => invoice.id !== idOrNumber);

            // If we found and removed an invoice
            if (filteredSavedInvoices.length !== savedInvoices.length) {
                localStorage.setItem('saved-invoices', JSON.stringify(filteredSavedInvoices));
                return true;
            }
        }

        // If we didn't find it by ID, try by invoice number in the old storage
        const invoices = getInvoices().filter(inv => inv.invoice_number !== idOrNumber);
        setItem(INVOICES_KEY, JSON.stringify(invoices));
        return true;
    } catch (error) {
        console.error('Error deleting invoice:', error);
        return false;
    }
}

// Search invoices by query or search term
export function searchInvoices(queryOrInvoices: string, searchTerm?: undefined): SavedInvoice[];
export function searchInvoices(queryOrInvoices: Invoice[], searchTerm: string): Invoice[];
export function searchInvoices(queryOrInvoices: string | Invoice[], searchTerm?: string): SavedInvoice[] | Invoice[] {
    try {
        // Case 1: Called with (queryString) where queryString is a string - used by InvoiceSelector
        if (typeof queryOrInvoices === 'string' && searchTerm === undefined) {
            const query = queryOrInvoices;
            if (!query) return loadInvoicesSync();

            const invoices = loadInvoicesSync();
            const lowerQuery = query.toLowerCase();

            return invoices.filter(invoice =>
                (invoice.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(lowerQuery)) ||
                (invoice.customerName && invoice.customerName.toLowerCase().includes(lowerQuery))
            );
        }
        // Case 2: Called with (invoices, searchTerm) - used by invoices page
        else if (Array.isArray(queryOrInvoices) && searchTerm) {
            const invoices = queryOrInvoices;
            if (!searchTerm.trim()) return invoices;

            const lowerCaseSearchTerm = searchTerm.toLowerCase();

            return invoices.filter(invoice => {
                try {
                    // Add null checks to prevent errors
                    const invoiceNumber = invoice.invoice_number || '';
                    // Handle case when customer is null or undefined
                    const customerName = invoice.customer?.name || '';

                    return invoiceNumber.toLowerCase().includes(lowerCaseSearchTerm) ||
                        customerName.toLowerCase().includes(lowerCaseSearchTerm);
                } catch (err) {
                    console.error('Error filtering invoice:', err, invoice);
                    return false;
                }
            });
        }

        // Fallback case
        return [];
    } catch (error) {
        console.error('Error in searchInvoices:', error);
        // Return empty array on error
        return [];
    }
} 