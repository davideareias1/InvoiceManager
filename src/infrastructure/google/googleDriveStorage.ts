'use client';

import { Invoice, CustomerData, ProductData, CompanyInfo } from '../../domain/models';
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
} from '../filesystem/fileSystemStorage';

// Satisfy TypeScript in client-side code when Node types aren't present
declare const process: any;

// Constants
const LOCAL_STORAGE_TOKEN_KEY = 'google-drive-auth-token';
const CUSTOMERS_DIRECTORY = 'customers';
const PRODUCTS_DIRECTORY = 'products';
const INVOICES_DIRECTORY = 'invoices';
const TIMESHEETS_DIRECTORY = 'timesheets';
const APP_FOLDER_NAME = 'InvoiceManager';
const COMPANY_INFO_FILENAME = 'company_info.json';
const TAX_SETTINGS_FILENAME = 'personal_tax_settings.json';

// Use environment variables for API credentials
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || '1052428720970-hcfhot632mpvb4db86cqak4patqfd9ji.apps.googleusercontent.com';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY || 'AIzaSyAGPAk38I3wKemZ62YOTnoIDsUBVyZglpc';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

if (!API_KEY) {
    console.warn('Google Drive API key missing. Please configure it in your .env.local file.');
}

// Global state
let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;
let folderIds: Record<string, string> = {};
let isSyncing = false;
let isInitialized = false;
let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

// Add cache for folder creation to prevent race conditions
let folderCreationCache = new Map<string, Promise<string>>();
let folderIdCache = new Map<string, string>();

// Persist selected Drive folder IDs to avoid flipping between duplicates
const FOLDER_IDS_STORAGE_KEY = 'google-drive-folder-ids';

function loadPersistedFolderIds(): Record<string, string> {
    try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(FOLDER_IDS_STORAGE_KEY) : null;
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function savePersistedFolderIds(ids: Record<string, string>): void {
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(FOLDER_IDS_STORAGE_KEY, JSON.stringify(ids));
        }
    } catch {
        // ignore
    }
}

// --- Initialization and Authentication ---

export function isGoogleDriveSupported(): boolean {
    return typeof window !== 'undefined' && !!API_KEY;
}

export async function isGoogleDriveAuthenticated(): Promise<boolean> {
    if (!isGoogleDriveSupported() || !gapiInited || !gisInited) {
        return false;
    }
    
    const token = gapi.client.getToken();
    if (!token || !token.access_token) {
        return false;
    }

    // Only validate token if we're fully initialized to avoid race conditions
    if (isInitialized) {
        return await verifyToken();
    }
    
    return true;
}

async function verifyToken(): Promise<boolean> {
    const token = gapi.client.getToken();
    if (!token || !token.access_token) return false;

    // Skip validation if Drive API client is not ready
    if (!gapi?.client?.drive) {
        return true; // Assume valid to prevent race conditions
    }
    
    try {
        // Simple test to verify token validity
        await gapi.client.drive.files.list({ pageSize: 1, fields: 'files(id)' });
        return true;
    } catch (error) {
        console.warn('Token validation failed, signing out:', error);
        signOutGoogleDrive();
        return false;
    }
}

export function loadGoogleApiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof gapi !== 'undefined' && gapi.client) {
            gapiInited = true;
            return resolve();
        }
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
        if (typeof google !== 'undefined' && google.accounts) {
            gisInited = true;
            return resolve();
        }
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

/**
 * Schedule automatic token refresh before expiration
 */
function scheduleTokenRefresh() {
    // Clear existing timer
    if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
        tokenRefreshTimer = null;
    }

    const token = gapi.client.getToken() as any;
    if (!token || !token.expires_in) {
        return;
    }

    // Refresh 5 minutes before expiration (token expires in 3600 seconds = 1 hour)
    const refreshTime = (token.expires_in - 300) * 1000; // Convert to milliseconds, refresh 5 min early
    
    console.log(`🔄 Token will auto-refresh in ${Math.round(refreshTime / 1000 / 60)} minutes`);
    
    tokenRefreshTimer = setTimeout(() => {
        console.log('🔄 Auto-refreshing token...');
        if (tokenClient) {
            // Request new token silently (no prompt)
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }, refreshTime);
}

async function handleAuthCallback(resp: any) {
    if (resp.error) {
        console.error('Auth error:', resp);
        return;
    }
    
    try {
        localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, JSON.stringify(gapi.client.getToken()));
        
        // Schedule automatic token refresh
        scheduleTokenRefresh();
        
        await initializeDirectoryStructure();
        console.log('Google Drive authentication successful');
    } catch (error) {
        console.error('Error during post-auth initialization:', error);
    }
}

export async function initializeGoogleDriveApi(): Promise<boolean> {
    if (!isGoogleDriveSupported()) return false;

    try {
        await Promise.all([loadGoogleApiScript(), loadGoogleIdentityScript()]);

        // Initialize Google API client with discovery document
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        
        console.log('Google API client initialized successfully with discovery document');

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: handleAuthCallback,
        });

        const savedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
        if (savedToken) {
            try {
                gapi.client.setToken(JSON.parse(savedToken));
                if (await verifyToken()) {
                    // Schedule token refresh for restored token
                    scheduleTokenRefresh();
                    await initializeDirectoryStructure();
                }
            } catch (error) {
                console.error('Error restoring saved token:', error);
                localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
            }
        }
        
        isInitialized = true;
        return true;
    } catch (error) {
        console.error('Failed to initialize Google Drive API:', error);
        return false;
    }
}

export function requestGoogleDriveAuthorization(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject(new Error('Google Drive not initialized'));
            return;
        }

        const currentToken = gapi.client.getToken();
        if (currentToken && currentToken.access_token) {
            resolve(); // Already authenticated
            return;
        }

        // Override the callback temporarily to handle the promise
        const originalCallback = tokenClient.callback;
        tokenClient.callback = async (resp: any) => {
            tokenClient.callback = originalCallback; // Restore original callback
            
            if (resp.error) {
                reject(new Error(resp.error));
                return;
            }
            
            try {
                await handleAuthCallback(resp);
                resolve();
            } catch (error) {
                reject(error);
            }
        };

        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

