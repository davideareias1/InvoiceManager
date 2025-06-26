'use client';

import { Invoice } from '../interfaces';
import { v4 as uuidv4 } from 'uuid';
import { saveInvoiceToFile, loadInvoicesFromFiles } from './fileSystemStorage';
import { saveInvoiceToGoogleDrive } from './googleDriveStorage';

// Global variable to cache directory handle and invoices
let directoryHandle: FileSystemDirectoryHandle | null = null;
let cachedInvoices: Invoice[] = [];

/**
 * Set the directory handle for file system operations
 */
export const setDirectoryHandle = (handle: FileSystemDirectoryHandle) => {
    directoryHandle = handle;
    // Immediately load invoices when handle is set
    loadInvoices().then(invoices => {
        cachedInvoices = invoices;
    });
};

/**
 * Load all saved invoices, excluding deleted ones
 */
export const loadInvoices = async (): Promise<Invoice[]> => {
    if (!directoryHandle) return [];
    try {
        const invoices = await loadInvoicesFromFiles();
        cachedInvoices = invoices.filter(inv => !inv.isDeleted);
        return cachedInvoices;
    } catch (error) {
        console.error('Error loading invoices:', error);
        return [];
    }
};

/**
 * Synchronous access to cached invoices
 */
export const loadInvoicesSync = (): Invoice[] => {
    return cachedInvoices.filter(inv => !inv.isDeleted);
};

/**
 * Get a single invoice by its ID
 */
export const getInvoiceById = (id: string): Invoice | null => {
    return cachedInvoices.find(inv => inv.id === id && !inv.isDeleted) || null;
};

/**
 * Save a new invoice or update an existing one
 */
export const saveInvoice = async (invoice: Partial<Invoice>): Promise<Invoice> => {
    if (!directoryHandle) {
        throw new Error('No directory handle available. Please grant file access permissions.');
    }

    try {
        const now = new Date().toISOString();
        let updatedInvoice: Invoice;

        if (invoice.id) {
            // Update existing invoice
            const existingIndex = cachedInvoices.findIndex(inv => inv.id === invoice.id);
            if (existingIndex !== -1) {
                updatedInvoice = { ...cachedInvoices[existingIndex], ...invoice, lastModified: now };
                cachedInvoices[existingIndex] = updatedInvoice;
            } else {
                throw new Error(`Invoice with id ${invoice.id} not found.`);
            }
        } else {
            // Create new invoice
            updatedInvoice = {
                ...invoice,
                id: uuidv4(),
                lastModified: now,
                isDeleted: false,
            } as Invoice;
            cachedInvoices.push(updatedInvoice);
        }

        await saveInvoiceToFile(updatedInvoice);
        await saveInvoiceToGoogleDrive(updatedInvoice);

        return updatedInvoice;
    } catch (error) {
        console.error('Error saving invoice:', error);
        throw error;
    }
};

/**
 * Delete an invoice by marking it as deleted (soft delete)
 */
export const deleteInvoice = async (id: string): Promise<boolean> => {
    if (!directoryHandle) return false;
    try {
        const invoiceIndex = cachedInvoices.findIndex(inv => inv.id === id);
        if (invoiceIndex === -1) {
            console.warn(`Invoice with id ${id} not found for deletion.`);
            return false;
        }

        const invoiceToDelete = {
            ...cachedInvoices[invoiceIndex],
            isDeleted: true,
            lastModified: new Date().toISOString(),
        };

        cachedInvoices[invoiceIndex] = invoiceToDelete;

        await saveInvoiceToFile(invoiceToDelete);
        await saveInvoiceToGoogleDrive(invoiceToDelete);

        cachedInvoices = cachedInvoices.filter(inv => inv.id !== id);

        return true;
    } catch (error) {
        console.error('Error deleting invoice:', error);
        return false;
    }
};

/**
 * Search for invoices based on a query
 */
export const searchInvoices = (query: string): Invoice[] => {
    const activeInvoices = loadInvoicesSync();
    if (!query) return activeInvoices;

    const lowerQuery = query.toLowerCase();
    return activeInvoices.filter(invoice =>
        (invoice.invoice_number && invoice.invoice_number.toLowerCase().includes(lowerQuery)) ||
        (invoice.customer?.name && invoice.customer.name.toLowerCase().includes(lowerQuery))
    );
}; 