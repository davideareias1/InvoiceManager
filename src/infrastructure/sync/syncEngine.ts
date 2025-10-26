'use client';

import { SyncProgress, SyncResult, SyncConflict, SyncableData } from './types';
import { markSyncComplete } from './syncState';
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
    loadPersonalTaxSettingsFromFile,
    savePersonalTaxSettingsToFile,
} from '../filesystem/fileSystemStorage';
import { loadAllTimesheets } from '../repositories/timeTrackingRepository';
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
        const startTime = Date.now();
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

        const downloadStart = Date.now();
        const remoteData = await downloadAllDataFromDrive();
        const downloadTime = Date.now() - downloadStart;
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

        const saveStart = Date.now();
        await saveMergedData(mergeResult.data);
        const saveTime = Date.now() - saveStart;
        
        const uploadStart = Date.now();
        const actuallyUploaded = await uploadAllDataToDrive(mergeResult.data);
        const uploadTime = Date.now() - uploadStart;
        pushedCount = actuallyUploaded;

        // Mark sync complete and clear pending flag
        markSyncComplete();

        const totalTime = Date.now() - startTime;
        console.log(`⏱️ Sync timing: download=${downloadTime}ms, save=${saveTime}ms, upload=${uploadTime}ms, total=${totalTime}ms`);

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
 * Recursively ensure entity and all nested objects have required fields for sync
 */
function normalizeEntity<T extends Record<string, any>>(entity: T): T {
    const normalized: any = { ...entity };
    
    // Ensure lastModified exists at top level (handle empty strings)
    if (!normalized.lastModified || normalized.lastModified === '') {
        // Use updatedAt if available, otherwise use current time
        normalized.lastModified = normalized.updatedAt || new Date().toISOString();
    }
    
    // Ensure isDeleted exists at top level
    if (normalized.isDeleted === undefined) {
        normalized.isDeleted = false;
    }
    
    // Ensure isRectified exists for invoices
    if (normalized.isRectified === undefined && normalized.invoice_number) {
        normalized.isRectified = false;
    }
    
    // Recursively normalize nested objects (like customer in invoice)
    for (const key in normalized) {
        const value = normalized[key];
        
        // Skip null, undefined, and primitive values
        if (value === null || value === undefined || typeof value !== 'object') {
            continue;
        }
        
        // Handle arrays
        if (Array.isArray(value)) {
            normalized[key] = value.map(item => 
                typeof item === 'object' && item !== null ? normalizeNestedObject(item) : item
            );
        } else {
            // Handle nested objects
            normalized[key] = normalizeNestedObject(value);
        }
    }
    
    return normalized;
}

/**
 * Normalize a nested object (add lastModified if missing or empty)
 */
function normalizeNestedObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    const normalized = { ...obj };
    
    // Add lastModified if it's missing, empty, or updatedAt exists
    if ((!normalized.lastModified || normalized.lastModified === '') && normalized.updatedAt) {
        normalized.lastModified = normalized.updatedAt;
    }
    
    // Add isDeleted if missing
    if (normalized.isDeleted === undefined && normalized.id) {
        // Only add isDeleted if this looks like an entity (has an id)
        normalized.isDeleted = false;
    }
    
    return normalized;
}

/**
 * Load all local data
 */