export function signOutGoogleDrive(): Promise<void> {
    return new Promise((resolve) => {
        try {
            // Clear token refresh timer
            if (tokenRefreshTimer) {
                clearTimeout(tokenRefreshTimer);
                tokenRefreshTimer = null;
            }
            
            const token = gapi.client.getToken();
            if (token !== null) {
                try {
                    google.accounts.oauth2.revoke(token.access_token);
                } catch (revokeError) {
                    console.warn('Failed to revoke token, but continuing with sign out:', revokeError);
                }
                gapi.client.setToken('');
            }
            localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
            folderIds = {};
            folderCreationCache.clear();
            folderIdCache.clear();
            console.log('Google Drive sign out completed');
        } catch (error) {
            console.error('Error during Google Drive sign out:', error);
        } finally {
            // Always resolve to prevent sign out from getting stuck
            resolve();
        }
    });
}

// --- Directory and File Management ---

/**
 * Helper function to sanitize filenames for Google Drive
 */
function sanitizeFilename(name: string): string {
    // Replace special characters with safe alternatives, keeping more readable names
    return name.replace(/[\/\\:*?"<>|]/g, '-')
               .replace(/\s+/g, ' ')
               .trim()
               .substring(0, 200); // Limit length for Drive compatibility
}

/**
 * Generate proper filename based on item type and content
 */
function generateFilename(item: any, itemType: 'invoice' | 'customer' | 'product' | 'company' | 'taxSettings'): string {
    switch (itemType) {
        case 'invoice':
            // For invoices, use just the invoice number (001.json, 002.json, etc.)
            return `${String(item.invoice_number).padStart(3, '0')}.json`;
        
        case 'customer':
            // For customers, prefer name over ID if available, otherwise use customer_ID format
            if (item.name && typeof item.name === 'string' && item.name.trim()) {
                return `${sanitizeFilename(item.name.trim())}.json`;
            } else {
                return `customer_${item.id}.json`;
            }
        
        case 'product':
            // For products, use the product name if available, otherwise product_ID format
            if (item.name && typeof item.name === 'string' && item.name.trim()) {
                return `${sanitizeFilename(item.name.trim())}.json`;
            } else {
                return `product_${item.id}.json`;
            }
        
        case 'company':
            return 'company_info.json';
        
        case 'taxSettings':
            return 'personal_tax_settings.json';
        
        default:
            // Fallback to ID-based naming
            return `${item.id}.json`;
    }
}

// Deeply remove volatile fields that should not affect comparisons
function stripVolatileFieldsDeep(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(stripVolatileFieldsDeep);
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            if (key === 'lastModified' || key === 'syncStatus' || key === 'updatedAt' || key === 'createdAt') continue;
            result[key] = stripVolatileFieldsDeep(obj[key]);
        }
        return result;
    }
    return obj;
}

// Deterministic stringify to compare content independent of key order
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

function areItemsEqualIgnoringVolatileFields(a: any, b: any): boolean {
    const cleanA = deterministicStringify(stripVolatileFieldsDeep(a));
    const cleanB = deterministicStringify(stripVolatileFieldsDeep(b));
    return cleanA === cleanB;
}

// Parse Drive response when using alt='media' which may return body or result
function parseDriveMediaResponse<T>(response: any): T {
    if (response && typeof response.body === 'string') {
        return JSON.parse(response.body) as T;
    }
    if (response && typeof response.result === 'string') {
        return JSON.parse(response.result) as T;
    }
    return (response?.result as T);
}

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    // Use a unique cache key that includes both name and parent ID
    const cacheKey = `${name}:${parentId || 'root'}`;
    
    // Check cache first
    const cachedFolderId = folderIdCache.get(cacheKey);
    if (cachedFolderId) {
        return cachedFolderId;
    }

    // Check if a folder creation is already in progress for this name/parent combination
    const existingPromise = folderCreationCache.get(cacheKey);
    if (existingPromise) {
        return await existingPromise;
    }

    const newPromise = (async () => {
        // First, try to find existing folder
        let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }

        try {
            const response = await gapi.client.drive.files.list({ 
                q: query, 
                fields: 'files(id, name)',
                pageSize: 10 // Get a few results to handle potential duplicates
            });
            
            if (response.result.files && response.result.files.length > 0) {
                // Return the first matching folder
                const folderId = response.result.files[0].id!;
                
                                 // If we found multiple folders with the same name, log but don't clean up during sync
                 if (response.result.files.length > 1) {
                     console.warn(`Found ${response.result.files.length} folders named "${name}". Using first folder: ${folderId}`);
                 }
                
                                 folderIdCache.set(cacheKey, folderId); // Cache the found folder
                 return folderId;
             }
         } catch (error) {
             console.error('Error searching for folder:', error);
         }

         // Create new folder if not found
         try {
             const metadata = { 
                 name, 
                 mimeType: 'application/vnd.google-apps.folder',
                 ...(parentId && { parents: [parentId] })
             };
             const newFolder = await gapi.client.drive.files.create({ 
                 resource: metadata, 
                 fields: 'id' 
             });
             const folderId = newFolder.result.id!;
             folderIdCache.set(cacheKey, folderId); // Cache the new folder
             return folderId;
         } catch (error) {
             console.error('Error creating folder:', error);
             throw error;
         } finally {
             // Always remove from the promise cache when done
             folderCreationCache.delete(cacheKey);
         }
     })();

     folderCreationCache.set(cacheKey, newPromise); // Cache the promise
     return newPromise;
}

/**
 * Clean up duplicate folders in the background to avoid race conditions
 */
