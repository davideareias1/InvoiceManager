'use client';

import { Invoice } from '../interfaces';

// Constants
const DIRECTORY_HANDLE_KEY = 'google-drive-token';
const FILE_EXTENSION = '.json';
const CUSTOMERS_DIRECTORY = 'customers';
const PRODUCTS_DIRECTORY = 'products';
const INVOICES_DIRECTORY = 'invoices';
const APP_FOLDER_NAME = 'InvoiceManager';

// Use environment variables for API credentials with proper fallbacks and warning
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
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
 * Initialize Google API client
 */
export async function initializeGoogleDriveApi(): Promise<boolean> {
    if (!isGoogleDriveSupported()) {
        return false;
    }

    try {
        // Wait for both GAPI and GIS to be initialized
        if (!gapiInited || !gisInited) {
            console.error('Cannot initialize Google Drive API: APIs not loaded', { gapiInited, gisInited });
            return false;
        }

        // Additional check to ensure client is initialized
        if (!gapi.client) {
            console.error('gapi.client is not initialized');
            
            // Try to initialize it manually
            try {
                await gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                });
                console.log('Manually initialized gapi.client');
            } catch (error) {
                console.error('Failed to manually initialize gapi.client', error);
                return false;
            }
        }

        // Check if we're already authenticated
        if (await isGoogleDriveAuthenticated()) {
            // Initialize directory structure if authenticated
            await initializeDirectoryStructure();
            return true;
        }

        return false;
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
 * Request Google Drive authorization
 */
export async function requestGoogleDriveAuthorization(): Promise<boolean> {
    if (!isGoogleDriveSupported() || !gapiInited || !gisInited) {
        console.error('Cannot request authorization: API not initialized', { gapiInited, gisInited });
        return false;
    }

    if (!tokenClient) {
        console.error('TokenClient is not initialized');
        // Try to initialize it if it's not set yet
        try {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: '', // Will be set when requesting auth
                });
            } else {
                console.error('Google accounts still not available');
                return false;
            }
        } catch (error) {
            console.error('Error initializing token client:', error);
            return false;
        }
    }

    return new Promise((resolve) => {
        try {
            tokenClient.callback = async (resp: any) => {
                if (resp.error !== undefined) {
                    console.error('Authorization error:', resp);
                    resolve(false);
                    return;
                }
                
                // Initialize directory structure after successful auth
                await initializeDirectoryStructure();
                resolve(true);
            };

            if (gapi.client.getToken() === null) {
                // Prompt the user to select a Google Account and ask for consent
                tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                // Skip display of account chooser for an existing session
                tokenClient.requestAccessToken({ prompt: '' });
            }
        } catch (error) {
            console.error('Error requesting authorization:', error);
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
 * Save a customer to Google Drive
 */
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

        // Check if file already exists
        const existingFileId = await findFile(filename, customersFolder);
        
        // Prepare file metadata and content
        const fileMetadata = {
            name: filename,
            parents: existingFileId ? undefined : [customersFolder]
        };

        const media = {
            mimeType: 'application/json',
            body: JSON.stringify(customer, null, 2)
        };

        if (existingFileId) {
            // Update existing file
            await gapi.client.drive.files.update({
                fileId: existingFileId,
                resource: fileMetadata,
                media: media
            });
        } else {
            // Create new file
            await gapi.client.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });
        }

        return true;
    } catch (error) {
        console.error('Error saving customer to Google Drive:', error);
        return false;
    }
}

/**
 * Save a product to Google Drive
 */
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

        // Check if file already exists
        const existingFileId = await findFile(filename, productsFolder);
        
        // Prepare file metadata and content
        const fileMetadata = {
            name: filename,
            parents: existingFileId ? undefined : [productsFolder]
        };

        const media = {
            mimeType: 'application/json',
            body: JSON.stringify(product, null, 2)
        };

        if (existingFileId) {
            // Update existing file
            await gapi.client.drive.files.update({
                fileId: existingFileId,
                resource: fileMetadata,
                media: media
            });
        } else {
            // Create new file
            await gapi.client.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });
        }

        return true;
    } catch (error) {
        console.error('Error saving product to Google Drive:', error);
        return false;
    }
}

/**
 * Save an invoice to Google Drive with year folder organization
 */
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

        // Check if file already exists
        const existingFileId = await findFile(filename, yearFolderId);
        
        // Prepare file metadata and content
        const fileMetadata = {
            name: filename,
            parents: existingFileId ? undefined : [yearFolderId]
        };

        const media = {
            mimeType: 'application/json',
            body: JSON.stringify(invoice, null, 2)
        };

        if (existingFileId) {
            // Update existing file
            await gapi.client.drive.files.update({
                fileId: existingFileId,
                resource: fileMetadata,
                media: media
            });
        } else {
            // Create new file
            await gapi.client.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });
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

/**
 * Find a file by name in a specific folder
 */
async function findFile(fileName: string, folderId: string): Promise<string | null> {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0].id;
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