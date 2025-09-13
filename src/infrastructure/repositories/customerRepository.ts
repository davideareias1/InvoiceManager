'use client';

import { CustomerData, CustomerRepository } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';
import { saveCustomerToFile, loadCustomersFromFiles, deleteCustomerFile } from '../filesystem/fileSystemStorage';
import { saveCustomerToGoogleDrive } from '../google/googleDriveStorage';

// Structure for a saved customer with ID
export interface SavedCustomer extends CustomerData {
    id: string;
    createdAt: string;
    updatedAt: string;
}

// Global variable to cache directory handle and customers
let directoryHandle: FileSystemDirectoryHandle | null = null;
let cachedCustomers: SavedCustomer[] = [];

/**
 * Set the directory handle for file system operations
 */
export const setDirectoryHandle = (handle: FileSystemDirectoryHandle) => {
    directoryHandle = handle;
    // Immediately load customers from file system when handle is set
    loadCustomers().then(customers => {
        cachedCustomers = customers;
    });
};

/**
 * Load all saved customers
 * @returns Array of saved customers
 */
export const loadCustomers = async (): Promise<SavedCustomer[]> => {
    if (!directoryHandle) return [];

    try {
        const customers = await loadCustomersFromFiles();
        // Update cache
        cachedCustomers = customers as SavedCustomer[];
        return cachedCustomers;
    } catch (error) {
        console.error('Error loading customers:', error);
        return [];
    }
};

/**
 * Simple synchronous version that uses cached data
 * Used when we need to avoid async operations
 */
export const loadCustomersSync = (): SavedCustomer[] => {
    return cachedCustomers;
};

/**
 * Save a new customer or update an existing one
 * @param customer Customer data to save
 * @returns The saved customer with ID
 */
export const saveCustomer = async (customer: CustomerData): Promise<SavedCustomer> => {
    if (!directoryHandle) {
        throw new Error('No directory handle available. Please grant file access permissions.');
    }

    try {
        const now = new Date().toISOString();

        // Check if this customer already exists based on name
        const existingIndex = cachedCustomers.findIndex(c => c.name === customer.name);

        let updatedCustomer: SavedCustomer;

        if (existingIndex >= 0) {
            // Update existing customer
            updatedCustomer = {
                ...cachedCustomers[existingIndex],
                ...customer,
                updatedAt: now
            };
            cachedCustomers[existingIndex] = updatedCustomer;
        } else {
            // Create new customer
            updatedCustomer = {
                ...customer,
                id: uuidv4(),
                createdAt: now,
                updatedAt: now
            };
            cachedCustomers.push(updatedCustomer);
        }

        // Save to file system
        await saveCustomerToFile(updatedCustomer);

        return updatedCustomer;
    } catch (error) {
        console.error('Error saving customer:', error);
        throw error;
    }
};

/**
 * Delete a customer
 * @param customerId ID of the customer to delete
 * @returns true if successful
 */
export const deleteCustomer = async (customerId: string): Promise<boolean> => {
    try {
        const updatedCustomers = cachedCustomers.filter(c => c.id !== customerId);

        if (updatedCustomers.length === cachedCustomers.length) {
            return false; // No customer was deleted
        }

        // Update cache
        cachedCustomers = updatedCustomers;

        // Try to delete from file system
        if (directoryHandle) {
            try {
                await deleteCustomerFile(customerId);
            } catch (error) {
                console.error('Error deleting customer file:', error);
                // Continue anyway as we've already updated the cache
            }
        }

        return true;
    } catch (error) {
        console.error('Error deleting customer:', error);
        return false;
    }
};

/**
 * Search for customers based on a query
 * @param query Search term
 * @returns Filtered list of customers
 */
export const searchCustomers = (query: string): SavedCustomer[] => {
    if (!query) return cachedCustomers;

    const lowerQuery = query.toLowerCase();

    return cachedCustomers.filter(customer =>
        customer.name.toLowerCase().includes(lowerQuery) ||
        customer.address.toLowerCase().includes(lowerQuery) ||
        customer.city.toLowerCase().includes(lowerQuery) ||
        (customer.number && customer.number.toLowerCase().includes(lowerQuery))
    );
}; 

// Adapter to domain repository interface (using SavedCustomer conforms to CustomerData superset)
export const customerRepositoryAdapter: CustomerRepository = {
    setDirectoryHandle,
    loadCustomers: async () => (await loadCustomers()) as unknown as CustomerData[],
    loadCustomersSync: () => loadCustomersSync() as unknown as CustomerData[],
    saveCustomer: async (c: CustomerData) => (await saveCustomer(c)) as unknown as CustomerData,
    deleteCustomer,
    searchCustomers: (q: string) => searchCustomers(q) as unknown as CustomerData[],
};