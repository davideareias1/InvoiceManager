'use client';

import { Invoice } from '../interfaces';
import { loadCustomersFromFiles, loadProductsFromFiles, loadInvoicesFromFiles } from './fileSystemStorage';
import md5 from 'blueimp-md5'; // Added import for md5 hashing

// Constants
const LOCAL_STORAGE_TOKEN_KEY = 'google-drive-auth-token';
const FILE_EXTENSION = '.json';
const CUSTOMERS_DIRECTORY = 'customers';
const PRODUCTS_DIRECTORY = 'products';
const INVOICES_DIRECTORY = 'invoices';
const APP_FOLDER_NAME = 'InvoiceManager';

// Use environment variables for API credentials with proper fallbacks and warning
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
// Use the more limited scope that should be sufficient for app folder access
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Show warning if credentials are missing
if (!CLIENT_ID || !API_KEY) {
    console.warn('Google Drive API credentials missing. Please add NEXT_PUBLIC_CLIENT_ID and NEXT_PUBLIC_API_KEY to your .env.local file.');
}

// Global variables
let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;
let folderIds: Record<string, string> = {};

/**
 * Check if Google Drive API is supported (always true if the Google API scripts are loaded)
 */
export function isGoogleDriveSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(CLIENT_ID) && Boolean(API_KEY);
}

/**
 * Check if we're authenticated with Google Drive
 */
export async function isGoogleDriveAuthenticated(): Promise<boolean> {
    if (!isGoogleDriveSupported()) {
        return false;
    }
    
    if (!gapiInited || !gisInited) {
        console.warn('Google API not fully initialized yet');
        return false;
    }
    
    if (!gapi || !gapi.client) {
        console.error('gapi or gapi.client is undefined');
        return false;
    }
    
    try {
        return gapi.client.getToken() !== null;
    } catch (error) {
        console.error('Error checking Google Drive authentication:', error);
        return false;
    }
}

/**
 * Verify if the token is still valid and refresh if needed
 */
async function verifyAndRefreshToken(token: any): Promise<boolean> {
    if (!token || !token.access_token) {
        return false;
    }
    
    try {
        // Try to make a simple request to verify the token
        await gapi.client.drive.files.list({
            pageSize: 1,
            fields: 'files(name)'
        });
        
        // If no error, token is valid
        return true;
    } catch (error) {
        console.warn('Token validation failed, may need to reauthenticate:', error);
        // If token is expired or invalid, clear it
        localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
        gapi.client.setToken('');
        return false;
    }
}

/**
 * Initialize the Google Drive API
 */
export async function initializeGoogleDriveApi(): Promise<boolean> {
    if (!gapi) {
        console.error('Google API library (gapi) not loaded');
        return false;
    }

    try {
        // Initialize the client
        await new Promise<void>((resolve, reject) => {
            try {
                // Define the callback function separately
                const callbackFn = () => {
                    console.log('Google API client loaded');
                    resolve();
                };

                // TypeScript doesn't handle gapi.load properly, so we need to use any
                (gapi.load as any)('client', {
                    callback: callbackFn,
                    onerror: (error: any) => {
                        console.error('Error loading Google API client:', error);
                        reject(error);
                    },
                    timeout: 10000,
                    ontimeout: () => {
                        console.error('Timeout loading Google API client');
                        reject(new Error('Timeout loading Google API client'));
                    }
                });
            } catch (error) {
                console.error('Error in gapi.load:', error);
                reject(error);
            }
        });

        // Initialize the client with the API key and discovery document
        try {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: [DISCOVERY_DOC],
            });
            console.log('Google API client initialized');
        } catch (error) {
            console.error('Error initializing Google API client:', error);
            return false;
        }

        // Initialize token client
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: '' as any, // Will be set later when we're ready to handle it
                });
                console.log('Google Identity Services initialized');
            } catch (error) {
                console.error('Error initializing Google Identity Services:', error);
                return false;
            }
        } else {
            console.error('Google accounts API not available');
            return false;
        }

        gapiInited = true;
        gisInited = true;

        // Check if we have a stored token in localStorage
        try {
            const savedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
            if (savedToken) {
                const parsedToken = JSON.parse(savedToken);
                gapi.client.setToken(parsedToken);
                console.log('Restored Google Drive authentication token from localStorage');
                
                // Verify if the token is still valid
                const isValid = await verifyAndRefreshToken(parsedToken);
                if (!isValid) {
                    console.warn('Restored token is no longer valid, will need to reauthenticate');
                }
            }
        } catch (error) {
            console.error('Error restoring token from localStorage:', error);
            // Continue even if this fails
        }

        // Check if we're already authenticated
        try {
            const token = gapi.client.getToken();
            const authenticated = token !== null;
            if (authenticated) {
                try {
                    await initializeDirectoryStructure();
                } catch (error) {
                    console.error('Error initializing directory structure:', error);
                    // Continue even if this fails
                }
            }
        } catch (error) {
            console.error('Error checking authentication:', error);
            // Continue even if this fails
        }

        return true;
    } catch (error) {
        console.error('Error initializing Google Drive API:', error);
        return false;
    }
}

