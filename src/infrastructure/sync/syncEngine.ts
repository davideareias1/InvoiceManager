'use client';

import { SyncProgress, SyncResult, SyncConflict, SyncableData } from './types';
import { updateSyncState, markSyncComplete, updateDataHash } from './syncState';
import { isOnline } from './networkMonitor';
import {
    isGoogleDriveAuthenticated,
    downloadAllDataFromDrive,
    uploadAllDataToDrive,
} from '../google/googleDriveStorage';
import {
    loadInvoicesFromFiles,
    loadCustomersFromFiles,
    loadProductsFromFiles,
    loadCompanyInfoFromFile,
    saveInvoiceToFile,
    saveCustomerToFile,
    saveProductToFile,
    saveCompanyInfoToFile,
} from '../filesystem/fileSystemStorage';
import { Invoice, CustomerData, ProductData, CompanyInfo } from '../../domain/models';

let isSyncing = false;
let syncLock = false;

/**
 * Main bidirectional sync function
 * Pulls from Drive, merges with local using last-write-wins, pushes changes back
 */
export async function syncWithDrive(
    onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
    // Prevent concurrent syncs
    if (syncLock) {
        console.log('Sync already in progress, skipping');
        return {
            success: false,
            error: new Error('Sync already in progress'),
            stats: { pulled: 0, pushed: 0, merged: 0, conflicts: 0 },
        };
    }

    // Check online status
    if (!isOnline()) {
        return {
            success: false,
            error: new Error('Cannot sync while offline'),
            stats: { pulled: 0, pushed: 0, merged: 0, conflicts: 0 },
        };
    }

    // Check authentication
    if (!(await isGoogleDriveAuthenticated())) {
        return {
            success: false,
            error: new Error('Not authenticated with Google Drive'),
            stats: { pulled: 0, pushed: 0, merged: 0, conflicts: 0 },
        };
    }

    syncLock = true;
    isSyncing = true;

    try {
        const conflicts: SyncConflict[] = [];
        let pulledCount = 0;
        let pushedCount = 0;
        let mergedCount = 0;

        // Step 1: Pull from Drive
        onProgress?.({
            current: 1,
            total: 4,
            stage: 'pulling',
            message: 'Downloading data from Google Drive...',
        });

        const remoteData = await downloadAllDataFromDrive();
        pulledCount = 
            remoteData.invoices.length +
            remoteData.customers.length +
            remoteData.products.length +
            (remoteData.companyInfo ? 1 : 0);

        // Step 2: Load local data
        onProgress?.({
            current: 2,
            total: 4,
            stage: 'merging',
            message: 'Loading local data...',
        });

        const localData = await loadLocalData();

        // Step 3: Merge with conflict resolution
        onProgress?.({
            current: 3,
            total: 4,
            stage: 'merging',
            message: 'Merging data and resolving conflicts...',
        });

        const mergeResult = await mergeData(localData, remoteData, conflicts);
        mergedCount = mergeResult.merged;

        // Step 4: Push merged data back to Drive and save locally
        onProgress?.({
            current: 4,
            total: 4,
            stage: 'pushing',
            message: 'Uploading changes to Google Drive...',
        });

        await saveMergedData(mergeResult.data);
        await uploadAllDataToDrive(mergeResult.data);
        pushedCount = mergeResult.merged;

        // Update sync state
        updateDataHash(mergeResult.data);
        markSyncComplete();

        onProgress?.({
            current: 4,
            total: 4,
            stage: 'complete',
            message: 'Sync complete',
        });

        return {
            success: true,
            conflicts,
            stats: {
                pulled: pulledCount,
                pushed: pushedCount,
                merged: mergedCount,
                conflicts: conflicts.length,
            },
        };
    } catch (error) {
        console.error('Sync error:', error);
        return {
            success: false,
            error: error as Error,
            stats: { pulled: 0, pushed: 0, merged: 0, conflicts: 0 },
        };
    } finally {
        syncLock = false;
        isSyncing = false;
    }
}

