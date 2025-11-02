'use client';

import { SyncProgress, SyncResult, SyncConflict, SyncableData } from './types';
import { markSyncComplete } from './syncState';
import { isOnline } from './networkMonitor';
import {
    isNextcloudConfigured,
    downloadAllDataFromNextcloud,
    uploadAllDataToNextcloud,
} from '../nextcloud/nextcloudStorage';
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
import { Invoice, CustomerData, ProductData, CompanyInfo } from '../../domain/models';
import { normalizeEntity, mergeData, cleanEntityForSave } from './merge';

let isSyncing = false;
let syncLock = false;

export async function syncWithNextcloud(
    onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
    if (syncLock) {
        return { success: false, error: new Error('Sync already in progress'), stats: { pulled: 0, pushed: 0, merged: 0, conflicts: 0 } };
    }
    if (!isOnline()) {
        return { success: false, error: new Error('Cannot sync while offline'), stats: { pulled: 0, pushed: 0, merged: 0, conflicts: 0 } };
    }
    if (!(await isNextcloudConfigured())) {
        return { success: false, error: new Error('Nextcloud not configured'), stats: { pulled: 0, pushed: 0, merged: 0, conflicts: 0 } };
    }

    syncLock = true;
    isSyncing = true;

    try {
        const conflicts: SyncConflict[] = [];
        let pulledCount = 0;
        let pushedCount = 0;
        let mergedCount = 0;

        onProgress?.({ current: 1, total: 4, stage: 'pulling', message: 'Downloading data from Nextcloud...' });
        const remoteData = await downloadAllDataFromNextcloud();
        pulledCount = remoteData.invoices.length + remoteData.customers.length + remoteData.products.length + (remoteData.companyInfo ? 1 : 0);

        onProgress?.({ current: 2, total: 4, stage: 'merging', message: 'Loading local data...' });
        const localData = await loadLocalData();

        onProgress?.({ current: 3, total: 4, stage: 'merging', message: 'Merging data and resolving conflicts...' });
        const mergeResult = await mergeData(localData, remoteData, conflicts);
        mergedCount = mergeResult.merged;

        onProgress?.({ current: 4, total: 4, stage: 'pushing', message: 'Uploading changes to Nextcloud...' });
        await saveMergedData(mergeResult.data);
        pushedCount = await uploadAllDataToNextcloud(mergeResult.data);

        markSyncComplete();

        onProgress?.({ current: 4, total: 4, stage: 'complete', message: 'Sync complete' });
        return { success: true, conflicts, stats: { pulled: pulledCount, pushed: pushedCount, merged: mergedCount, conflicts: conflicts.length } };
    } catch (error) {
        console.error('Nextcloud sync error:', error);
        return { success: false, error: error as Error, stats: { pulled: 0, pushed: 0, merged: 0, conflicts: 0 } };
    } finally {
        syncLock = false;
        isSyncing = false;
    }
}

export async function restoreFromNextcloud(onProgress?: (progress: SyncProgress) => void): Promise<SyncableData> {
    if (!isOnline()) throw new Error('Cannot restore while offline');
    if (!(await isNextcloudConfigured())) throw new Error('Nextcloud not configured');
    onProgress?.({ current: 1, total: 2, stage: 'pulling', message: 'Downloading data from Nextcloud...' });
    const data = await downloadAllDataFromNextcloud();
    onProgress?.({ current: 2, total: 2, stage: 'complete', message: 'Restore complete' });
    return data;
}

export function isNextcloudSyncInProgress(): boolean { return isSyncing; }
export function isNextcloudSyncLocked(): boolean { return syncLock; }

// ===== Local helpers (same as Drive engine) =====
async function loadLocalData(): Promise<SyncableData> {
    try {
        const [invoices, customers, products, companyInfo, taxSettings] = await Promise.all([
            loadInvoicesFromFiles(),
            loadCustomersFromFiles(),
            loadProductsFromFiles(),
            loadCompanyInfoFromFile(),
            loadPersonalTaxSettingsFromFile(),
        ]);
        const normalizedInvoices = invoices.map(normalizeEntity);
        const normalizedCustomers = customers.map(normalizeEntity);
        const normalizedProducts = products.map(normalizeEntity);
        const normalizedCompanyInfo = companyInfo ? normalizeEntity(companyInfo) : null;
        const normalizedTaxSettings = taxSettings ? normalizeEntity(taxSettings) : null;
        return { invoices: normalizedInvoices, customers: normalizedCustomers, products: normalizedProducts, companyInfo: normalizedCompanyInfo, timesheets: [], taxSettings: normalizedTaxSettings };
    } catch (error) {
        console.error('Error loading local data:', error);
        return { invoices: [], customers: [], products: [], companyInfo: null, timesheets: [], taxSettings: null };
    }
}

async function saveMergedData(data: SyncableData): Promise<void> {
    const savePromises: Promise<any>[] = [];
    data.invoices.forEach(invoice => {
        const cleanInvoice = cleanEntityForSave(invoice) as unknown as Invoice;
        savePromises.push(saveInvoiceToFile(cleanInvoice).catch(error => console.error(`Failed to save invoice ${invoice.id}:`, error)));
    });
    data.customers.forEach(customer => {
        const cleanCustomer = cleanEntityForSave(customer) as unknown as CustomerData;
        savePromises.push(saveCustomerToFile(cleanCustomer).catch(error => console.error(`Failed to save customer ${customer.id}:`, error)));
    });
    data.products.forEach(product => {
        const cleanProduct = cleanEntityForSave(product) as unknown as ProductData;
        savePromises.push(saveProductToFile(cleanProduct).catch(error => console.error(`Failed to save product ${product.id}:`, error)));
    });
    if (data.companyInfo) {
        const cleanCompanyInfo = cleanEntityForSave(data.companyInfo) as unknown as CompanyInfo;
        savePromises.push(saveCompanyInfoToFile(cleanCompanyInfo).catch(error => console.error('Failed to save company info:', error)));
    }
    if (data.taxSettings) {
        const cleanTaxSettings = cleanEntityForSave(data.taxSettings);
        savePromises.push(savePersonalTaxSettingsToFile(cleanTaxSettings).catch(error => console.error('Failed to save tax settings:', error)));
    }
    await Promise.allSettled(savePromises);
}