/**
 * Load Google API client script
 */
export function loadGoogleApiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('Window is undefined'));
            return;
        }

        // Check if script is already loaded and initialized
        if (typeof gapi !== 'undefined' && gapi.client) {
            console.log('Google API already loaded');
            gapiInited = true;
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: API_KEY,
                        discoveryDocs: [DISCOVERY_DOC],
                    });
                    console.log('Google API client initialized');
                    gapiInited = true;
                    resolve();
                } catch (error) {
                    console.error('Error initializing Google API client:', error);
                    reject(error);
                }
            });
        };
        script.onerror = (error) => {
            console.error('Error loading Google API script:', error);
            reject(error);
        };
        document.body.appendChild(script);
    });
}

/**
 * Load Google Identity Services script
 */
export function loadGoogleIdentityScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('Window is undefined'));
            return;
        }

        // Check if script is already loaded
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            console.log('Google Identity Services already loaded');
            gisInited = true;
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: '', // Will be set when requesting auth
            });
            
            // Check if we have a stored token in localStorage
            try {
                const savedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
                if (savedToken && gapi && gapi.client) {
                    const parsedToken = JSON.parse(savedToken);
                    gapi.client.setToken(parsedToken);
                    console.log('Restored Google Drive token during GIS load');
                    
                    // Validate token asynchronously - no need to wait for result
                    verifyAndRefreshToken(parsedToken).then(isValid => {
                        if (!isValid) {
                            console.warn('Token from localStorage is invalid or expired');
                        }
                    });
                }
            } catch (error) {
                console.error('Error restoring token during GIS load:', error);
            }
            
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            // Wait a bit to ensure the script is fully loaded
            setTimeout(() => {
                if (typeof google !== 'undefined' && google.accounts) {
                    tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: CLIENT_ID,
                        scope: SCOPES,
                        callback: '', // Will be set when requesting auth
                    });
                    console.log('Google Identity Services initialized');
                    gisInited = true;
                    
                    // Try to restore token here too
                    try {
                        const savedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
                        if (savedToken && gapi && gapi.client) {
                            const parsedToken = JSON.parse(savedToken);
                            gapi.client.setToken(parsedToken);
                            console.log('Restored Google Drive token after GIS script load');
                            
                            // Validate token asynchronously
                            verifyAndRefreshToken(parsedToken).then(isValid => {
                                if (!isValid) {
                                    console.warn('Token restored after script load is invalid or expired');
                                }
                            });
                        }
                    } catch (error) {
                        console.error('Error restoring token after GIS load:', error);
                    }
                    
                    resolve();
                } else {
                    console.error('Google accounts not available after loading script');
                    reject(new Error('Google accounts not available after loading script'));
                }
            }, 500);
        };
        script.onerror = (error) => {
            console.error('Error loading Google Identity Services script:', error);
            reject(error);
        };
        document.body.appendChild(script);
    });
}

/**
 * Request authorization to access Google Drive
 */
