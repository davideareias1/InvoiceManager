'use client';

import { Invoice } from '../interfaces';

// Constants
const DIRECTORY_HANDLE_KEY = 'invoice-directory-handle';
const FILE_EXTENSION = '.json';
const CUSTOMERS_DIRECTORY = 'customers';
const PRODUCTS_DIRECTORY = 'products';
const INVOICES_DIRECTORY = 'invoices';

// Type definition for FileSystemDirectoryHandle since it might not be recognized in TypeScript
declare global {
    interface FileSystemDirectoryHandle {
        getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
        getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
        values(): AsyncIterable<FileSystemHandle>;
    }

    interface FileSystemFileHandle {
        getFile(): Promise<File>;
        createWritable(): Promise<FileSystemWritableFileStream>;
    }

    interface FileSystemWritableFileStream extends WritableStream {
        write(data: string | ArrayBuffer | ArrayBufferView | Blob): Promise<void>;
        seek(position: number): Promise<void>;
        truncate(size: number): Promise<void>;
    }

    interface Window {
        showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
    }
}

export { };

// Global variables
let directoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Set the directory handle for file system operations
 */
export function setDirectoryHandle(handle: FileSystemDirectoryHandle | null): void {
    directoryHandle = handle;
    if (handle) {
        // Initialize directory structure whenever directory handle is set
        initializeDirectoryStructure().catch(err => {
            console.error('Failed to initialize directory structure:', err);
        });
    }
}

/**
 * Check if File System Access API is supported in the current browser
 */
export function isFileSystemAccessSupported(): boolean {
    return 'showDirectoryPicker' in window;
}

/**
 * Create or get directory if doesn't exist
 */
async function getOrCreateDirectory(parentHandle: FileSystemDirectoryHandle, directoryName: string): Promise<FileSystemDirectoryHandle> {
    try {
        return await parentHandle.getDirectoryHandle(directoryName, { create: true });
    } catch (error) {
        console.error(`Error creating directory ${directoryName}:`, error);
        throw error;
    }
}

/**
 * Initialize required directory structure
 */
async function initializeDirectoryStructure(): Promise<boolean> {
    if (!directoryHandle) {
        return false;
    }

    try {
        // Create main directories if they don't exist
        await getOrCreateDirectory(directoryHandle, CUSTOMERS_DIRECTORY);
        await getOrCreateDirectory(directoryHandle, PRODUCTS_DIRECTORY);

        // Create invoices directory
        const invoicesDir = await getOrCreateDirectory(directoryHandle, INVOICES_DIRECTORY);

        // Create current year directory inside invoices
        const currentYear = new Date().getFullYear().toString();
        await getOrCreateDirectory(invoicesDir, currentYear);

        return true;
    } catch (error) {
        console.error('Error initializing directory structure:', error);
        return false;
    }
}

/**
 * Save a customer to file
 */
export async function saveCustomerToFile(customer: any): Promise<boolean> {
    if (!directoryHandle) {
        return false;
    }

    try {
        // Get or create customers directory
        const customersDir = await getOrCreateDirectory(directoryHandle, CUSTOMERS_DIRECTORY);

        // Create a filename based on customer ID or name (sanitized)
        const filename = `customer_${customer.id || sanitizeFilename(customer.name)}${FILE_EXTENSION}`;

        // Get file handle
        const fileHandle = await customersDir.getFileHandle(filename, { create: true });

        // Create writable
        const writable = await fileHandle.createWritable();

        // Write customer data
        await writable.write(JSON.stringify(customer, null, 2));

        // Close the file
        await writable.close();

        return true;
    } catch (error) {
        console.error('Error saving customer:', error);
        return false;
    }
}

/**
 * Save a product to file
 */