async function cleanupDuplicateFolders(folders: any[], keepFolderId: string): Promise<void> {
    const duplicates = folders.filter(folder => folder.id !== keepFolderId);
    
    for (const duplicate of duplicates) {
        try {
            // Double-check the folder still exists and is actually a duplicate
            const folderCheck = await gapi.client.drive.files.get({ 
                fileId: duplicate.id!, 
                fields: 'id,name,parents' 
            });
            
            // Verify it's still a duplicate (same name and parent)
            const originalFolder = await gapi.client.drive.files.get({ 
                fileId: keepFolderId, 
                fields: 'id,name,parents' 
            });
            
            if (folderCheck.result.name === originalFolder.result.name && 
                JSON.stringify(folderCheck.result.parents) === JSON.stringify(originalFolder.result.parents)) {
                
                // Check if the duplicate folder is empty before deleting
                const contents = await gapi.client.drive.files.list({
                    q: `'${duplicate.id}' in parents and trashed=false`,
                    fields: 'files(id)',
                    pageSize: 1
                });
                
                if (!contents.result.files || contents.result.files.length === 0) {
                    await (gapi.client.drive.files as any).delete({ fileId: duplicate.id });
                    console.log(`Deleted empty duplicate folder: ${duplicate.id}`);
                } else {
                    console.log(`Skipping deletion of non-empty duplicate folder: ${duplicate.id}`);
                }
            }
        } catch (error: any) {
            if (error?.status === 404) {
                console.log(`Duplicate folder ${duplicate.id} already deleted or doesn't exist`);
            } else {
                console.error('Error during duplicate folder cleanup:', error);
            }
        }
        
        // Add small delay between deletions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Track if directory structure has been initialized in this session
let isDirectoryInitialized = false;

async function initializeDirectoryStructure(force: boolean = false): Promise<void> {
    // Skip if already initialized (unless forced)
    if (isDirectoryInitialized && !force) {
        return;
    }
    
    try {
        // Clear caches to ensure fresh initialization
        folderCreationCache.clear();
        // Load persisted IDs first to avoid flipping between duplicate folders
        const persisted = loadPersistedFolderIds();
        folderIdCache.clear();
        
        // Prefer persisted app folder ID if available
        let appFolderId = persisted[APP_FOLDER_NAME];
        if (appFolderId) {
            try {
                await gapi.client.drive.files.get({ fileId: appFolderId, fields: 'id' });
            } catch {
                appFolderId = await findOrCreateFolder(APP_FOLDER_NAME);
            }
        } else {
            appFolderId = await findOrCreateFolder(APP_FOLDER_NAME);
        }
        folderIds[APP_FOLDER_NAME] = appFolderId;
        
        // Create subdirectories (prefer persisted IDs if valid)
        for (const dirName of [CUSTOMERS_DIRECTORY, PRODUCTS_DIRECTORY, INVOICES_DIRECTORY, TIMESHEETS_DIRECTORY]) {
            let id = persisted[dirName];
            if (id) {
                try {
                    await gapi.client.drive.files.get({ fileId: id, fields: 'id' });
                    folderIds[dirName] = id;
                    continue;
                } catch {
                    // fall through to create/find
                }
            }
            folderIds[dirName] = await findOrCreateFolder(dirName, appFolderId);
        }

        // Persist selected IDs so future runs use the same folders
        savePersistedFolderIds({
            [APP_FOLDER_NAME]: folderIds[APP_FOLDER_NAME],
            [CUSTOMERS_DIRECTORY]: folderIds[CUSTOMERS_DIRECTORY],
            [PRODUCTS_DIRECTORY]: folderIds[PRODUCTS_DIRECTORY],
            [INVOICES_DIRECTORY]: folderIds[INVOICES_DIRECTORY],
            [TIMESHEETS_DIRECTORY]: folderIds[TIMESHEETS_DIRECTORY],
        });
        
        isDirectoryInitialized = true;
        console.log('✅ Google Drive folders ready');
    } catch (error) {
        console.error('Failed to initialize directory structure:', error);
        throw error;
    }
}

// Get all files from a Drive folder
async function getDriveFiles<T extends { id: string }>(parentFolderId: string): Promise<Map<string, { fileId: string; modifiedTime: string; data: T }>> {
    const filesMap = new Map<string, { fileId: string; modifiedTime: string; data: T }>();
    let pageToken: string | undefined;

    try {
        do {
            const response: any = await gapi.client.drive.files.list({
                q: `'${parentFolderId}' in parents and mimeType='application/json' and trashed=false`,
                fields: 'nextPageToken, files(id, name, modifiedTime)',
                pageSize: 100,
                pageToken,
            });

            if (!response.result.files) continue;

            const filePromises = response.result.files.map(async (file: any) => {
                try {
                    const content: any = await gapi.client.drive.files.get({ 
                        fileId: file.id!, 
                        alt: 'media' 
                    });
                    
                    // The response body is in content.body when using alt='media'
                    const data = parseDriveMediaResponse<T>(content);
                    
                    if (data && data.id) {
                        filesMap.set(data.id, { 
                            fileId: file.id!, 
                            modifiedTime: file.modifiedTime!, 
                            data 
                        });
                    }
                } catch (error) {
                    console.error(`Failed to read file ${file.name}:`, error);
                }
            });
            
            await Promise.all(filePromises);
            pageToken = response.result.nextPageToken;

        } while (pageToken);
    } catch (error) {
        console.error('Error fetching Drive files:', error);
    }

    return filesMap;
}

async function uploadFile(folderId: string, item: { id: string } & any, existingFileId?: string, retryCount = 0, itemType: 'invoice' | 'customer' | 'product' | 'company' | 'taxSettings' = 'invoice'): Promise<boolean> {
    const maxRetries = 3;
    const filename = generateFilename(item, itemType);
    
    try {
        // Validate inputs
        if (!folderId) {
            throw new Error(`Invalid folder ID for file ${filename}`);
        }
        
        // Validate that the target folder exists before attempting upload
        try {
            await gapi.client.drive.files.get({ fileId: folderId, fields: 'id' });
        } catch (error: any) {
            if (error?.status === 404) {
                console.warn(`Target folder ${folderId} not found during upload of ${filename}. This may be due to a race condition.`);
                // Don't throw here, let the upload attempt proceed and handle the error there
            } else {
                throw error;
            }
        }
        
        // If we have an existingFileId, verify it still exists
        if (existingFileId) {
            try {
                await gapi.client.drive.files.get({ fileId: existingFileId, fields: 'id' });
            } catch (error: any) {
                if (error?.status === 404) {
                    console.log(`Existing file ${existingFileId} not found, will create new file`);
                    existingFileId = undefined;
                } else {
                    throw error;
                }
            }
        }

        // If the file exists, compare its current content with local ignoring volatile fields; skip if unchanged
        if (existingFileId) {
            try {
                const contentResp: any = await gapi.client.drive.files.get({ fileId: existingFileId, alt: 'media' });
                const remoteData: any = parseDriveMediaResponse<any>(contentResp);
                if (areItemsEqualIgnoringVolatileFields(item, remoteData)) {
                    // Quiet: unchanged, skip upload
                    return false;
                }
            } catch (e) {
                console.warn(`Failed to compare remote content for ${filename}; proceeding with upload`, e);
            }
        }

        const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });

        const metadata = { 
            name: filename, 
            mimeType: 'application/json',
            ...(existingFileId ? {} : { parents: [folderId] })
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files${existingFileId ? `/${existingFileId}` : ''}?uploadType=multipart`;
        const method = existingFileId ? 'PATCH' : 'POST';

        const response = await fetch(uploadUrl, {
            method,
            headers: { 'Authorization': `Bearer ${gapi.client.getToken()!.access_token}` },
            body: form,
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: { message: errorText } };
            }
            
            console.error(`Failed to upload file ${filename}:`, errorData);
            
            // If it's a 404 and we were trying to update, try creating new instead
            if (response.status === 404 && existingFileId && retryCount === 0) {
                console.log(`File ${existingFileId} not found, creating new file for ${filename}`);
                return uploadFile(folderId, item, undefined, retryCount + 1, itemType);
            }
            
            // Provide more detailed error information
            const errorMessage = errorData.error?.message || response.statusText;
            console.error(`Upload failed for ${filename}: ${response.status} - ${errorMessage}`, {
                folderId,
                existingFileId,
                itemType,
                retryCount
            });
            
            throw new Error(`Upload failed: ${response.status} - ${errorMessage}`);
        }
        
        // Silently succeed (verbose logging adds overhead)
        return true;
    } catch (error: any) {
        if (retryCount < maxRetries && (error?.message?.includes('network') || error?.name === 'NetworkError')) {
            console.log(`Retrying upload for ${filename} (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
            return uploadFile(folderId, item, existingFileId, retryCount + 1, itemType);
        }
        
        console.error(`Failed to upload ${filename} after ${retryCount + 1} attempts:`, error);
        throw error;
    }
}

async function deleteFileFromDrive(fileId: string): Promise<void> {
    try {
        // First check if file exists
        await gapi.client.drive.files.get({ fileId, fields: 'id' });
        // If we get here, file exists, so delete it
        await (gapi.client.drive.files as any).delete({ fileId });
        console.log(`Deleted file from Drive: ${fileId}`);
    } catch (error: any) {
        if (error?.status === 404) {
            console.log(`File ${fileId} already deleted or doesn't exist`);
            return; // Don't throw error for files that don't exist
        }
        console.error('Error deleting file from Drive:', error);
        throw error;
    }
}

async function findFileByName(fileName: string, parentFolderId: string): Promise<{ fileId: string; } | null> {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${parentFolderId}' in parents and trashed=false`,
            fields: 'files(id)',
            pageSize: 1,
        });
        const file = response.result.files?.[0];
        return file ? { fileId: file.id! } : null;
    } catch (error) {
        console.error('Error finding file by name:', error);
        return null;
    }
}

