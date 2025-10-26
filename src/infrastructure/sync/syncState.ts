'use client';

import md5 from 'blueimp-md5';
import { SyncState } from './types';

const SYNC_STATE_KEY = 'invoice-manager-sync-state';

/**
 * Get current sync state from localStorage
 */
export function getSyncState(): SyncState {
    if (typeof window === 'undefined') {
        return getDefaultSyncState();
    }

    try {
        const stored = localStorage.getItem(SYNC_STATE_KEY);
        if (!stored) {
            return getDefaultSyncState();
        }

        const parsed = JSON.parse(stored);
        return {
            ...getDefaultSyncState(),
            ...parsed,
        };
    } catch (error) {
        console.error('Error reading sync state:', error);
        return getDefaultSyncState();
    }
}

/**
 * Update sync state in localStorage
 */
export function updateSyncState(updates: Partial<SyncState>): SyncState {
    const current = getSyncState();
    const updated = { ...current, ...updates };

    try {
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Error saving sync state:', error);
    }

    return updated;
}

/**
 * Clear sync state (useful for troubleshooting or reset)
 */
export function clearSyncState(): void {
    try {
        localStorage.removeItem(SYNC_STATE_KEY);
    } catch (error) {
        console.error('Error clearing sync state:', error);
    }
}

/**
 * Strip volatile fields from an entity
 */
function stripVolatileFields(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
        return obj.map(stripVolatileFields);
    }
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            // Ignore volatile fields that should not affect content hashing
            if (key === 'syncStatus' || key === 'lastModified' || key === 'updatedAt' || key === 'createdAt') {
                continue;
            }
            result[key] = stripVolatileFields(obj[key]);
        }
        return result;
    }
    return obj;
}

/**
 * Deterministic JSON stringify (recursively sorts object keys)
 */
function deterministicStringify(obj: any): string {
    if (obj === null || obj === undefined) return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(deterministicStringify).join(',') + ']';
    if (typeof obj === 'object') {
        const keys = Object.keys(obj).sort();
        const body = keys.map(k => `"${k}":${deterministicStringify(obj[k])}`).join(',');
        return '{' + body + '}';
    }
    return JSON.stringify(obj);
}

/**
 * Compute hash of data using per-file hashing (order-independent)
 * Each entity is hashed individually by ID, then combined
 */
export function computeDataHash(data: any): string {
    try {
        const fileHashes: Record<string, string> = {};
        
        // Hash each invoice by its ID
        if (data.invoices && Array.isArray(data.invoices)) {
            data.invoices.forEach((invoice: any) => {
                const clean = stripVolatileFields(invoice);
                const numberKey = invoice?.invoice_number ? String(invoice.invoice_number).padStart(3, '0') : null;
                const idKey = invoice?.id || null;
                const keyId = numberKey || idKey || md5(deterministicStringify(clean));
                const key = `invoice:${keyId}`;
                fileHashes[key] = md5(deterministicStringify(clean));
            });
        }
        
        // Hash each customer by its ID
        if (data.customers && Array.isArray(data.customers)) {
            data.customers.forEach((customer: any) => {
                const clean = stripVolatileFields(customer);
                const idOrName = customer?.id || (customer?.name ? String(customer.name).trim() : null) || md5(deterministicStringify(clean));
                const key = `customer:${idOrName}`;
                fileHashes[key] = md5(deterministicStringify(clean));
            });
        }
        
        // Hash each product by its ID
        if (data.products && Array.isArray(data.products)) {
            data.products.forEach((product: any) => {
                const clean = stripVolatileFields(product);
                const idOrName = product?.id || (product?.name ? String(product.name).trim() : null) || md5(deterministicStringify(clean));
                const key = `product:${idOrName}`;
                fileHashes[key] = md5(deterministicStringify(clean));
            });
        }
        
        // Hash company info
        if (data.companyInfo) {
            const clean = stripVolatileFields(data.companyInfo);
            fileHashes['company:info'] = md5(deterministicStringify(clean));
        }
        
        // Sort keys and combine hashes (order-independent!)
        const sortedKeys = Object.keys(fileHashes).sort();
        const combinedHash = sortedKeys.map(k => `${k}=${fileHashes[k]}`).join('|');
        
        return md5(combinedHash);
    } catch (error) {
        console.error('Error computing data hash:', error);
        return '';
    }
}

/**
 * Check if data has changed since last sync
 */
const DEBUG_SYNC = false;