export async function requestGoogleDriveAuthorization(): Promise<boolean> {
    if (!isGoogleDriveSupported() || !gapi || !window.google || !gapi.client) {
        console.error('Google API not fully initialized');
        return false;
    }

    return new Promise((resolve) => {
        try {
            // Ensure tokenClient is initialized
            if (!tokenClient) {
                console.error('Token client not initialized');
                resolve(false);
                return;
            }

            tokenClient.callback = async (resp: any) => {
                if (resp.error) {
                    console.error('Authorization error:', resp);
                    resolve(false);
                    return;
                }
                
                try {
                    // Save token to localStorage for persistence
                    const token = gapi.client.getToken();
                    if (token) {
                        localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, JSON.stringify(token));
                        console.log('Saved Google Drive token to localStorage');
                    }
                    
                    // Initialize directory structure after successful authorization
                    await initializeDirectoryStructure();
                    console.log('Authorization successful');
                    resolve(true);
                } catch (error) {
                    console.error('Error after authorization:', error);
                    resolve(false);
                }
            };

            // Open the authorization popup
            if (gapi.client.getToken() === null) {
                // Request an access token for the user. 
                // Note: The 'prompt' parameter ensures a fresh popup rather than reusing one
                tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                // Skip if already authenticated
                console.log('Already authenticated with Google Drive');
                initializeDirectoryStructure()
                    .then(() => resolve(true))
                    .catch((error) => {
                        console.error('Error initializing directory structure with existing token:', error);
                        // Try re-authenticating if we get an error with the existing token
                        localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
                        tokenClient.requestAccessToken({ prompt: 'consent' });
                    });
            }
        } catch (error) {
            console.error('Error in authorization request:', error);
            resolve(false);
        }
    });
}

/**
 * Sign out from Google Drive
 */
export async function signOutGoogleDrive(): Promise<boolean> {
    if (!isGoogleDriveSupported() || !gapiInited || !gisInited) {
        return false;
    }

    try {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
            folderIds = {}; // Clear folder IDs
            
            // Clear the token from localStorage
            localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
            console.log('Removed Google Drive token from localStorage');
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error signing out:', error);
        return false;
    }
}

/**
 * Initialize required directory structure in Google Drive
 */
async function initializeDirectoryStructure(): Promise<boolean> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return false;
    }

    try {
        // First check if app folder exists
        const appFolderId = await findOrCreateFolder(APP_FOLDER_NAME);
        folderIds[APP_FOLDER_NAME] = appFolderId;

        // Create main directories if they don't exist
        folderIds[CUSTOMERS_DIRECTORY] = await findOrCreateFolder(CUSTOMERS_DIRECTORY, appFolderId);
        folderIds[PRODUCTS_DIRECTORY] = await findOrCreateFolder(PRODUCTS_DIRECTORY, appFolderId);
        
        // Create invoices directory
        const invoicesFolderId = await findOrCreateFolder(INVOICES_DIRECTORY, appFolderId);
        folderIds[INVOICES_DIRECTORY] = invoicesFolderId;

        // Create current year directory inside invoices
        const currentYear = new Date().getFullYear().toString();
        folderIds[`${INVOICES_DIRECTORY}/${currentYear}`] = await findOrCreateFolder(currentYear, invoicesFolderId);

        return true;
    } catch (error) {
        console.error('Error initializing directory structure in Google Drive:', error);
        return false;
    }
}

/**
 * Find a folder by name, or create it if it doesn't exist
 */
async function findOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
    try {
        // Search for the folder
        let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }

        const response = await gapi.client.drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = response.result.files;
        if (files && files.length > 0) {
            // Folder exists, return its ID
            return files[0].id;
        }

        // Folder doesn't exist, create it
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : []
        };

        const createResponse = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });

        return createResponse.result.id;
    } catch (error) {
        console.error(`Error finding/creating folder ${folderName}:`, error);
        throw error;
    }
}

/**
 * Find a file by name in a specific folder and return its ID and MD5 checksum
 */