export async function saveProductToFile(product: any): Promise<boolean> {
    if (!directoryHandle) {
        return false;
    }

    try {
        // Get or create products directory
        const productsDir = await getOrCreateDirectory(directoryHandle, PRODUCTS_DIRECTORY);

        // Create a filename based on product ID or name (sanitized)
        const filename = `product_${product.id || sanitizeFilename(product.name)}${FILE_EXTENSION}`;

        // Get file handle
        const fileHandle = await productsDir.getFileHandle(filename, { create: true });

        // Create writable
        const writable = await fileHandle.createWritable();

        // Write product data
        await writable.write(JSON.stringify(product, null, 2));

        // Close the file
        await writable.close();

        return true;
    } catch (error) {
        console.error('Error saving product:', error);
        return false;
    }
}

/**
 * Load all customers from files
 */
export async function loadCustomersFromFiles(): Promise<any[]> {
    if (!directoryHandle) {
        return [];
    }

    try {
        // Get customers directory
        const customersDir = await getOrCreateDirectory(directoryHandle, CUSTOMERS_DIRECTORY);

        const customers: any[] = [];

        // Iterate through files in the directory
        for await (const entry of customersDir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith(FILE_EXTENSION)) {
                try {
                    const fileHandle = await customersDir.getFileHandle(entry.name);
                    const file = await fileHandle.getFile();
                    const contents = await file.text();
                    const customer = JSON.parse(contents);

                    customers.push(customer);
                } catch (error) {
                    console.error(`Error reading customer file ${entry.name}:`, error);
                }
            }
        }

        return customers;
    } catch (error) {
        console.error('Error loading customers:', error);
        return [];
    }
}

/**
 * Load all products from files
 */
export async function loadProductsFromFiles(): Promise<any[]> {
    if (!directoryHandle) {
        return [];
    }

    try {
        // Get products directory
        const productsDir = await getOrCreateDirectory(directoryHandle, PRODUCTS_DIRECTORY);

        const products: any[] = [];

        // Iterate through files in the directory
        for await (const entry of productsDir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith(FILE_EXTENSION)) {
                try {
                    const fileHandle = await productsDir.getFileHandle(entry.name);
                    const file = await fileHandle.getFile();
                    const contents = await file.text();
                    const product = JSON.parse(contents);

                    products.push(product);
                } catch (error) {
                    console.error(`Error reading product file ${entry.name}:`, error);
                }
            }
        }

        return products;
    } catch (error) {
        console.error('Error loading products:', error);
        return [];
    }
}

/**
 * Save an invoice to a file with year folder organization
 */
export async function saveInvoiceToFile(invoice: Invoice): Promise<boolean> {
    if (!directoryHandle) {
        return false;
    }

    try {
        // Get base invoices directory
        const invoicesDir = await getOrCreateDirectory(directoryHandle, INVOICES_DIRECTORY);

        // Get year from invoice date
        const invoiceDate = new Date(invoice.invoice_date);
        const year = invoiceDate.getFullYear().toString();

        // Get or create year directory
        const yearDir = await getOrCreateDirectory(invoicesDir, year);

        // Create a filename based on invoice number
        const filename = `invoice_${invoice.invoice_number}${FILE_EXTENSION}`;

        // Get file handle
        const fileHandle = await yearDir.getFileHandle(filename, { create: true });

        // Create writable
        const writable = await fileHandle.createWritable();

        // Write invoice data
        await writable.write(JSON.stringify(invoice, null, 2));

        // Close the file
        await writable.close();

        return true;
    } catch (error) {
        console.error(`Error saving invoice ${invoice.invoice_number}:`, error);
        return false;
    }
}

/**
 * Initialize file system with saved directory handle
 */
