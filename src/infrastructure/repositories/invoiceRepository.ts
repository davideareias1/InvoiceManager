'use client';

import { Invoice, InvoiceStatus, InvoiceRepository } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';
import { saveInvoiceToFile, loadInvoicesFromFiles } from '../filesystem/fileSystemStorage';
import { saveInvoiceToGoogleDrive } from '../google/googleDriveStorage';
import { format, addDays } from 'date-fns';
import { formatDate } from '../../shared/formatters';

// Global variable to cache directory handle and invoices
let directoryHandle: FileSystemDirectoryHandle | null = null;
let cachedInvoices: Invoice[] = [];
let nextInvoiceNumber: number = 1; // Track the next invoice number

/**
 * Set the directory handle for file system operations
 */
export const setDirectoryHandle = (handle: FileSystemDirectoryHandle) => {
    directoryHandle = handle;
    // Immediately load invoices when handle is set
    loadInvoices().then(invoices => {
        cachedInvoices = invoices;
        updateNextInvoiceNumber();
    });
};

/**
 * Update the next invoice number based on existing invoices
 */
const updateNextInvoiceNumber = () => {
    let maxNumber = 0;
    cachedInvoices.forEach(invoice => {
        // Skip deleted invoices
        if (invoice.isDeleted) return;
        
        // Parse the invoice number - handle both "001" and "1" formats
        const num = parseInt(invoice.invoice_number, 10);
        if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
        }
    });
    
    nextInvoiceNumber = maxNumber + 1;
};

/**
 * Load all saved invoices, excluding deleted ones
 */