// Look for an invoice JSON file by filename across all year subfolders
async function findInvoiceFileByNameAcrossYears(fileName: string): Promise<{ fileId: string; modifiedTime: string } | null> {
    try {
        const invoicesRootId = folderIds[INVOICES_DIRECTORY];
        if (!invoicesRootId) return null;

        const foldersResp: any = await gapi.client.drive.files.list({
            q: `'${invoicesRootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id,name)',
            pageSize: 200
        });

        const yearFolders = foldersResp.result.files || [];
        if (yearFolders.length === 0) return null;

        const queries = yearFolders.map((folder: any) => gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folder.id}' in parents and trashed=false`,
            fields: 'files(id, modifiedTime)',
            pageSize: 1
        }));

        const results = await Promise.allSettled(queries);
        let best: { fileId: string; modifiedTime: string } | null = null;
        for (const res of results) {
            if (res.status !== 'fulfilled') continue;
            const files = (res.value as any).result.files || [];
            const file = files[0];
            if (!file) continue;
            if (!best || new Date(file.modifiedTime!).getTime() > new Date(best.modifiedTime).getTime()) {
                best = { fileId: file.id!, modifiedTime: file.modifiedTime! };
            }
        }

        return best;
    } catch (error) {
        console.error('Error searching invoices across years:', error);
        return null;
    }
}

async function findFileById(itemId: string, folderId: string): Promise<{ fileId: string; } | null> {
    // Legacy: Try to find by old UUID-based naming first
    const legacyFilename = `${itemId}.json`;
    const legacyResult = await findFileByName(legacyFilename, folderId);
    return legacyResult;
}

/**
 * Find existing file by item data and type (using new naming scheme)
 */
async function findFileByItem(item: any, folderId: string, itemType: 'invoice' | 'customer' | 'product' | 'company'): Promise<{ fileId: string; } | null> {
    // First try to find by new naming scheme
    const newFilename = generateFilename(item, itemType);

    if (itemType === 'invoice') {
        const acrossYears = await findInvoiceFileByNameAcrossYears(newFilename);
        if (acrossYears) {
            return { fileId: acrossYears.fileId };
        }
    } else {
        const newResult = await findFileByName(newFilename, folderId);
        if (newResult) {
            return newResult;
        }
    }
    
    // If not found, try legacy UUID-based naming for backwards compatibility
    const legacyResult = await findFileById(item.id, folderId);
    if (legacyResult) {
        console.log(`Found file with legacy naming: ${item.id}.json, will update to: ${newFilename}`);
        return legacyResult;
    }
    
    return null;
}