export function hasDataChanged(currentData: any): boolean {
    const state = getSyncState();
    if (!state.lastDataHash) {
        console.log('No previous data hash found, considering data as changed');
        return true; // No previous hash, consider it changed
    }

    const currentHash = computeDataHash(currentData);
    const hasChanged = currentHash !== state.lastDataHash;
    
    if (DEBUG_SYNC) {
        if (hasChanged) {
            console.log('⚠️ Data has changed:', {
                previousHash: state.lastDataHash.substring(0, 8) + '...',
                currentHash: currentHash.substring(0, 8) + '...',
                invoiceCount: currentData.invoices?.length || 0,
                customerCount: currentData.customers?.length || 0,
                productCount: currentData.products?.length || 0,
                hasCompanyInfo: !!currentData.companyInfo,
            });
            if (currentData.invoices?.length > 0) {
                const sampleInvoice = currentData.invoices[0];
                console.log('Sample invoice #:', sampleInvoice.invoice_number, 'ID:', sampleInvoice.id?.substring(0, 8));
                console.log('Sample invoice keys:', Object.keys(sampleInvoice).sort());
                console.log('Sample invoice lastModified:', sampleInvoice.lastModified);
                console.log('Sample invoice isDeleted:', sampleInvoice.isDeleted);
                console.log('All invoice numbers:', currentData.invoices.map((inv: any) => inv.invoice_number).join(', '));
                if (sampleInvoice.customer) {
                    console.log('Customer in invoice has updatedAt:', !!sampleInvoice.customer.updatedAt);
                    console.log('Customer in invoice has lastModified:', !!sampleInvoice.customer.lastModified);
                }
            }
        } else {
            console.log('✓ No changes detected in data');
        }
    }
    
    return hasChanged;
}

/**
 * Update the last known data hash
 */
export function updateDataHash(data: any): void {
    const hash = computeDataHash(data);
    const prevState = getSyncState();
    const prevHash = prevState.lastDataHash;
    
    if (DEBUG_SYNC) {
        if (prevHash && prevHash !== hash) {
            console.log(`📝 Hash changed: ${prevHash.substring(0, 8)}... → ${hash.substring(0, 8)}...`);
        } else if (!prevHash) {
            console.log(`📝 Initial hash: ${hash.substring(0, 8)}...`);
        } else {
            console.log(`✓ Hash stable: ${hash.substring(0, 8)}...`);
        }
    }
    
    // Only update if hash actually changed to prevent unnecessary state writes
    if (prevHash !== hash) {
        updateSyncState({ lastDataHash: hash });
    }
}

/**
 * Mark sync as pending (data has changed and needs to be synced)
 */
export function markSyncPending(): void {
    updateSyncState({ isPendingSync: true });
}

/**
 * Mark data as dirty (user made changes)
 * Note: Individual files are uploaded immediately by repositories.
 * This flag is used for the periodic full sync to know if local changes exist.
 */
export function markDataDirty(): void {
    updateSyncState({ isPendingSync: true });
}

/**
 * Mark sync as complete
 */
export function markSyncComplete(): void {
    updateSyncState({
        isPendingSync: false,
        lastSyncTimestamp: new Date().toISOString(),
    });
}

/**
 * Check if sync is enabled
 */
export function isSyncEnabled(): boolean {
    return getSyncState().syncEnabled;
}

/**
 * Enable or disable sync
 */
export function setSyncEnabled(enabled: boolean): void {
    updateSyncState({ syncEnabled: enabled });
}

/**
 * These functions are deprecated - sync now automatically merges data using last-write-wins.
 * Keeping them for backward compatibility but they no longer affect sync behavior.
 */
export function isDataSourceSelected(): boolean {
    return true; // Always return true - no selection needed
}

export function setDataSource(source: 'local' | 'drive' | 'merged'): void {
    // No-op: data source selection is no longer required
    console.log(`Data source selection is deprecated. Sync will automatically merge data (newest wins).`);
}

export function getDataSource(): 'local' | 'drive' | 'merged' | null {
    return 'merged'; // Always merged using last-write-wins
}

export function resetDataSourceSelection(): void {
    // No-op: data source selection is no longer required
}

function getDefaultSyncState(): SyncState {
    return {
        lastSyncTimestamp: null,
        lastDataHash: null,
        isPendingSync: false,
        syncEnabled: false,
        dataSourceSelected: true, // Always true - no selection needed
        dataSource: 'merged', // Always merged using last-write-wins
    };
}