async function findFile(fileName: string, folderId: string): Promise<{ id: string; md5Checksum: string } | null> {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, md5Checksum)', // Added md5Checksum to fields
            spaces: 'drive'
        });

        const files = response.result.files;
        if (files && files.length > 0 && files[0].id && files[0].md5Checksum) {
            // Return ID and MD5 checksum
            return { id: files[0].id, md5Checksum: files[0].md5Checksum };
        }
        return null;
    } catch (error) {
        console.error(`Error finding file ${fileName}:`, error);
        return null;
    }
}

/**
 * Helper function to sanitize filenames
 */
function sanitizeFilename(name: string): string {
    // Replace special characters with underscore
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Sync all existing local files to Google Drive
 * This will scan all local files and upload them to Google Drive if they don't exist there already
 */
export async function syncAllFilesToGoogleDrive(): Promise<{
    invoices: number;
    customers: number;
    products: number;
    success: boolean;
}> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return { invoices: 0, customers: 0, products: 0, success: false };
    }

    try {
        // Make sure directory structure is initialized
        await initializeDirectoryStructure();

        // Results counters
        let invoicesCount = 0;
        let customersCount = 0;
        let productsCount = 0;

        // First sync customers
        try {
            const customers = await loadCustomersFromFiles();
            for (const customer of customers) {
                const result = await saveCustomerToGoogleDrive(customer);
                if (result) customersCount++;
            }
        } catch (error) {
            console.error('Error syncing customers to Google Drive:', error);
        }

        // Then sync products
        try {
            const products = await loadProductsFromFiles();
            for (const product of products) {
                const result = await saveProductToGoogleDrive(product);
                if (result) productsCount++;
            }
        } catch (error) {
            console.error('Error syncing products to Google Drive:', error);
        }

        // Finally sync invoices
        try {
            const invoices = await loadInvoicesFromFiles();
            for (const invoice of invoices) {
                const result = await saveInvoiceToGoogleDrive(invoice);
                if (result) invoicesCount++;
            }
        } catch (error) {
            console.error('Error syncing invoices to Google Drive:', error);
        }

        return {
            invoices: invoicesCount,
            customers: customersCount,
            products: productsCount,
            success: true
        };
    } catch (error) {
        console.error('Error syncing files to Google Drive:', error);
        return { invoices: 0, customers: 0, products: 0, success: false };
    }
}

export async function saveCustomerToGoogleDrive(customer: any): Promise<boolean> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return false;
    }

    try {
        const customersFolder = folderIds[CUSTOMERS_DIRECTORY];
        if (!customersFolder) {
            throw new Error('Customers folder not found');
        }

        // Create a filename based on customer ID or name
        const filename = `customer_${customer.id || sanitizeFilename(customer.name)}${FILE_EXTENSION}`;
        const content = JSON.stringify(customer, null, 2);
        const localMd5Checksum = md5(content); // Calculate local MD5 checksum

        // Check if file already exists and get its checksum
        const existingFile = await findFile(filename, customersFolder);

        if (existingFile) {
            // Compare checksums
            if (existingFile.md5Checksum === localMd5Checksum) {
                console.log(`Customer file ${filename} is already up-to-date in Google Drive.`);
                return true; // Skip update if content is the same
            }

            console.log(`Updating existing customer file ${filename} in Google Drive.`);
            // Update existing file via multipart upload (only if checksums differ)
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const closeDelim = "\r\n--" + boundary + "--";

            const contentType = 'application/json';

            const metadata = {
                name: filename,
                mimeType: contentType
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n\r\n' +
                content +
                closeDelim;

            // Using fetch directly for more control over the request
            const token = gapi.client.getToken();
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': 'Bearer ' + token.access_token,
                        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                    },
                    body: multipartRequestBody
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to update file: ${response.status} ${await response.text()}`);
            }
        } else {
            console.log(`Creating new customer file ${filename} in Google Drive.`);
            // Create new file via multipart upload
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const closeDelim = "\r\n--" + boundary + "--";

            const contentType = 'application/json';

            const metadata = {
                name: filename,
                mimeType: contentType,
                parents: [customersFolder]
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n\r\n' +
                content +
                closeDelim;

            // Using fetch directly for more control over the request
            const token = gapi.client.getToken();
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token.access_token,
                        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                    },
                    body: multipartRequestBody
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to create file: ${response.status} ${await response.text()}`);
            }
        }

        return true;
    } catch (error) {
        console.error('Error saving customer to Google Drive:', error);
        return false;
    }
}

