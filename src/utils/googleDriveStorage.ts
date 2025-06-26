'use client';

import { Invoice, CustomerData, ProductData, CompanyInfo } from '../interfaces';
import {
    loadCustomersFromFiles,
    loadProductsFromFiles,
    loadInvoicesFromFiles,
    saveCustomerToFile,
    saveProductToFile,
    saveInvoiceToFile,
    deleteCustomerFile,
    deleteProductFile,
    deleteInvoiceFile,
    loadCompanyInfoFromFile,
    saveCompanyInfoToFile,
} from './fileSystemStorage';

// Constants
const LOCAL_STORAGE_TOKEN_KEY = 'google-drive-auth-token';
const CUSTOMERS_DIRECTORY = 'customers';
const PRODUCTS_DIRECTORY = 'products';
const INVOICES_DIRECTORY = 'invoices';
const APP_FOLDER_NAME = 'InvoiceManager';
const COMPANY_INFO_FILENAME = 'company_info.json';

// Use environment variables for API credentials
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY || '';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

if (!CLIENT_ID || !API_KEY) {
    console.warn('Google Drive API credentials missing. Please configure them in your .env.local file.');
}

// Global state
let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;
let folderIds: Record<string, string> = {};
let isSyncing = false;

// --- Initialization and Authentication ---

export function isGoogleDriveSupported(): boolean {
    return typeof window !== 'undefined' && !!CLIENT_ID && !!API_KEY;
}

export async function isGoogleDriveAuthenticated(): Promise<boolean> {
    if (!isGoogleDriveSupported() || !gapiInited || !gisInited) {
        return false;
    }
    const token = gapi.client.getToken();
    return token !== null;
}

async function verifyAndRefreshToken(): Promise<boolean> {
        const token = gapi.client.getToken();
    if (!token || !token.access_token) return false;

    if (!gapi?.client?.drive) {
        console.warn('Drive API client not loaded yet, skipping token validation.');
        return true; // Assume valid for now to prevent race conditions
    }
    
    try {
        await gapi.client.drive.files.list({ pageSize: 1, fields: 'files(id)' });
        return true;
    } catch (error) {
        console.warn('Token validation failed:', error);
        signOutGoogleDrive(); // Clear invalid token
        return false;
    }
}

export function loadGoogleApiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof gapi !== 'undefined' && gapi.client) return resolve();
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => gapi.load('client', () => {
                gapiInited = true;
                resolve();
            });
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

export function loadGoogleIdentityScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof google !== 'undefined' && google.accounts) return resolve();
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
                    gisInited = true;
                    resolve();
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

async function handleAuthCallback(resp: any) {
                if (resp.error) {
        console.error('Auth error:', resp);
                    return;
                }
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, JSON.stringify(gapi.client.getToken()));
    await initializeDirectoryStructure();
    // Start sync after successful auth
    synchronizeData().catch(e => console.error("Post-auth sync failed", e));
}

export async function initializeGoogleDriveApi(): Promise<boolean> {
    if (!isGoogleDriveSupported()) return false;

    await Promise.all([loadGoogleApiScript(), loadGoogleIdentityScript()]);

    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleAuthCallback,
    });

    const savedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
    if (savedToken) {
        gapi.client.setToken(JSON.parse(savedToken));
        if (await verifyAndRefreshToken()) {
                    await initializeDirectoryStructure();
            // Start first sync
            synchronizeData().catch(e => console.error("Initial sync failed", e));
        }
    }
    return true;
}

export function requestGoogleDriveAuthorization(): void {
            if (gapi.client.getToken() === null) {
                tokenClient.requestAccessToken({ prompt: 'consent' });
    }
}

export function signOutGoogleDrive(): void {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
            localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
        folderIds = {};
    }
}


// --- Directory and File Management ---

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
    if (parentId) query += ` and '${parentId}' in parents`;

    const response = await gapi.client.drive.files.list({ q: query, fields: 'files(id)' });
    if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id!;
    }

    const metadata = { name, mimeType: 'application/vnd.google-apps.folder', ...(parentId && { parents: [parentId] }) };
    const newFolder = await gapi.client.drive.files.create({ resource: metadata, fields: 'id' });
    return newFolder.result.id!;
}

