'use client';

import { SyncProgress, SyncResult, SyncConflict, SyncableData } from './types';
import { normalizeEntity, mergeData, cleanEntityForSave } from './merge';
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

// (normalization helpers moved to ./merge)

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

// (merge helpers moved to ./merge)

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