export async function saveProductToGoogleDrive(product: any): Promise<boolean> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return false;
    }

    try {
        const productsFolder = folderIds[PRODUCTS_DIRECTORY];
        if (!productsFolder) {
            throw new Error('Products folder not found');
        }

        // Create a filename based on product ID or name
        const filename = `product_${product.id || sanitizeFilename(product.name)}${FILE_EXTENSION}`;
        const content = JSON.stringify(product, null, 2);
        const localMd5Checksum = md5(content); // Calculate local MD5 checksum

        // Check if file already exists and get its checksum
        const existingFile = await findFile(filename, productsFolder);

        if (existingFile) {
             // Compare checksums
             if (existingFile.md5Checksum === localMd5Checksum) {
                console.log(`Product file ${filename} is already up-to-date in Google Drive.`);
                return true; // Skip update if content is the same
            }

            console.log(`Updating existing product file ${filename} in Google Drive.`);
            // Update existing file via multipart upload (only if checksums differ)
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const closeDelim = "\r\n--" + boundary + "--";

            const contentType = 'application/json';

            const metadata = {
                name: filename,
                mimeType: contentType
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n\r\n' +
                content +
                closeDelim;

            // Using fetch directly for more control over the request
            const token = gapi.client.getToken();
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': 'Bearer ' + token.access_token,
                        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                    },
                    body: multipartRequestBody
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to update file: ${response.status} ${await response.text()}`);
            }
        } else {
            console.log(`Creating new product file ${filename} in Google Drive.`);
            // Create new file via multipart upload
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const closeDelim = "\r\n--" + boundary + "--";

            const contentType = 'application/json';

            const metadata = {
                name: filename,
                mimeType: contentType,
                parents: [productsFolder]
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n\r\n' +
                content +
                closeDelim;

            // Using fetch directly for more control over the request
            const token = gapi.client.getToken();
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token.access_token,
                        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                    },
                    body: multipartRequestBody
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to create file: ${response.status} ${await response.text()}`);
            }
        }

        return true;
    } catch (error) {
        console.error('Error saving product to Google Drive:', error);
        return false;
    }
}

export async function saveInvoiceToGoogleDrive(invoice: Invoice): Promise<boolean> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return false;
    }

    try {
        // Get year from invoice date
        const invoiceDate = new Date(invoice.invoice_date);
        const year = invoiceDate.getFullYear().toString();

        // Get or create year directory
        let yearFolderId = folderIds[`${INVOICES_DIRECTORY}/${year}`];
        if (!yearFolderId) {
            const invoicesFolderId = folderIds[INVOICES_DIRECTORY];
            if (!invoicesFolderId) {
                throw new Error('Invoices folder not found');
            }
            yearFolderId = await findOrCreateFolder(year, invoicesFolderId);
            folderIds[`${INVOICES_DIRECTORY}/${year}`] = yearFolderId;
        }

        // Create a filename based on invoice number
        const filename = `invoice_${invoice.invoice_number}${FILE_EXTENSION}`;
        const content = JSON.stringify(invoice, null, 2);
        const localMd5Checksum = md5(content); // Calculate local MD5 checksum

        // Check if file already exists and get its checksum
        const existingFile = await findFile(filename, yearFolderId);

        if (existingFile) {
            // Compare checksums
            if (existingFile.md5Checksum === localMd5Checksum) {
                console.log(`Invoice file ${filename} is already up-to-date in Google Drive.`);
                return true; // Skip update if content is the same
            }
            console.log(`Updating existing invoice file ${filename} in Google Drive.`);
            // Update existing file via multipart upload (only if checksums differ)
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const closeDelim = "\r\n--" + boundary + "--";

            const contentType = 'application/json';

            const metadata = {
                name: filename,
                mimeType: contentType
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n\r\n' +
                content +
                closeDelim;

            // Using fetch directly for more control over the request
            const token = gapi.client.getToken();
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': 'Bearer ' + token.access_token,
                        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                    },
                    body: multipartRequestBody
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to update file: ${response.status} ${await response.text()}`);
            }
        } else {
            console.log(`Creating new invoice file ${filename} in Google Drive.`);
            // Create new file via multipart upload
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const closeDelim = "\r\n--" + boundary + "--";

            const contentType = 'application/json';

            const metadata = {
                name: filename,
                mimeType: contentType,
                parents: [yearFolderId]
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n\r\n' +
                content +
                closeDelim;

            // Using fetch directly for more control over the request
            const token = gapi.client.getToken();
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token.access_token,
                        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                    },
                    body: multipartRequestBody
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to create file: ${response.status} ${await response.text()}`);
            }
        }

        return true;
    } catch (error) {
        console.error(`Error saving invoice ${invoice.invoice_number} to Google Drive:`, error);
        return false;
    }
}