async function initializeDirectoryStructure(): Promise<void> {
        const appFolderId = await findOrCreateFolder(APP_FOLDER_NAME);
        folderIds[APP_FOLDER_NAME] = appFolderId;
        folderIds[CUSTOMERS_DIRECTORY] = await findOrCreateFolder(CUSTOMERS_DIRECTORY, appFolderId);
        folderIds[PRODUCTS_DIRECTORY] = await findOrCreateFolder(PRODUCTS_DIRECTORY, appFolderId);
    folderIds[INVOICES_DIRECTORY] = await findOrCreateFolder(INVOICES_DIRECTORY, appFolderId);
}

// Fetches all files of a certain type from Drive.
async function getDriveFiles<T extends { id: string }>(parentFolderId: string): Promise<Map<string, { fileId: string; modifiedTime: string; data: T }>> {
    const filesMap = new Map<string, { fileId: string; modifiedTime: string; data: T }>();
    let pageToken: string | undefined;

    do {
        const response = await gapi.client.drive.files.list({
            q: `'${parentFolderId}' in parents and mimeType='application/json' and trashed=false`,
            fields: 'nextPageToken, files(id, name, modifiedTime)',
            pageSize: 100,
            pageToken,
        });

        if (!response.result.files) continue;

        const filePromises = response.result.files.map(async (file) => {
            try {
                const content = await gapi.client.drive.files.get({ fileId: file.id!, alt: 'media' });
                const data = content.result as T;
                if (data && data.id) { // Ensure file content is valid and has an ID
                    filesMap.set(data.id, { fileId: file.id!, modifiedTime: file.modifiedTime!, data });
                }
            } catch (e) {
                console.error(`Failed to read or parse file ${file.name}`, e);
            }
        });
        
        await Promise.all(filePromises);
        pageToken = response.result.nextPageToken;

    } while (pageToken);

    return filesMap;
}

async function uploadFile(folderId: string, item: { id: string } & any, existingFileId?: string): Promise<void> {
    const content = JSON.stringify(item, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const filename = `${item.id}.json`;

    const metadata = { name: filename, mimeType: 'application/json', ...(existingFileId ? {} : { parents: [folderId] }) };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files${existingFileId ? `/${existingFileId}` : ''}?uploadType=multipart`;
    const method = existingFileId ? 'PATCH' : 'POST';

    const res = await fetch(uploadUrl, {
        method,
        headers: { 'Authorization': `Bearer ${gapi.client.getToken()!.access_token}` },
        body: form,
    });
    if(!res.ok) {
        console.error("Failed to upload file", await res.json());
        throw new Error("Upload failed");
    }
}

async function deleteFileFromDrive(fileId: string): Promise<void> {
    await (gapi.client.drive.files as any).delete({ fileId });
}


// --- Synchronization Engine ---

/**
 * Main synchronization function.
 * Compares local and remote data and performs necessary operations.
 */
export async function synchronizeData(onProgress?: (progress: { current: number, total: number }) => void): Promise<void> {
    if (isSyncing || !await isGoogleDriveAuthenticated()) return;
    
    isSyncing = true;
    console.log("Starting data synchronization...");

    try {
        await initializeDirectoryStructure(); // Ensure folders exist

        // Sync customers, products, and invoices
        await syncDataType('Customers', folderIds[CUSTOMERS_DIRECTORY], loadCustomersFromFiles, saveCustomerToFile, deleteCustomerFile);
        await syncDataType('Products', folderIds[PRODUCTS_DIRECTORY], loadProductsFromFiles, saveProductToFile, deleteProductFile);
        await syncInvoices();

        // Sync company info
        await syncCompanyInfo();

        console.log("Synchronization finished successfully.");
    } catch (error) {
        console.error("Synchronization failed:", error);
    } finally {
        isSyncing = false;
    }
}

async function syncInvoices() {
    // For invoices, we need to handle yearly folders
    const localInvoices = await loadInvoicesFromFiles();
    const invoicesByYear = localInvoices.reduce((acc, inv) => {
        const year = new Date(inv.invoice_date).getFullYear().toString();
        if (!acc[year]) acc[year] = [];
        acc[year].push(inv);
        return acc;
    }, {} as Record<string, Invoice[]>);
    
    const driveYears = new Set<string>();
    const driveInvoicesResponse = await gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and '${folderIds[INVOICES_DIRECTORY]}' in parents and trashed=false`,
            fields: 'files(name)',
    });
    driveInvoicesResponse.result.files?.forEach(f => f.name && driveYears.add(f.name));

    const allYears = new Set([...Array.from(Object.keys(invoicesByYear)), ...Array.from(driveYears)]);

    for (const year of allYears) {
        const yearFolderId = await findOrCreateFolder(year, folderIds[INVOICES_DIRECTORY]);
        await syncDataType<Invoice>(
            `Invoices (${year})`,
            yearFolderId,
            () => Promise.resolve(invoicesByYear[year] || []), // Provide local invoices for the year
            saveInvoiceToFile,
            deleteInvoiceFile
        );
    }
}