// --- Sync Engine ---

/**
 * Comprehensive sync function that ensures Google Drive is an exact mirror of local storage
 */
export async function backupAllDataToDrive(onProgress?: (progress: { current: number, total: number }) => void): Promise<void> {
    if (isSyncing || !await isGoogleDriveAuthenticated()) {
        console.log("Backup skipped: already syncing or not authenticated.");
        return;
    }
    
    isSyncing = true;
    console.log("Starting comprehensive backup to Google Drive...");
    
    let progress = { current: 0, total: 0 };
    const reportProgress = () => {
        progress.current++;
        onProgress?.(progress);
    };

    try {
        await initializeDirectoryStructure();

        // Load all local data
        const companyInfo = await loadCompanyInfoFromFile();
        const customers = await loadCustomersFromFiles();
        const products = await loadProductsFromFiles();
        const invoices = await loadInvoicesFromFiles();
        
        // Only count non-deleted items for progress
        const activeCustomers = customers.filter(c => !c.isDeleted);
        const activeProducts = products.filter(p => !p.isDeleted);
        const activeInvoices = invoices.filter(i => !i.isDeleted);
        
        progress.total = (companyInfo ? 1 : 0) + activeCustomers.length + activeProducts.length + activeInvoices.length;
        onProgress?.(progress);

        // Get current Drive files to identify what needs to be deleted
        const [driveCustomers, driveProducts, driveInvoices] = await Promise.all([
            getDriveFiles<CustomerData>(folderIds[CUSTOMERS_DIRECTORY]),
            getDriveFiles<ProductData>(folderIds[PRODUCTS_DIRECTORY]),
            getDriveFilesFromAllYearFolders<Invoice>(folderIds[INVOICES_DIRECTORY])
        ]);

        const uploadPromises: Promise<void>[] = [];

        // Upload company info
        if (companyInfo) {
            uploadPromises.push(uploadCompanyInfo(companyInfo, reportProgress).then(() => {}));
        }

        // Upload customers and track for deletion
        const localCustomerIds = new Set<string>();
        activeCustomers.forEach(customer => {
            localCustomerIds.add(customer.id);
            uploadPromises.push(uploadCustomer(customer, reportProgress).then(() => {}));
        });

        // Upload products and track for deletion
        const localProductIds = new Set<string>();
        activeProducts.forEach(product => {
            localProductIds.add(product.id);
            uploadPromises.push(uploadProduct(product, reportProgress).then(() => {}));
        });

        // Upload invoices and track for deletion - group by year to reduce folder creation race conditions
        const localInvoiceIds = new Set<string>();
        const invoicesByYear = new Map<string, Invoice[]>();
        
        // Group invoices by year
        activeInvoices.forEach(invoice => {
            localInvoiceIds.add(invoice.id);
            const year = new Date(invoice.invoice_date).getFullYear().toString();
            if (!invoicesByYear.has(year)) {
                invoicesByYear.set(year, []);
            }
            invoicesByYear.get(year)!.push(invoice);
        });

        // Upload invoices year by year to minimize folder creation conflicts
        for (const [year, yearInvoices] of invoicesByYear) {
            // Create year folder once for all invoices
            const yearFolderId = await findOrCreateFolder(year, folderIds[INVOICES_DIRECTORY]);
            
            // Upload all invoices for this year
            yearInvoices.forEach(invoice => {
                uploadPromises.push(uploadInvoiceToYearFolder(invoice, yearFolderId, reportProgress).then(() => {}));
            });
        }

        // Wait for all uploads to complete with individual error handling
        const uploadResults = await Promise.allSettled(uploadPromises);
        const failedUploads = uploadResults.filter(result => result.status === 'rejected');
        
        if (failedUploads.length > 0) {
            console.error(`${failedUploads.length} uploads failed:`, failedUploads);
            // Continue with deletion but log the failures
        }

        // Delete files that no longer exist locally with individual error handling
        const deletePromises: Promise<void>[] = [];
        
        // Delete customers not in local storage
        driveCustomers.forEach((driveFile, id) => {
            if (!localCustomerIds.has(id)) {
                deletePromises.push(deleteFileFromDrive(driveFile.fileId).catch(error => {
                    console.error(`Failed to delete customer file ${driveFile.fileId}:`, error);
                }));
            }
        });

        // Delete products not in local storage
        driveProducts.forEach((driveFile, id) => {
            if (!localProductIds.has(id)) {
                deletePromises.push(deleteFileFromDrive(driveFile.fileId).catch(error => {
                    console.error(`Failed to delete product file ${driveFile.fileId}:`, error);
                }));
            }
        });

        // Delete invoices not in local storage
        driveInvoices.forEach((driveFile, id) => {
            if (!localInvoiceIds.has(id)) {
                deletePromises.push(deleteFileFromDrive(driveFile.fileId).catch(error => {
                    console.error(`Failed to delete invoice file ${driveFile.fileId}:`, error);
                }));
            }
        });

        const deleteResults = await Promise.allSettled(deletePromises);
        const failedDeletes = deleteResults.filter(result => result.status === 'rejected');
        
        if (failedDeletes.length > 0) {
            console.error(`${failedDeletes.length} deletions failed:`, failedDeletes);
        }

        console.log("Backup completed successfully - Google Drive is now synchronized with local storage");
    } catch (error) {
        console.error("Backup failed:", error);
        throw error;
    } finally {
        isSyncing = false;
    }
}

// Helper functions for uploads
async function uploadCompanyInfo(companyInfo: CompanyInfo, reportProgress: () => void): Promise<boolean> {
    try {
        const existing = await findFileByName(COMPANY_INFO_FILENAME, folderIds[APP_FOLDER_NAME]);
        return await uploadFile(folderIds[APP_FOLDER_NAME], { ...companyInfo, id: 'company_info' }, existing?.fileId, 0, 'company');
    } finally {
        reportProgress(); // Always report progress even if upload fails
    }
}