/**
 * Load all invoices from Google Drive
 */
export async function loadInvoicesFromGoogleDrive(): Promise<Invoice[]> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return [];
    }

    try {
        const invoicesFolderId = folderIds[INVOICES_DIRECTORY];
        if (!invoicesFolderId) {
            return [];
        }

        const invoices: Invoice[] = [];

        // Get all year folders
        const yearFoldersResponse = await gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and '${invoicesFolderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const yearFolders = yearFoldersResponse.result.files || [];
        
        // Process each year folder
        for (const yearFolder of yearFolders) {
            // Query invoice files in this year folder
            const filesResponse = await gapi.client.drive.files.list({
                q: `'${yearFolder.id}' in parents and mimeType='application/json' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            const files = filesResponse.result.files || [];

            // Process each file
            for (const file of files) {
                if (file.name.endsWith(FILE_EXTENSION)) {
                    try {
                        // Get file content
                        const contentResponse = await gapi.client.drive.files.get({
                            fileId: file.id,
                            alt: 'media'
                        });
                        
                        const invoice = contentResponse.result as Invoice;
                        
                        // Validate that this is actually an Invoice object
                        if (invoice && typeof invoice === 'object' && 'invoice_number' in invoice) {
                            invoices.push(invoice);
                        } else {
                            console.warn(`File ${file.name} does not contain valid invoice data`);
                        }
                    } catch (error) {
                        console.error(`Error reading file ${file.name}:`, error);
                    }
                }
            }
        }

        // Sort invoices by date (newest first)
        return invoices.sort((a, b) => {
            return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
        });
    } catch (error) {
        console.error('Error loading invoices from Google Drive:', error);
        return [];
    }
}

/**
 * Load all customers from Google Drive
 */
export async function loadCustomersFromGoogleDrive(): Promise<any[]> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return [];
    }

    try {
        const customersFolderId = folderIds[CUSTOMERS_DIRECTORY];
        if (!customersFolderId) {
            return [];
        }

        const customers: any[] = [];

        // Query customer files
        const filesResponse = await gapi.client.drive.files.list({
            q: `'${customersFolderId}' in parents and mimeType='application/json' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = filesResponse.result.files || [];

        // Process each file
        for (const file of files) {
            if (file.name.endsWith(FILE_EXTENSION)) {
                try {
                    // Get file content
                    const contentResponse = await gapi.client.drive.files.get({
                        fileId: file.id,
                        alt: 'media'
                    });
                    
                    const customer = contentResponse.result;
                    customers.push(customer);
                } catch (error) {
                    console.error(`Error reading customer file ${file.name}:`, error);
                }
            }
        }

        return customers;
    } catch (error) {
        console.error('Error loading customers from Google Drive:', error);
        return [];
    }
}

/**
 * Load all products from Google Drive
 */
export async function loadProductsFromGoogleDrive(): Promise<any[]> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return [];
    }

    try {
        const productsFolderId = folderIds[PRODUCTS_DIRECTORY];
        if (!productsFolderId) {
            return [];
        }

        const products: any[] = [];

        // Query product files
        const filesResponse = await gapi.client.drive.files.list({
            q: `'${productsFolderId}' in parents and mimeType='application/json' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = filesResponse.result.files || [];

        // Process each file
        for (const file of files) {
            if (file.name.endsWith(FILE_EXTENSION)) {
                try {
                    // Get file content
                    const contentResponse = await gapi.client.drive.files.get({
                        fileId: file.id,
                        alt: 'media'
                    });
                    
                    const product = contentResponse.result;
                    products.push(product);
                } catch (error) {
                    console.error(`Error reading product file ${file.name}:`, error);
                }
            }
        }

        return products;
    } catch (error) {
        console.error('Error loading products from Google Drive:', error);
        return [];
    }
}

/**
 * Delete an invoice file from Google Drive
 */
export async function deleteInvoiceFromGoogleDrive(invoiceNumber: string): Promise<boolean> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return false;
    }

    try {
        const invoicesFolderId = folderIds[INVOICES_DIRECTORY];
        if (!invoicesFolderId) {
            return false;
        }

        // Get all year folders
        const yearFoldersResponse = await gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and '${invoicesFolderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const yearFolders = yearFoldersResponse.result.files || [];
        const filename = `invoice_${invoiceNumber}${FILE_EXTENSION}`;
        
        // Look in each year folder
        for (const yearFolder of yearFolders) {
            const fileId = await findFile(filename, yearFolder.id);
            if (fileId) {
                // Delete the file - call as a method with bracket notation to avoid TypeScript issues
                await (gapi.client.drive.files as any)['delete']({
                    fileId: fileId
                });
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('Error deleting invoice from Google Drive:', error);
        return false;
    }
}

/**
 * Delete a customer file from Google Drive
 */
export async function deleteCustomerFromGoogleDrive(customerId: string): Promise<boolean> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return false;
    }

    try {
        const customersFolderId = folderIds[CUSTOMERS_DIRECTORY];
        if (!customersFolderId) {
            return false;
        }

        // Query customer files
        const filesResponse = await gapi.client.drive.files.list({
            q: `'${customersFolderId}' in parents and mimeType='application/json' and trashed=false`,
            fields: 'files(id, name, appProperties)',
            spaces: 'drive'
        });

        const files = filesResponse.result.files || [];

        // Process each file to find the one with matching ID
        for (const file of files) {
            try {
                // Get file content to check ID
                const contentResponse = await gapi.client.drive.files.get({
                    fileId: file.id,
                    alt: 'media'
                });
                
                const customer = contentResponse.result;
                if (customer.id === customerId) {
                    // Delete the file - call as a method with bracket notation to avoid TypeScript issues
                    await (gapi.client.drive.files as any)['delete']({
                        fileId: file.id
                    });
                    return true;
                }
            } catch (error) {
                console.error(`Error reading customer file ${file.name}:`, error);
            }
        }

        return false;
    } catch (error) {
        console.error('Error deleting customer from Google Drive:', error);
        return false;
    }
}

/**
 * Delete a product file from Google Drive
 */
export async function deleteProductFromGoogleDrive(productId: string): Promise<boolean> {
    if (!isGoogleDriveSupported() || !await isGoogleDriveAuthenticated()) {
        return false;
    }

    try {
        const productsFolderId = folderIds[PRODUCTS_DIRECTORY];
        if (!productsFolderId) {
            return false;
        }

        // Query product files
        const filesResponse = await gapi.client.drive.files.list({
            q: `'${productsFolderId}' in parents and mimeType='application/json' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = filesResponse.result.files || [];

        // Process each file to find the one with matching ID
        for (const file of files) {
            try {
                // Get file content to check ID
                const contentResponse = await gapi.client.drive.files.get({
                    fileId: file.id,
                    alt: 'media'
                });
                
                const product = contentResponse.result;
                if (product.id === productId) {
                    // Delete the file - call as a method with bracket notation to avoid TypeScript issues
                    await (gapi.client.drive.files as any)['delete']({
                        fileId: file.id
                    });
                    return true;
                }
            } catch (error) {
                console.error(`Error reading product file ${file.name}:`, error);
            }
        }

        return false;
    } catch (error) {
        console.error('Error deleting product from Google Drive:', error);
        return false;
    }
} 