async function syncCompanyInfo() {
    const appFolderId = folderIds[APP_FOLDER_NAME];
    if (!appFolderId) {
        console.error("App folder not found, cannot sync company info.");
        return;
    }

    // 1. Get local and remote company info
    const localInfoPromise = loadCompanyInfoFromFile();
    const remoteInfoPromise = getDriveFileByName<CompanyInfo>(COMPANY_INFO_FILENAME, appFolderId);
    const [localInfo, remoteInfo] = await Promise.all([localInfoPromise, remoteInfoPromise]);

    // 2. Compare and sync
    if (localInfo && remoteInfo) {
        const localDate = new Date(localInfo.lastModified).getTime();
        const remoteDate = new Date(remoteInfo.modifiedTime).getTime();
        
        if (Math.abs(localDate - remoteDate) < 2000) return; // In sync

        if (localDate > remoteDate) {
            console.log("[Company Info] Uploading changes.");
            await uploadFile(appFolderId, localInfo, remoteInfo.fileId);
        } else {
            console.log("[Company Info] Downloading changes.");
            await saveCompanyInfoToFile(remoteInfo.data);
        }

    } else if (localInfo && !remoteInfo) {
        console.log("[Company Info] Uploading new file.");
        await uploadFile(appFolderId, localInfo);

    } else if (!localInfo && remoteInfo) {
        console.log("[Company Info] Downloading new file.");
        await saveCompanyInfoToFile(remoteInfo.data);
    }
}