async function uploadTaxSettings(taxSettings: any, reportProgress: () => void): Promise<boolean> {
    try {
        const existing = await findFileByName(TAX_SETTINGS_FILENAME, folderIds[APP_FOLDER_NAME]);
        return await uploadFile(folderIds[APP_FOLDER_NAME], { ...taxSettings, id: 'personal_tax_settings' }, existing?.fileId, 0, 'taxSettings');
    } finally {
        reportProgress(); // Always report progress even if upload fails
    }
}

/**
 * Upload a single timesheet directly to Drive (called when saving a timesheet)
 */
export async function uploadTimesheetToDrive(
    customerName: string,
    year: number,
    month: number,
    fileHandle: FileSystemFileHandle
): Promise<boolean> {
    isSyncing = true;
    try {
        await initializeDirectoryStructure();
        return await uploadTimesheet({ customerName, year, month, fileHandle }, () => {});
    } finally {
        isSyncing = false;
    }
}

async function uploadTimesheet(
    timesheet: { customerName: string; year: number; month: number; fileHandle: FileSystemFileHandle },
    reportProgress: () => void
): Promise<boolean> {
    try {
        const { customerName, year, month, fileHandle } = timesheet;
        
        // Create folder structure: timesheets/<customerName>/<year>/
        const customerFolderId = await findOrCreateFolder(customerName, folderIds[TIMESHEETS_DIRECTORY]);
        const yearFolderId = await findOrCreateFolder(year.toString(), customerFolderId);
        
        // Read the Excel file
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        
        // Generate filename (matches local format)
        const filename = `${customerName}_${year}_${String(month).padStart(2, '0')}.xlsx`;
        
        // Check if file already exists
        const existingFile = await findFileByName(filename, yearFolderId);
        
        // Upload as binary (Excel file)
        // Note: parents field is only allowed for POST (create), not PATCH (update)
        const metadata = existingFile 
            ? {
                name: filename,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
            : {
                name: filename,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                parents: [yearFolderId],
            };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([arrayBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        }));
        
        const method = existingFile ? 'PATCH' : 'POST';
        const url = existingFile 
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.fileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        
        const token = gapi.client.getToken();
        if (!token) {
            console.error('No auth token available');
            return false;
        }
        
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token.access_token}`,
            },
            body: form,
        });
        
        if (!response.ok) {
            console.error(`Failed to upload timesheet ${filename}:`, await response.text());
            return false;
        }
        
        console.log(`✅ Uploaded timesheet: ${filename}`);
        return true;
    } catch (error) {
        console.error('Error uploading timesheet:', error);
        return false;
    } finally {
        reportProgress();
    }
}

async function uploadCustomer(customer: CustomerData, reportProgress: () => void): Promise<boolean> {
    try {
        const existing = await findFileByItem(customer, folderIds[CUSTOMERS_DIRECTORY], 'customer');
        return await uploadFile(folderIds[CUSTOMERS_DIRECTORY], customer, existing?.fileId, 0, 'customer');
    } finally {
        reportProgress(); // Always report progress even if upload fails
    }
}

async function uploadProduct(product: ProductData, reportProgress: () => void): Promise<boolean> {
    try {
        const existing = await findFileByItem(product, folderIds[PRODUCTS_DIRECTORY], 'product');
        return await uploadFile(folderIds[PRODUCTS_DIRECTORY], product, existing?.fileId, 0, 'product');
    } finally {
        reportProgress(); // Always report progress even if upload fails
    }
}

async function uploadInvoice(invoice: Invoice, reportProgress: () => void): Promise<boolean> {
    try {
        const year = new Date(invoice.invoice_date).getFullYear().toString();
        const yearFolderId = await findOrCreateFolder(year, folderIds[INVOICES_DIRECTORY]);
        const existing = await findFileByItem(invoice, yearFolderId, 'invoice');
        return await uploadFile(yearFolderId, invoice, existing?.fileId, 0, 'invoice');
    } finally {
        reportProgress(); // Always report progress even if upload fails
    }
}

async function uploadInvoiceToYearFolder(invoice: Invoice, yearFolderId: string, reportProgress: () => void): Promise<boolean> {
    try {
        const existing = await findFileByItem(invoice, yearFolderId, 'invoice');
        return await uploadFile(yearFolderId, invoice, existing?.fileId, 0, 'invoice');
    } finally {
        reportProgress(); // Always report progress even if upload fails
    }
}

// Get files from all year subfolders in invoices directory
async function getDriveFilesFromAllYearFolders<T extends { id: string }>(invoicesFolderId: string): Promise<Map<string, { fileId: string; modifiedTime: string; data: T }>> {
    const allFiles = new Map<string, { fileId: string; modifiedTime: string; data: T }>();
    
    try {
        // Get all year folders
        const response = await gapi.client.drive.files.list({
            q: `'${invoicesFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
        });

        if (response.result.files) {
            // Get files from each year folder
            const folderPromises = response.result.files.map(async (folder) => {
                const folderFiles = await getDriveFiles<T>(folder.id!);
                folderFiles.forEach((value, key) => {
                    allFiles.set(key, value);
                });
            });
            
            await Promise.all(folderPromises);
        }
    } catch (error) {
        console.error('Error getting files from year folders:', error);
    }
    
    return allFiles;
}

// --- Public Helper Functions ---

export const getSyncStatus = () => ({ isSyncing });

/**
 * Clear all caches - useful for troubleshooting
 */
export function clearGoogleDriveCaches(): void {
    folderCreationCache.clear();
    folderIdCache.clear();
    folderIds = {};
    console.log('Google Drive caches cleared');
}

/**
 * Manually clean up duplicate folders (call this outside of sync operations)
 */