export async function initializeFileSystem(): Promise<boolean> {
    if (!isFileSystemAccessSupported()) {
        return false;
    }

    try {
        const savedHandle = await getSavedDirectoryHandle();
        if (savedHandle) {
            // Verify permission is still granted
            if (await verifyPermission(savedHandle)) {
                directoryHandle = savedHandle;

                // Initialize directory structure
                await initializeDirectoryStructure();

                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error initializing file system:', error);
        return false;
    }
}

/**
 * Check if a directory has been saved
 */
export async function hasSavedDirectory(): Promise<boolean> {
    if (!isFileSystemAccessSupported()) {
        return false;
    }

    try {
        const handle = await getSavedDirectoryHandle();
        return handle !== null;
    } catch (error) {
        return false;
    }
}

/**
 * Request permission to access a directory
 */
export async function requestDirectoryPermission(): Promise<boolean> {
    if (!isFileSystemAccessSupported()) {
        return false;
    }

    try {
        // Request directory access
        const handle = await window.showDirectoryPicker!();

        // Save the handle
        await saveDirectoryHandle(handle);

        // Set current handle
        directoryHandle = handle;

        // Initialize directory structure
        await initializeDirectoryStructure();

        return true;
    } catch (error) {
        console.error('Error requesting directory permission:', error);
        return false;
    }
}

/**
 * Load invoices from files in the selected directory (now organized by year)
 */
export async function loadInvoicesFromFiles(): Promise<Invoice[]> {
    if (!directoryHandle) {
        return [];
    }

    try {
        // Get base invoices directory
        const invoicesDir = await getOrCreateDirectory(directoryHandle, INVOICES_DIRECTORY);

        const invoices: Invoice[] = [];

        // Iterate through year directories in the invoices directory
        for await (const yearEntry of invoicesDir.values()) {
            if (yearEntry.kind === 'directory') {
                try {
                    const yearDir = await invoicesDir.getDirectoryHandle(yearEntry.name);

                    // Iterate through files in the year directory
                    for await (const fileEntry of yearDir.values()) {
                        if (fileEntry.kind === 'file' && fileEntry.name.endsWith(FILE_EXTENSION)) {
                            try {
                                const fileHandle = await yearDir.getFileHandle(fileEntry.name);
                                const file = await fileHandle.getFile();
                                const contents = await file.text();
                                const invoice = JSON.parse(contents) as Invoice;

                                // Validate that this is actually an Invoice object
                                if (invoice && typeof invoice === 'object' && 'invoice_number' in invoice) {
                                    invoices.push(invoice);
                                } else {
                                    console.warn(`File ${fileEntry.name} does not contain valid invoice data`);
                                }
                            } catch (error) {
                                console.error(`Error reading file ${fileEntry.name}:`, error);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error reading year directory ${yearEntry.name}:`, error);
                }
            }
        }

        // Sort invoices by date (newest first)
        return invoices.sort((a, b) => {
            return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
        });
    } catch (error) {
        console.error('Error loading invoices from files:', error);
        return [];
    }
}

/**
 * Delete an invoice file (considering year organization)
 */
export async function deleteInvoiceFile(invoiceNumber: string): Promise<boolean> {
    if (!directoryHandle) {
        return false;
    }

    try {
        // Get base invoices directory
        const invoicesDir = await getOrCreateDirectory(directoryHandle, INVOICES_DIRECTORY);

        // We need to search through all year directories since we don't know the year
        let deleted = false;

        // Iterate through year directories
        for await (const yearEntry of invoicesDir.values()) {
            if (yearEntry.kind === 'directory') {
                try {
                    const yearDir = await invoicesDir.getDirectoryHandle(yearEntry.name);
                    const filename = getInvoiceFilename(invoiceNumber);

                    try {
                        // Try to remove the file from this year directory
                        await yearDir.removeEntry(filename);
                        deleted = true;
                        break; // File found and deleted, no need to check other years
                    } catch (error) {
                        // File not found in this year, continue to next
                    }
                } catch (error) {
                    console.error(`Error accessing year directory ${yearEntry.name}:`, error);
                }
            }
        }

        return deleted;
    } catch (error) {
        console.error('Error deleting invoice file:', error);
        return false;
    }
}

/**
 * Helper function to sanitize filenames
 */
function sanitizeFilename(name: string): string {
    // Replace special characters with underscore
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Helper functions

/**
 * Get standardized filename for an invoice
 */
function getInvoiceFilename(invoiceNumber: string): string {
    return `invoice_${invoiceNumber}${FILE_EXTENSION}`;
}

/**
 * Verify if we still have permission to the directory
 */
async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const options = { mode: 'readwrite' } as const;

    // Check current permission
    if ((await handle.queryPermission(options)) === 'granted') {
        return true;
    }

    // Request permission if not already granted
    return (await handle.requestPermission(options)) === 'granted';
}

/**
 * Save the directory handle to IndexedDB
 */
async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    if (typeof window !== 'undefined') {
        try {
            // Use IndexedDB to store the handle
            const db = await openDatabase();
            const tx = db.transaction(['handles'], 'readwrite');
            const store = tx.objectStore('handles');
            await store.put(handle, DIRECTORY_HANDLE_KEY);
            await new Promise((resolve) => {
                tx.oncomplete = () => resolve(undefined);
                tx.onerror = () => resolve(undefined);
            });
            db.close();
        } catch (error) {
            console.error('Error saving directory handle:', error);
        }
    }
}

/**
 * Get the saved directory handle from IndexedDB
 */
export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (typeof window !== 'undefined') {
        try {
            const db = await openDatabase();
            const tx = db.transaction(['handles'], 'readonly');
            const store = tx.objectStore('handles');
            const request = store.get(DIRECTORY_HANDLE_KEY);
            await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            });
            await new Promise((resolve) => {
                tx.oncomplete = () => resolve(undefined);
                tx.onerror = () => resolve(undefined);
            });
            db.close();
            return request.result as FileSystemDirectoryHandle || null;
        } catch (error) {
            console.error('Error getting saved directory handle:', error);
            return null;
        }
    }
    return null;
}

/**
 * Open IndexedDB database for storing directory handles
 */
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FileSystemAccessDB', 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('handles')) {
                db.createObjectStore('handles');
            }
        };

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Delete a customer file
 */
export async function deleteCustomerFile(customerId: string): Promise<boolean> {
    if (!directoryHandle) {
        return false;
    }

    try {
        // Get customers directory
        const customersDir = await getOrCreateDirectory(directoryHandle, CUSTOMERS_DIRECTORY);

        let deleted = false;

        // Iterate through files to find customer with this ID
        for await (const entry of customersDir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith(FILE_EXTENSION)) {
                try {
                    const fileHandle = await customersDir.getFileHandle(entry.name);
                    const file = await fileHandle.getFile();
                    const contents = await file.text();
                    const customer = JSON.parse(contents);

                    if (customer.id === customerId) {
                        // This is the customer to delete
                        // In the File System Access API, we need to delete via the parent directory
                        // @ts-ignore - The removeEntry method might not be recognized in TypeScript
                        await customersDir.removeEntry(entry.name);
                        deleted = true;
                        break;
                    }
                } catch (error) {
                    console.error(`Error reading or deleting customer file ${entry.name}:`, error);
                }
            }
        }

        return deleted;
    } catch (error) {
        console.error('Error deleting customer:', error);
        return false;
    }
}

/**
 * Delete a product file
 */
export async function deleteProductFile(productId: string): Promise<boolean> {
    if (!directoryHandle) {
        return false;
    }

    try {
        // Get products directory
        const productsDir = await getOrCreateDirectory(directoryHandle, PRODUCTS_DIRECTORY);

        let deleted = false;

        // Iterate through files to find product with this ID
        for await (const entry of productsDir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith(FILE_EXTENSION)) {
                try {
                    const fileHandle = await productsDir.getFileHandle(entry.name);
                    const file = await fileHandle.getFile();
                    const contents = await file.text();
                    const product = JSON.parse(contents);

                    if (product.id === productId) {
                        // This is the product to delete
                        // @ts-ignore - The removeEntry method might not be recognized in TypeScript
                        await productsDir.removeEntry(entry.name);
                        deleted = true;
                        break;
                    }
                } catch (error) {
                    console.error(`Error reading or deleting product file ${entry.name}:`, error);
                }
            }
        }

        return deleted;
    } catch (error) {
        console.error('Error deleting product:', error);
        return false;
    }
} 