export const loadInvoices = async (): Promise<Invoice[]> => {
    if (!directoryHandle) return [];
    try {
        const invoices = await loadInvoicesFromFiles();
        cachedInvoices = invoices.filter(inv => !inv.isDeleted);
        updateNextInvoiceNumber();
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
            // Check if this is an existing invoice
            const existingIndex = cachedInvoices.findIndex(inv => inv.id === invoice.id);
            if (existingIndex !== -1) {
                // Update existing invoice
                updatedInvoice = { ...cachedInvoices[existingIndex], ...invoice, lastModified: now };
                cachedInvoices[existingIndex] = updatedInvoice;
            } else {
                // This is a new invoice that already has an ID (e.g., from rectification)
                updatedInvoice = {
                    ...invoice,
                    lastModified: now,
                    isDeleted: false,
                } as Invoice;
                cachedInvoices.push(updatedInvoice);
                
                // Update the counter if this is a new invoice with a numeric invoice number
                const invoiceNum = parseInt(updatedInvoice.invoice_number, 10);
                if (!isNaN(invoiceNum) && invoiceNum >= nextInvoiceNumber) {
                    nextInvoiceNumber = invoiceNum + 1;
                }
            }
        } else {
            // Create new invoice with generated ID
            updatedInvoice = {
                ...invoice,
                id: uuidv4(),
                lastModified: now,
                isDeleted: false,
            } as Invoice;
            cachedInvoices.push(updatedInvoice);
            
            // Update the counter if this is a new invoice with a numeric invoice number
            const invoiceNum = parseInt(updatedInvoice.invoice_number, 10);
            if (!isNaN(invoiceNum) && invoiceNum >= nextInvoiceNumber) {
                nextInvoiceNumber = invoiceNum + 1;
            }
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
 * Delete an invoice by ID
 */
export const deleteInvoice = async (id: string): Promise<boolean> => {
    if (!directoryHandle) {
        throw new Error('No directory handle available. Please grant file access permissions.');
    }

    try {
        const invoiceIndex = cachedInvoices.findIndex(inv => inv.id === id);
        if (invoiceIndex === -1) {
            throw new Error(`Invoice with id ${id} not found.`);
        }

        // Mark as deleted instead of actually deleting
        const deletedInvoice = { ...cachedInvoices[invoiceIndex], isDeleted: true, lastModified: new Date().toISOString() };
        cachedInvoices[invoiceIndex] = deletedInvoice;

        // Save the updated invoice (marked as deleted)
        await saveInvoiceToFile(deletedInvoice);
        await saveInvoiceToGoogleDrive(deletedInvoice);

        // Recalculate the counter since we might have deleted a high-numbered invoice
        updateNextInvoiceNumber();

        return true;
    } catch (error) {
        console.error('Error deleting invoice:', error);
        throw error;
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

/**
 * Generate next sequential invoice number
 * Uses cached counter to avoid race conditions
 */
export const generateNextInvoiceNumber = async (): Promise<string> => {
    // Ensure we have the latest data
    await loadInvoices();
    
    // Use the cached counter and increment it
    const number = nextInvoiceNumber;
    nextInvoiceNumber++;
    
    return number.toString().padStart(3, '0');
};

// Adapter to domain repository interface
export const invoiceRepositoryAdapter: InvoiceRepository = {
    setDirectoryHandle,
    loadInvoices,
    loadInvoicesSync,
    getInvoiceById,
    saveInvoice,
    deleteInvoice,
    searchInvoices,
    generateNextInvoiceNumber,
};

/**
 * Create both rectification and corrected invoice with proper sequential numbering
 * This ensures correct invoice number sequence, including Storno invoices
 */
export const createRectificationPair = async (originalInvoice: Invoice): Promise<{
    rectificationInvoice: Invoice;
    correctedInvoiceTemplate: Invoice;
    originalInvoiceUpdated: Invoice;
}> => {
    // Ensure we have the latest data
    await loadInvoices();
    
    // Generate TWO sequential numbers atomically
    const rectificationNumber = nextInvoiceNumber;
    const correctedNumber = nextInvoiceNumber + 1;
    
    // Update the counter to reserve both numbers
    nextInvoiceNumber += 2;
    
    // Create rectification invoice with negative amounts
    const rectificationInvoice: Invoice = {
        ...originalInvoice,
        id: uuidv4(),
        invoice_number: rectificationNumber.toString().padStart(3, '0'),
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
        items: [
            {
                name: `Stornorechnung zu Rechnung #${originalInvoice.invoice_number} vom ${formatDate(originalInvoice.invoice_date)}`,
                quantity: 1,
                price: 0
            },
            ...originalInvoice.items.map(item => ({
            ...item,
            price: -item.price // Negative prices for cancellation
        }))],
        total: -originalInvoice.total, // Negative total
        notes: `Stornorechnung (Rechnungsstorno) zu Rechnung #${originalInvoice.invoice_number} vom ${formatDate(originalInvoice.invoice_date)}.\n\nDiese Stornorechnung macht die ursprüngliche Rechnung vollständig rückgängig.\n\nUrsprüngliche Notizen:\n${originalInvoice.notes || ''}`,
        // Stornorechnung: do not set explicit status; it will be derived
        status: undefined,
        is_paid: false,
        lastModified: new Date().toISOString(),
        isDeleted: false,
        isRectified: false, // Rectification invoice itself is not rectified
        rectifiedBy: undefined
    };
    
    // Create corrected invoice template
    const correctedInvoiceTemplate: Invoice = {
        ...originalInvoice,
        id: uuidv4(),
        invoice_number: correctedNumber.toString().padStart(3, '0'),
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
        notes: `Korrigierte Rechnung (Ersatz) zu Rechnung #${originalInvoice.invoice_number}.\n\nDiese Rechnung ersetzt die Stornorechnung #${rectificationNumber.toString().padStart(3, '0')}.\n\n${originalInvoice.notes || ''}`,
        status: InvoiceStatus.Unpaid,
        is_paid: false,
        lastModified: new Date().toISOString(),
        isDeleted: false,
        isRectified: false, // Corrected invoice is not rectified
        rectifiedBy: undefined
    };
    
    // Mark the original invoice as rectified
    const originalInvoiceUpdated: Invoice = {
        ...originalInvoice,
        isRectified: true,
        rectifiedBy: rectificationNumber.toString().padStart(3, '0'),
        status: InvoiceStatus.Rectified,
        lastModified: new Date().toISOString()
    };
    
    return {
        rectificationInvoice,
        correctedInvoiceTemplate,
        originalInvoiceUpdated
    };
};

/**
 * Create a rectification (cancellation) invoice from an existing invoice
 * This creates a "Stornorechnung" according to German law
 * @deprecated Use createRectificationPair instead for proper numbering
 */
export const createRectificationInvoice = async (originalInvoice: Invoice): Promise<Invoice> => {
    console.warn('createRectificationInvoice is deprecated. Use createRectificationPair instead.');
    const { rectificationInvoice } = await createRectificationPair(originalInvoice);
    return rectificationInvoice;
};

/**
 * Create a corrected invoice template from an existing invoice
 * This creates a new invoice with the same content but new invoice number
 * @deprecated Use createRectificationPair instead for proper numbering
 */
export const createCorrectedInvoiceTemplate = async (originalInvoice: Invoice): Promise<Invoice> => {
    console.warn('createCorrectedInvoiceTemplate is deprecated. Use createRectificationPair instead.');
    const { correctedInvoiceTemplate } = await createRectificationPair(originalInvoice);
    return correctedInvoiceTemplate;
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