export async function cleanupDuplicateFoldersManually(): Promise<void> {
    if (!await isGoogleDriveAuthenticated()) {
        console.log('Not authenticated with Google Drive');
        return;
    }

    try {
        console.log('Starting manual cleanup of duplicate folders...');
        
        // Find all folders in the app directory
        const response = await gapi.client.drive.files.list({
            q: `'${folderIds[APP_FOLDER_NAME]}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
        });

        if (response.result.files) {
            const foldersByName = new Map<string, any[]>();
            
            // Group folders by name
            response.result.files.forEach(folder => {
                if (!foldersByName.has(folder.name!)) {
                    foldersByName.set(folder.name!, []);
                }
                foldersByName.get(folder.name!)!.push(folder);
            });

            // Clean up duplicates
            for (const [name, folders] of foldersByName) {
                if (folders.length > 1) {
                    console.log(`Found ${folders.length} folders named "${name}". Cleaning up duplicates...`);
                    const keepFolder = folders[0];
                    const duplicates = folders.slice(1);
                    
                    await cleanupDuplicateFolders(folders, keepFolder.id!);
                }
            }
        }

        console.log('Manual cleanup completed');
    } catch (error) {
        console.error('Error during manual cleanup:', error);
    }
}

// Individual file upload functions - called immediately after local save
// This provides instant upload without waiting for periodic sync
export async function saveCustomerToGoogleDrive(customer: CustomerData): Promise<void> {
    if (!await isGoogleDriveAuthenticated()) return;
    
    isSyncing = true;
    try {
        await initializeDirectoryStructure();
        await uploadCustomer(customer, () => {});
    } catch (error) {
        console.error('Error saving customer to Google Drive:', error);
    } finally {
        isSyncing = false;
    }
}

export async function saveProductToGoogleDrive(product: ProductData): Promise<void> {
    if (!await isGoogleDriveAuthenticated()) return;
    
    isSyncing = true;
    try {
        await initializeDirectoryStructure();
        await uploadProduct(product, () => {});
    } catch (error) {
        console.error('Error saving product to Google Drive:', error);
    } finally {
        isSyncing = false;
    }
}

export async function saveInvoiceToGoogleDrive(invoice: Invoice): Promise<void> {
    if (!await isGoogleDriveAuthenticated()) return;
    
    isSyncing = true;
    try {
        await initializeDirectoryStructure();
        await uploadInvoice(invoice, () => {});
    } catch (error) {
        console.error('Error saving invoice to Google Drive:', error);
    } finally {
        isSyncing = false;
    }
}

export async function saveTaxSettingsToGoogleDrive(taxSettings: any): Promise<void> {
    if (!await isGoogleDriveAuthenticated()) return;
    
    isSyncing = true;
    try {
        await initializeDirectoryStructure();
        await uploadTaxSettings(taxSettings, () => {});
    } catch (error) {
        console.error('Error saving tax settings to Google Drive:', error);
    } finally {
        isSyncing = false;
    }
}

export async function saveCompanyInfoToGoogleDrive(companyInfo: CompanyInfo): Promise<void> {
    if (!await isGoogleDriveAuthenticated()) return;
    
    isSyncing = true;
    try {
        await initializeDirectoryStructure();
        await uploadCompanyInfo(companyInfo, () => {});
    } catch (error) {
        console.error('Error saving company info to Google Drive:', error);
    } finally {
        isSyncing = false;
    }
}

// --- Bidirectional Sync Functions ---

/**
 * Download all data from Google Drive with timestamps
 */
export async function downloadAllDataFromDrive(): Promise<{
    invoices: Invoice[];
    customers: CustomerData[];
    products: ProductData[];
    companyInfo: CompanyInfo | null;
    timesheets: Array<{ customerName: string; year: number; month: number; blob: Blob; lastModified: string }>;
    taxSettings: any | null;
}> {
    if (!await isGoogleDriveAuthenticated()) {
        throw new Error('Not authenticated with Google Drive');
    }

    try {
        await initializeDirectoryStructure();

        // Download all data in parallel
        const [customers, products, invoices, companyInfo, taxSettings, timesheets] = await Promise.all([
            getDriveFiles<CustomerData>(folderIds[CUSTOMERS_DIRECTORY]),
            getDriveFiles<ProductData>(folderIds[PRODUCTS_DIRECTORY]),
            getDriveFilesFromAllYearFolders<Invoice>(folderIds[INVOICES_DIRECTORY]),
            downloadCompanyInfo(),
            downloadTaxSettings(),
            downloadAllTimesheets(),
        ]);

        // Convert maps to arrays and filter deleted items
        const customersList = Array.from(customers.values())
            .map(c => c.data)
            .filter(c => !c.isDeleted);
        const productsList = Array.from(products.values())
            .map(p => p.data)
            .filter(p => !p.isDeleted);
        const invoicesList = Array.from(invoices.values())
            .map(i => i.data)
            .filter(i => !i.isDeleted);

        return {
            invoices: invoicesList,
            customers: customersList,
            products: productsList,
            companyInfo,
            timesheets,
            taxSettings,
        };
    } catch (error) {
        console.error('Error downloading data from Google Drive:', error);
        throw error;
    }
}

/**
 * Download company info from Drive
 */
async function downloadCompanyInfo(): Promise<CompanyInfo | null> {
    try {
        const file = await findFileByName(COMPANY_INFO_FILENAME, folderIds[APP_FOLDER_NAME]);
        if (!file) {
            return null;
        }

        const content: any = await gapi.client.drive.files.get({
            fileId: file.fileId,
            alt: 'media',
        });

        // Handle different response formats
        const data = parseDriveMediaResponse<CompanyInfo>(content);
        
        return data;
    } catch (error) {
        console.error('Error downloading company info:', error);
        return null;
    }
}

/**
 * Download tax settings from Drive
 */
async function downloadTaxSettings(): Promise<any | null> {
    try {
        const file = await findFileByName(TAX_SETTINGS_FILENAME, folderIds[APP_FOLDER_NAME]);
        if (!file) {
            return null;
        }

        const content: any = await gapi.client.drive.files.get({
            fileId: file.fileId,
            alt: 'media',
        });

        const data = parseDriveMediaResponse<any>(content);
        return data;
    } catch (error) {
        console.error('Error downloading tax settings:', error);
        return null;
    }
}

/**
 * Download all timesheets from Drive
 * Returns array of { customerName, year, month, blob, lastModified }
 */
async function downloadAllTimesheets(): Promise<Array<{
    customerName: string;
    year: number;
    month: number;
    blob: Blob;
    lastModified: string;
}>> {
    try {
        const timesheetsFolderId = folderIds[TIMESHEETS_DIRECTORY];
        if (!timesheetsFolderId) return [];

        const result: Array<{ customerName: string; year: number; month: number; blob: Blob; lastModified: string }> = [];

        // List all customer folders
        const customerFolders = await listFolders(timesheetsFolderId);
        
        for (const customerFolder of customerFolders) {
            const customerName = customerFolder.name;
            
            // List all year folders for this customer
            const yearFolders = await listFolders(customerFolder.id);
            
            for (const yearFolder of yearFolders) {
                const year = Number(yearFolder.name);
                if (isNaN(year)) continue;
                
                // List all Excel files in this year folder
                const files = await listFilesInFolder(yearFolder.id, '.xlsx');
                
                for (const file of files) {
                    // Extract month from filename
                    const parts = file.name.replace('.xlsx', '').split('_');
                    const monthStr = parts[parts.length - 1];
                    const month = Number(monthStr);
                    
                    if (!isNaN(month)) {
                        // Download the Excel file as blob
                        const response: any = await gapi.client.drive.files.get({
                            fileId: file.id,
                            alt: 'media',
                        });
                        
                        // Convert response to Blob
                        const blob = new Blob([response.body], { 
                            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                        });
                        
                        result.push({
                            customerName,
                            year,
                            month,
                            blob,
                            lastModified: file.modifiedTime || new Date().toISOString(),
                        });
                    }
                }
            }
        }

        return result;
    } catch (error) {
        console.error('Error downloading timesheets:', error);
        return [];
    }
}

/**
 * List all folders in a parent folder
 */
async function listFolders(parentFolderId: string): Promise<Array<{ id: string; name: string }>> {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            pageSize: 1000,
        });
        return response.result.files || [];
    } catch (error) {
        console.error('Error listing folders:', error);
        return [];
    }
}

/**
 * List all files in a folder with optional extension filter
 */
async function listFilesInFolder(folderId: string, extension?: string): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    try {
        let query = `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`;
        if (extension) {
            query += ` and name contains '${extension}'`;
        }
        
        const response = await gapi.client.drive.files.list({
            q: query,
            fields: 'files(id, name, modifiedTime)',
            pageSize: 1000,
        });
        const files = response.result.files || [];
        // Ensure all files have modifiedTime
        return files.map(f => ({
            id: f.id || '',
            name: f.name || '',
            modifiedTime: f.modifiedTime || new Date().toISOString(),
        }));
    } catch (error) {
        console.error('Error listing files:', error);
        return [];
    }
}

/**
 * Strip syncStatus field from an entity before uploading
 */
function stripSyncStatus<T extends Record<string, any>>(entity: T): Omit<T, 'syncStatus'> {
    const { syncStatus, ...cleanEntity } = entity;
    return cleanEntity as Omit<T, 'syncStatus'>;
}

/**
 * Upload all data to Google Drive (used by sync engine)
 */
export async function uploadAllDataToDrive(data: {
    invoices: Invoice[];
    customers: CustomerData[];
    products: ProductData[];
    companyInfo: CompanyInfo | null;
    taxSettings?: any | null;
    timesheets?: Array<{ customerName: string; year: number; month: number; fileHandle: FileSystemFileHandle }>;
}): Promise<number> {
    if (!await isGoogleDriveAuthenticated()) {
        throw new Error('Not authenticated with Google Drive');
    }

    try {
        await initializeDirectoryStructure();

        const uploadPromises: Promise<boolean>[] = [];

        // Upload company info (strip syncStatus)
        if (data.companyInfo) {
            const cleanCompanyInfo = stripSyncStatus(data.companyInfo);
            uploadPromises.push(uploadCompanyInfo(cleanCompanyInfo, () => {}));
        }

        // Upload tax settings (strip syncStatus)
        if (data.taxSettings) {
            const cleanTaxSettings = stripSyncStatus(data.taxSettings);
            uploadPromises.push(uploadTaxSettings(cleanTaxSettings, () => {}));
        }

        // Upload customers (strip syncStatus)
        data.customers.forEach(customer => {
            const cleanCustomer = stripSyncStatus(customer);
            uploadPromises.push(uploadCustomer(cleanCustomer, () => {}));
        });

        // Upload products (strip syncStatus)
        data.products.forEach(product => {
            const cleanProduct = stripSyncStatus(product);
            uploadPromises.push(uploadProduct(cleanProduct, () => {}));
        });

        // Upload invoices grouped by year (strip syncStatus)
        const invoicesByYear = new Map<string, Invoice[]>();
        data.invoices.forEach(invoice => {
            const year = new Date(invoice.invoice_date).getFullYear().toString();
            if (!invoicesByYear.has(year)) {
                invoicesByYear.set(year, []);
            }
            invoicesByYear.get(year)!.push(invoice);
        });

        for (const [year, yearInvoices] of invoicesByYear) {
            const yearFolderId = await findOrCreateFolder(year, folderIds[INVOICES_DIRECTORY]);
            yearInvoices.forEach(invoice => {
                const cleanInvoice = stripSyncStatus(invoice);
                uploadPromises.push(uploadInvoiceToYearFolder(cleanInvoice, yearFolderId, () => {}));
            });
        }

        // Upload timesheets (Excel files)
        if (data.timesheets && data.timesheets.length > 0) {
            for (const timesheet of data.timesheets) {
                uploadPromises.push(uploadTimesheet(timesheet, () => {}));
            }
        }

        // Wait for all uploads with error handling
        const results = await Promise.allSettled(uploadPromises);
        const failed = results.filter(r => r.status === 'rejected');
        const uploadedCount = results.reduce((acc, r) => acc + (r.status === 'fulfilled' && r.value ? 1 : 0), 0);

        if (failed.length > 0) {
            console.error(`${failed.length} uploads failed during sync`);
        }
        return uploadedCount;
    } catch (error) {
        console.error('Error uploading data to Google Drive:', error);
        throw error;
    }
} 