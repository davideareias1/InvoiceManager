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
    // synchronizeData().catch(e => console.error("Post-auth sync failed", e));
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
            // synchronizeData().catch(e => console.error("Initial sync failed", e));
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

async function findFileByName(fileName: string, parentFolderId: string): Promise<{ fileId: string; } | null> {
    const response = await gapi.client.drive.files.list({
        q: `name='${fileName}' and '${parentFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        pageSize: 1,
    });
    const file = response.result.files?.[0];
    return file ? { fileId: file.id! } : null;
}

async function findFileById(itemId: string, folderId: string): Promise<{ fileId: string; } | null> {
    const filename = `${itemId}.json`;
    const response = await gapi.client.drive.files.list({
        q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
        });
    const file = response.result.files?.[0];
    return file ? { fileId: file.id! } : null;
}


// --- Backup Engine ---

/**
 * Main backup function.
 * Loads all local data and uploads it to Google Drive, overwriting existing files.
 */
export async function backupAllDataToDrive(onProgress?: (progress: { current: number, total: number }) => void): Promise<void> {
    if (isSyncing || !await isGoogleDriveAuthenticated()) {
        console.log("Backup skipped: already syncing or not authenticated.");
        return;
    }
    
    isSyncing = true;
    console.log("Starting data backup to Google Drive...");
    let progress = { current: 0, total: 0 };
    const reportProgress = () => {
        progress.current++;
        onProgress?.(progress);
    };

    try {
        await initializeDirectoryStructure();

        // 1. Discover all local items to calculate total
        const companyInfo = await loadCompanyInfoFromFile();
        const customers = await loadCustomersFromFiles();
        const products = await loadProductsFromFiles();
        const invoices = await loadInvoicesFromFiles();
        
        progress.total = (companyInfo ? 1 : 0) + customers.length + products.length + invoices.length;
        onProgress?.(progress);

        const uploadPromises: Promise<void>[] = [];

        // 2. Upload Company Info
        if (companyInfo) {
            const uploadCompanyInfo = async () => {
                const existing = await findFileByName(COMPANY_INFO_FILENAME, folderIds[APP_FOLDER_NAME]);
                await uploadFile(folderIds[APP_FOLDER_NAME], { ...companyInfo, id: 'company_info' }, existing?.fileId);
                reportProgress();
            };
            uploadPromises.push(uploadCompanyInfo());
        }

        // 3. Upload Customers
        customers.forEach(customer => {
             if (customer.isDeleted) return; // Skip uploading deleted items
            const upload = async () => {
                const existing = await findFileById(customer.id, folderIds[CUSTOMERS_DIRECTORY]);
                await uploadFile(folderIds[CUSTOMERS_DIRECTORY], customer, existing?.fileId);
                reportProgress();
            };
            uploadPromises.push(upload());
        });

        // 4. Upload Products
        products.forEach(product => {
            if (product.isDeleted) return;
            const upload = async () => {
                const existing = await findFileById(product.id, folderIds[PRODUCTS_DIRECTORY]);
                await uploadFile(folderIds[PRODUCTS_DIRECTORY], product, existing?.fileId);
                reportProgress();
            };
            uploadPromises.push(upload());
        });

        // 5. Upload Invoices
        for (const invoice of invoices) {
            if (invoice.isDeleted) continue;
            const upload = async () => {
                const year = new Date(invoice.invoice_date).getFullYear().toString();
                const yearFolderId = await findOrCreateFolder(year, folderIds[INVOICES_DIRECTORY]);
                const existing = await findFileById(invoice.id, yearFolderId);
                await uploadFile(yearFolderId, invoice, existing?.fileId);
                reportProgress();
            };
            uploadPromises.push(upload());
        }
        
        await Promise.all(uploadPromises);

        console.log("Backup finished successfully.");
    } catch (error) {
        console.error("Backup failed:", error);
        throw error; // Re-throw to be caught in the UI
    } finally {
        isSyncing = false;
    }
}


// --- Public Helper Functions ---

export const getSyncStatus = () => ({ isSyncing });

// These functions are called from the other utils to explicitly trigger an upload.
// For now we keep them, but the idea is to move to a manual backup model.
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