async function loadLocalData(): Promise<SyncableData> {
    try {
        // Load JSON data (fast)
        const [invoices, customers, products, companyInfo, taxSettings] = await Promise.all([
            loadInvoicesFromFiles(),
            loadCustomersFromFiles(),
            loadProductsFromFiles(),
            loadCompanyInfoFromFile(),
            loadPersonalTaxSettingsFromFile(),
        ]);

        // Normalize all entities to ensure they have required fields
        const normalizedInvoices = invoices.map(normalizeEntity);
        const normalizedCustomers = customers.map(normalizeEntity);
        const normalizedProducts = products.map(normalizeEntity);
        const normalizedCompanyInfo = companyInfo ? normalizeEntity(companyInfo) : null;
        const normalizedTaxSettings = taxSettings ? normalizeEntity(taxSettings) : null;

        // Skip timesheets loading during sync - they're Excel files and slow
        // Timesheets are only uploaded when explicitly saved via timeTrackingRepository
        return {
            invoices: normalizedInvoices,
            customers: normalizedCustomers,
            products: normalizedProducts,
            companyInfo: normalizedCompanyInfo,
            timesheets: [], // Don't load timesheets on every sync (performance optimization)
            taxSettings: normalizedTaxSettings,
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

    // Merge tax settings (single entity)
    const taxSettings = mergeTaxSettings(local.taxSettings, remote.taxSettings, conflicts);
    if (taxSettings && remote.taxSettings) {
        mergedCount += 1;
    }

    return {
        data: {
            invoices,
            customers,
            products,
            companyInfo,
            timesheets: local.timesheets, // Keep local timesheets (Excel files uploaded as-is)
            taxSettings,
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
 * Merge tax settings (single entity)
 */
function mergeTaxSettings(
    local: any | null,
    remote: any | null,
    conflicts: SyncConflict[]
): any | null {
    if (!local && !remote) return null;
    if (!local) return { ...remote!, syncStatus: 'synced' as const };
    if (!remote) return { ...local, syncStatus: 'synced' as const };

    // Both exist - use last-write-wins
    const localTime = new Date(local.lastModified).getTime();
    const remoteTime = new Date(remote.lastModified).getTime();

    if (remoteTime > localTime) {
        conflicts.push({
            entityType: 'taxSettings',
            entityId: 'personal_tax_settings',
            localTimestamp: local.lastModified,
            remoteTimestamp: remote.lastModified,
            resolution: 'remote',
        });
        return { ...remote, syncStatus: 'synced' as const };
    } else if (localTime > remoteTime) {
        conflicts.push({
            entityType: 'taxSettings',
            entityId: 'personal_tax_settings',
            localTimestamp: local.lastModified,
            remoteTimestamp: remote.lastModified,
            resolution: 'local',
        });
    }

    return { ...local, syncStatus: 'synced' as const };
}

/**
 * Remove syncStatus from an entity before saving
 */
function cleanEntityForSave<T extends Record<string, any>>(entity: T): Omit<T, 'syncStatus'> {
    const { syncStatus, ...cleanEntity } = entity;
    return cleanEntity as Omit<T, 'syncStatus'>;
}

/**
 * Save merged data to local file system
 */
async function saveMergedData(data: SyncableData): Promise<void> {
    const savePromises: Promise<any>[] = [];

    // Save invoices (strip syncStatus field)
    data.invoices.forEach(invoice => {
        const cleanInvoice = cleanEntityForSave(invoice) as unknown as Invoice;
        savePromises.push(saveInvoiceToFile(cleanInvoice).catch(error => {
            console.error(`Failed to save invoice ${invoice.id}:`, error);
        }));
    });

    // Save customers (strip syncStatus field)
    data.customers.forEach(customer => {
        const cleanCustomer = cleanEntityForSave(customer) as unknown as CustomerData;
        savePromises.push(saveCustomerToFile(cleanCustomer).catch(error => {
            console.error(`Failed to save customer ${customer.id}:`, error);
        }));
    });

    // Save products (strip syncStatus field)
    data.products.forEach(product => {
        const cleanProduct = cleanEntityForSave(product) as unknown as ProductData;
        savePromises.push(saveProductToFile(cleanProduct).catch(error => {
            console.error(`Failed to save product ${product.id}:`, error);
        }));
    });

    // Save company info (strip syncStatus field)
    if (data.companyInfo) {
        const cleanCompanyInfo = cleanEntityForSave(data.companyInfo) as unknown as CompanyInfo;
        savePromises.push(saveCompanyInfoToFile(cleanCompanyInfo).catch(error => {
            console.error('Failed to save company info:', error);
        }));
    }

    // Save tax settings (strip syncStatus field)
    if (data.taxSettings) {
        const cleanTaxSettings = cleanEntityForSave(data.taxSettings);
        savePromises.push(savePersonalTaxSettingsToFile(cleanTaxSettings).catch(error => {
            console.error('Failed to save tax settings:', error);
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

