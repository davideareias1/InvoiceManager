'use client';

import { CustomerData } from '../interfaces';
import { SavedCustomer } from './customerUtils';

/**
 * Saves customer data to a JSON file in the specified directory
 * To be used with the FileSystem API when available
 */
export async function saveCustomersToFile(customers: SavedCustomer[], directoryHandle: FileSystemDirectoryHandle): Promise<boolean> {
    try {
        // Create a file named customers.json
        const fileHandle = await directoryHandle.getFileHandle('customers.json', { create: true });
        const writable = await fileHandle.createWritable();

        // Write the customers data as JSON
        await writable.write(JSON.stringify(customers, null, 2));
        await writable.close();

        return true;
    } catch (error) {
        console.error('Error saving customers to file:', error);
        return false;
    }
}

/**
 * Loads customer data from a JSON file in the specified directory
 * To be used with the FileSystem API when available
 */
export async function loadCustomersFromFile(directoryHandle: FileSystemDirectoryHandle): Promise<SavedCustomer[]> {
    try {
        // Try to get the customers.json file
        try {
            const fileHandle = await directoryHandle.getFileHandle('customers.json');
            const file = await fileHandle.getFile();
            const contents = await file.text();
            return JSON.parse(contents);
        } catch (e) {
            // File doesn't exist yet, return empty array
            return [];
        }
    } catch (error) {
        console.error('Error loading customers from file:', error);
        return [];
    }
}

/**
 * Syncs customers between localStorage and the file system
 * This ensures customers are available in both places
 */
export async function syncCustomers(
    localCustomers: SavedCustomer[],
    directoryHandle: FileSystemDirectoryHandle
): Promise<SavedCustomer[]> {
    try {
        // Load customers from file
        const fileCustomers = await loadCustomersFromFile(directoryHandle);

        // Create a map for quick lookup
        const customerMap = new Map<string, SavedCustomer>();

        // Add all local customers to the map
        localCustomers.forEach(customer => {
            customerMap.set(customer.id, customer);
        });

        // Add or update with file customers
        fileCustomers.forEach(customer => {
            const existing = customerMap.get(customer.id);
            if (!existing || new Date(customer.updatedAt) > new Date(existing.updatedAt)) {
                customerMap.set(customer.id, customer);
            }
        });

        // Convert map back to array
        const mergedCustomers = Array.from(customerMap.values());

        // Save the merged list back to file
        await saveCustomersToFile(mergedCustomers, directoryHandle);

        return mergedCustomers;
    } catch (error) {
        console.error('Error syncing customers:', error);
        return localCustomers;
    }
} 