async function getDriveFileByName<T>(fileName: string, parentFolderId: string): Promise<{ fileId: string; modifiedTime: string; data: T } | null> {
    const response = await gapi.client.drive.files.list({
        q: `name='${fileName}' and '${parentFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, modifiedTime)',
        pageSize: 1,
    });

    if (!response.result.files || response.result.files.length === 0) {
        return null;
    }

    const file = response.result.files[0];
    try {
        const content = await gapi.client.drive.files.get({ fileId: file.id!, alt: 'media' });
        const data = content.result as T;
        return { fileId: file.id!, modifiedTime: file.modifiedTime!, data };
    } catch (e) {
        console.error(`Failed to read or parse file ${file.name}`, e);
        return null;
    }
}

async function syncDataType<T extends { id: string; lastModified: string; isDeleted?: boolean }>(
    typeName: string,
    folderId: string,
    localLoader: () => Promise<T[]>,
    localSaver: (item: T) => Promise<any>,
    localDeleter: (id: string) => Promise<any>
) {
    console.log(`Syncing ${typeName}...`);

    // 1. Fetch both local and remote data
    const localItemsPromise = localLoader();
    const driveFilesPromise = getDriveFiles<T>(folderId);
    const [localItems, driveFiles] = await Promise.all([localItemsPromise, driveFilesPromise]);
    
    const localMap = new Map(localItems.map(item => [item.id, item]));
    const allIds = new Set([...Array.from(localMap.keys()), ...Array.from(driveFiles.keys())]);

    // 2. Iterate and resolve conflicts
    for (const id of allIds) {
        const local = localMap.get(id);
        const drive = driveFiles.get(id);

        if (local && drive) {
            // Exists in both places
            const localDate = new Date(local.lastModified).getTime();
            const driveDate = new Date(drive.modifiedTime).getTime();

            if (Math.abs(localDate - driveDate) < 2000) continue; // Timestamps are close enough

            if (local.isDeleted && drive.data.isDeleted) {
                // Already deleted on both, clean them up
                await localDeleter(id);
                await deleteFileFromDrive(drive.fileId);
                continue;
            }

            if (local.isDeleted) { // Propagate delete to drive
                await uploadFile(folderId, local, drive.fileId); 
                continue;
            }
            if(drive.data.isDeleted) { // Propagate delete to local
                await localSaver(drive.data);
                continue;
            }

            if (localDate > driveDate) { // Local is newer
                console.log(`[${typeName}] Uploading changes for ${id}`);
                await uploadFile(folderId, local, drive.fileId);
            } else { // Drive is newer
                console.log(`[${typeName}] Downloading changes for ${id}`);
                await localSaver(drive.data);
            }
        } else if (local && !drive) {
            // Exists locally only
            if (local.isDeleted) {
                console.log(`[${typeName}] Deleting local-only deleted item ${id}`);
                await localDeleter(id); // Clean up soft-deleted local file
            } else {
                console.log(`[${typeName}] Uploading new item ${id}`);
                await uploadFile(folderId, local);
            }
        } else if (!local && drive) {
            // Exists on Drive only
            if (drive.data.isDeleted) {
                console.log(`[${typeName}] Deleting Drive-only deleted item ${drive.fileId}`);
                await deleteFileFromDrive(drive.fileId);
            } else {
                console.log(`[${typeName}] Downloading new item ${drive.data.id}`);
                await localSaver(drive.data);
            }
        }
    }
}

// --- Public Helper Functions ---

export const getSyncStatus = () => ({ isSyncing });

async function findFileById(itemId: string, folderId: string): Promise<{ fileId: string; modifiedTime: string; } | null> {
    const filename = `${itemId}.json`;
    const response = await gapi.client.drive.files.list({
        q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, modifiedTime)',
            spaces: 'drive'
        });
    const file = response.result.files?.[0];
    return file ? { fileId: file.id!, modifiedTime: file.modifiedTime! } : null;
}

// These functions are called from the other utils to explicitly trigger an upload.
// The sync engine will handle reconcilliation later, but this ensures changes are pushed up immediately.
export async function saveCustomerToGoogleDrive(customer: CustomerData): Promise<void> {
    if (!await isGoogleDriveAuthenticated()) return;
    const folderId = folderIds[CUSTOMERS_DIRECTORY];
    const existing = await findFileById(customer.id, folderId);
    await uploadFile(folderId, customer, existing?.fileId);
}

export async function saveProductToGoogleDrive(product: ProductData): Promise<void> {
    if (!await isGoogleDriveAuthenticated()) return;
    const folderId = folderIds[PRODUCTS_DIRECTORY];
    const existing = await findFileById(product.id, folderId);
    await uploadFile(folderId, product, existing?.fileId);
}

export async function saveInvoiceToGoogleDrive(invoice: Invoice): Promise<void> {
    if (!await isGoogleDriveAuthenticated()) return;
    const year = new Date(invoice.invoice_date).getFullYear().toString();
    const yearFolderId = await findOrCreateFolder(year, folderIds[INVOICES_DIRECTORY]);
    const existing = await findFileById(invoice.id, yearFolderId);
    await uploadFile(yearFolderId, invoice, existing?.fileId);
} 