/**
 * Pull-only sync: restore data from Drive (for initial data source selection)
 */
export async function restoreFromDrive(
    onProgress?: (progress: SyncProgress) => void
): Promise<SyncableData> {
    if (!isOnline()) {
        throw new Error('Cannot restore while offline');
    }

    if (!(await isGoogleDriveAuthenticated())) {
        throw new Error('Not authenticated with Google Drive');
    }

    onProgress?.({
        current: 1,
        total: 2,
        stage: 'pulling',
        message: 'Downloading data from Google Drive...',
    });

    const data = await downloadAllDataFromDrive();

    onProgress?.({
        current: 2,
        total: 2,
        stage: 'complete',
        message: 'Restore complete',
    });

    return data;
}

/**
 * Check if remote Drive has any data
 */
export async function hasRemoteData(): Promise<boolean> {
    if (!isOnline() || !(await isGoogleDriveAuthenticated())) {
        return false;
    }

    try {
        const data = await downloadAllDataFromDrive();
        return (
            data.invoices.length > 0 ||
            data.customers.length > 0 ||
            data.products.length > 0 ||
            data.companyInfo !== null
        );
    } catch (error) {
        console.error('Error checking remote data:', error);
        return false;
    }
}

/**
 * Load all local data
 */
async function loadLocalData(): Promise<SyncableData> {
    try {
        const [invoices, customers, products, companyInfo] = await Promise.all([
            loadInvoicesFromFiles(),
            loadCustomersFromFiles(),
            loadProductsFromFiles(),
            loadCompanyInfoFromFile(),
        ]);

        return {
            invoices,
            customers,
            products,
            companyInfo,
            timesheets: [], // TODO: Add timesheet loading
            taxSettings: null, // TODO: Add tax settings loading
        };
    } catch (error) {
        console.error('Error loading local data:', error);
        return {
            invoices: [],
            customers: [],
            products: [],
            companyInfo: null,
            timesheets: [],
            taxSettings: null,
        };
    }
}

/**
 * Merge local and remote data using last-write-wins strategy
 */
async function mergeData(
    local: SyncableData,
    remote: SyncableData,
    conflicts: SyncConflict[]
): Promise<{ data: SyncableData; merged: number }> {
    let mergedCount = 0;

    // Merge invoices
    const invoices = mergeEntities<Invoice>(
        local.invoices,
        remote.invoices,
        'invoice',
        conflicts
    );
    mergedCount += invoices.filter(inv => 
        remote.invoices.some(r => r.id === inv.id)
    ).length;

    // Merge customers
    const customers = mergeEntities<CustomerData>(
        local.customers,
        remote.customers,
        'customer',
        conflicts
    );
    mergedCount += customers.filter(cust => 
        remote.customers.some(r => r.id === cust.id)
    ).length;

    // Merge products
    const products = mergeEntities<ProductData>(
        local.products,
        remote.products,
        'product',
        conflicts
    );
    mergedCount += products.filter(prod => 
        remote.products.some(r => r.id === prod.id)
    ).length;

    // Merge company info (single entity)
    const companyInfo = mergeCompanyInfo(local.companyInfo, remote.companyInfo, conflicts);
    if (companyInfo && remote.companyInfo) {
        mergedCount += 1;
    }

    return {
        data: {
            invoices,
            customers,
            products,
            companyInfo,
            timesheets: local.timesheets, // TODO: Implement timesheet merging
            taxSettings: local.taxSettings, // TODO: Implement tax settings merging
        },
        merged: mergedCount,
    };
}

/**
 * Merge entities of the same type using last-write-wins
 */
function mergeEntities<T extends { id: string; lastModified: string; isDeleted?: boolean }>(
    localEntities: T[],
    remoteEntities: T[],
    entityType: 'invoice' | 'customer' | 'product',
    conflicts: SyncConflict[]
): T[] {
    const merged = new Map<string, T>();

    // Add all local entities
    localEntities.forEach(entity => {
        merged.set(entity.id, { ...entity, syncStatus: 'synced' as const });
    });

    // Process remote entities
    remoteEntities.forEach(remoteEntity => {
        const localEntity = merged.get(remoteEntity.id);

        if (!localEntity) {
            // New entity from remote
            merged.set(remoteEntity.id, { ...remoteEntity, syncStatus: 'synced' as const });
        } else {
            // Entity exists in both - resolve conflict
            const localTime = new Date(localEntity.lastModified).getTime();
            const remoteTime = new Date(remoteEntity.lastModified).getTime();

            if (remoteTime > localTime) {
                // Remote is newer - use remote
                conflicts.push({
                    entityType,
                    entityId: remoteEntity.id,
                    localTimestamp: localEntity.lastModified,
                    remoteTimestamp: remoteEntity.lastModified,
                    resolution: 'remote',
                });
                merged.set(remoteEntity.id, { ...remoteEntity, syncStatus: 'synced' as const });
            } else if (localTime > remoteTime) {
                // Local is newer - keep local but mark conflict
                conflicts.push({
                    entityType,
                    entityId: localEntity.id,
                    localTimestamp: localEntity.lastModified,
                    remoteTimestamp: remoteEntity.lastModified,
                    resolution: 'local',
                });
                // Keep local (already in map)
            }
            // If timestamps are equal, keep local (no conflict logged)
        }
    });

    return Array.from(merged.values()).filter(e => !e.isDeleted);
}

/**
 * Merge company info (single entity)
 */
function mergeCompanyInfo(
    local: CompanyInfo | null,
    remote: CompanyInfo | null,
    conflicts: SyncConflict[]
): CompanyInfo | null {
    if (!local && !remote) return null;
    if (!local) return { ...remote!, syncStatus: 'synced' as const };
    if (!remote) return { ...local, syncStatus: 'synced' as const };

    // Both exist - use last-write-wins
    const localTime = new Date(local.lastModified).getTime();
    const remoteTime = new Date(remote.lastModified).getTime();

    if (remoteTime > localTime) {
        conflicts.push({
            entityType: 'company',
            entityId: 'company_info',
            localTimestamp: local.lastModified,
            remoteTimestamp: remote.lastModified,
            resolution: 'remote',
        });
        return { ...remote, syncStatus: 'synced' as const };
    } else if (localTime > remoteTime) {
        conflicts.push({
            entityType: 'company',
            entityId: 'company_info',
            localTimestamp: local.lastModified,
            remoteTimestamp: remote.lastModified,
            resolution: 'local',
        });
    }

    return { ...local, syncStatus: 'synced' as const };
}

/**
 * Save merged data to local file system
 */
async function saveMergedData(data: SyncableData): Promise<void> {
    const savePromises: Promise<any>[] = [];

    // Save invoices
    data.invoices.forEach(invoice => {
        savePromises.push(saveInvoiceToFile(invoice).catch(error => {
            console.error(`Failed to save invoice ${invoice.id}:`, error);
        }));
    });

    // Save customers
    data.customers.forEach(customer => {
        savePromises.push(saveCustomerToFile(customer).catch(error => {
            console.error(`Failed to save customer ${customer.id}:`, error);
        }));
    });

    // Save products
    data.products.forEach(product => {
        savePromises.push(saveProductToFile(product).catch(error => {
            console.error(`Failed to save product ${product.id}:`, error);
        }));
    });

    // Save company info
    if (data.companyInfo) {
        savePromises.push(saveCompanyInfoToFile(data.companyInfo).catch(error => {
            console.error('Failed to save company info:', error);
        }));
    }

    await Promise.allSettled(savePromises);
}

/**
 * Check if sync is currently in progress
 */
export function isSyncInProgress(): boolean {
    return isSyncing;
}

/**
 * Get sync lock status
 */
export function isSyncLocked(): boolean {
    return syncLock;
}

