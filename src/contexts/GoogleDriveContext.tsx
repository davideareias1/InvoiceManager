'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
    isGoogleDriveSupported,
    isGoogleDriveAuthenticated,
    requestGoogleDriveAuthorization,
    signOutGoogleDrive,
    loadGoogleApiScript,
    loadGoogleIdentityScript,
    initializeGoogleDriveApi,
    saveInvoiceToGoogleDrive,
    loadInvoicesFromGoogleDrive,
    deleteInvoiceFromGoogleDrive,
    saveCustomerToGoogleDrive,
    saveProductToGoogleDrive,
    syncAllFilesToGoogleDrive
} from '../utils/googleDriveStorage';
import { Invoice } from '../interfaces';
import { useFileSystemChild, FileSystemChildContextType } from './FileSystemContext';

interface GoogleDriveContextType {
    isSupported: boolean;
    isInitialized: boolean;
    isLoading: boolean;
    isAuthenticated: boolean;
    isBackupEnabled: boolean;
    setIsBackupEnabled: (enabled: boolean) => void;
    requestPermission: () => Promise<boolean>;
    signOut: () => Promise<boolean>;
    saveInvoice: (invoice: Invoice) => Promise<boolean>;
    deleteInvoice: (invoiceNumber: string) => Promise<boolean>;
    saveCustomer: (customer: any) => Promise<boolean>;
    saveProduct: (product: any) => Promise<boolean>;
    syncAllFiles: () => Promise<{
        invoices: number;
        customers: number;
        products: number;
        success: boolean;
    }>;
    connectionStatusMessage: string;
    syncProgress: { current: number, total: number } | null;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

export function useGoogleDrive() {
    const context = useContext(GoogleDriveContext);
    if (context === undefined) {
        throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
    }
    return context;
}

interface GoogleDriveProviderProps {
    children: ReactNode;
}

export function GoogleDriveProvider({ children }: GoogleDriveProviderProps) {
    const [isSupported, setIsSupported] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isBackupEnabled, setIsBackupEnabled] = useState(false);
    const [gApiLoaded, setGApiLoaded] = useState(false);
    const [gisLoaded, setGisLoaded] = useState(false);
    const [connectionStatusMessage, setConnectionStatusMessage] = useState('Initializing...');
    const [syncProgress, setSyncProgress] = useState<{ current: number, total: number } | null>(null);

    // Always call the hook unconditionally
    const fileSystemChildContext = useFileSystemChild();
    const hasFileSystemContext = fileSystemChildContext !== null && fileSystemChildContext !== undefined;

    // Initialize on client side only
    useEffect(() => {
        const initialize = async () => {
            // Check if Google Drive API is supported
            const supported = isGoogleDriveSupported();
            setIsSupported(supported);
            setConnectionStatusMessage('Checking browser support...');

            if (!supported) {
                console.error('Google Drive API is not supported or API credentials are missing');
                setConnectionStatusMessage('Google Drive not supported by browser or credentials missing.');
                setIsInitialized(true);
                return;
            }

            if (supported) {
                try {
                    setConnectionStatusMessage('Loading Google API scripts...');
                    console.log('Initializing Google Drive API...');
                    // Load the Google API scripts
                    await loadGoogleApiScript().catch(err => {
                        console.error('Error loading Google API script:', err);
                        setConnectionStatusMessage('Failed to load Google API.');
                        throw err;
                    });
                    
                    setGApiLoaded(true);
                    console.log('Google API script loaded successfully');
                    setConnectionStatusMessage('Loading Google Identity Services...');
                    
                    await loadGoogleIdentityScript().catch(err => {
                        console.error('Error loading Google Identity Services script:', err);
                        setConnectionStatusMessage('Failed to load Google Identity Services.');
                        throw err;
                    });
                    
                    setGisLoaded(true);
                    console.log('Google Identity Services script loaded successfully');
                    setConnectionStatusMessage('Initializing Google Drive client...');

                    // Initialize the API
                    const initialized = await initializeGoogleDriveApi()
                        .catch(err => {
                            console.error('Error initializing Google Drive API:', err);
                            setConnectionStatusMessage('Failed to initialize Google Drive client.');
                            return false;
                        });
                    
                    console.log('Google Drive API client initialized:', initialized);
                    
                    if (!initialized) {
                        setIsInitialized(true);
                        return;
                    }

                    setConnectionStatusMessage('Checking authentication status...');
                    // Check if already authenticated
                    const authenticated = await isGoogleDriveAuthenticated()
                        .catch(err => {
                            console.error('Error checking Google Drive authentication:', err);
                            setConnectionStatusMessage('Failed to check authentication.');
                            return false;
                        });
                    
                    setIsAuthenticated(authenticated);
                    console.log('Google Drive authenticated:', authenticated);
                    setConnectionStatusMessage(authenticated ? 'Connected.' : 'Ready to connect.');

                    // Check if backup is enabled from localStorage
                    try {
                        const backupEnabled = localStorage.getItem('google-drive-backup-enabled') === 'true';
                        setIsBackupEnabled(backupEnabled && authenticated);
                    } catch (error) {
                        console.error('Error reading backup preference:', error);
                    }
                    
                    setIsInitialized(true);
                    
                } catch (error) {
                    console.error('Error during Google Drive initialization process:', error);
                    if (!connectionStatusMessage.startsWith('Failed')) {
                        setConnectionStatusMessage('An error occurred during initialization.');
                    }
                    setIsInitialized(true);
                }
            } else {
                setIsInitialized(true);
            }
        };

        initialize();
    }, []);

    // Register backup functions with FileSystemContext when backup is enabled/disabled
    useEffect(() => {
        if (!hasFileSystemContext || !isInitialized) {
            return;
        }

        // Create a stable reference to the functions we're registering
        const backupConfig = {
            saveInvoice: isBackupEnabled && isAuthenticated ? saveInvoice : null,
            deleteInvoice: isBackupEnabled && isAuthenticated ? deleteInvoice : null,
            saveCustomer: isBackupEnabled && isAuthenticated ? saveCustomer : null,
            saveProduct: isBackupEnabled && isAuthenticated ? saveProduct : null,
            isBackupEnabled: isBackupEnabled && isAuthenticated
        };

        // Register the functions with the FileSystemContext
        fileSystemChildContext.registerGoogleDriveBackup(backupConfig);
        
        // Only re-run this effect when the enabled state or authentication state changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isBackupEnabled, isAuthenticated, isInitialized, hasFileSystemContext]);

    // Save backup preference to localStorage
    useEffect(() => {
        if (isInitialized) {
            try {
                localStorage.setItem('google-drive-backup-enabled', isBackupEnabled.toString());
            } catch (error) {
                console.error('Error saving backup preference:', error);
            }
        }
    }, [isBackupEnabled, isInitialized]);

    // Request Google Drive authorization
    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !gApiLoaded || !gisLoaded) {
            return false;
        }

        try {
            setIsLoading(true);
            const authorized = await requestGoogleDriveAuthorization();
            setIsAuthenticated(authorized);
            if (authorized) {
                setIsBackupEnabled(true);
            }
            return authorized;
        } catch (error) {
            console.error('Error requesting Google Drive authorization:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, gApiLoaded, gisLoaded]);

    // Sign out from Google Drive
    const signOut = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !isAuthenticated) {
            return false;
        }

        try {
            const success = await signOutGoogleDrive();
            if (success) {
                setIsAuthenticated(false);
                setIsBackupEnabled(false);
            }
            return success;
        } catch (error) {
            console.error('Error signing out from Google Drive:', error);
            return false;
        }
    }, [isSupported, isAuthenticated]);

    // Save an invoice to Google Drive
    const saveInvoice = useCallback(async (invoice: Invoice): Promise<boolean> => {
        if (!isSupported || !isAuthenticated || !isBackupEnabled) {
            return false;
        }

        try {
            setIsLoading(true);
            return await saveInvoiceToGoogleDrive(invoice);
        } catch (error) {
            console.error('Error saving invoice to Google Drive:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, isAuthenticated, isBackupEnabled]);

    // Delete an invoice from Google Drive
    const deleteInvoice = useCallback(async (invoiceNumber: string): Promise<boolean> => {
        if (!isSupported || !isAuthenticated || !isBackupEnabled) {
            return false;
        }

        try {
            return await deleteInvoiceFromGoogleDrive(invoiceNumber);
        } catch (error) {
            console.error('Error deleting invoice from Google Drive:', error);
            return false;
        }
    }, [isSupported, isAuthenticated, isBackupEnabled]);

    // Save a customer to Google Drive
    const saveCustomer = useCallback(async (customer: any): Promise<boolean> => {
        if (!isSupported || !isAuthenticated || !isBackupEnabled) {
            return false;
        }

        try {
            return await saveCustomerToGoogleDrive(customer);
        } catch (error) {
            console.error('Error saving customer to Google Drive:', error);
            return false;
        }
    }, [isSupported, isAuthenticated, isBackupEnabled]);

    // Save a product to Google Drive
    const saveProduct = useCallback(async (product: any): Promise<boolean> => {
        if (!isSupported || !isAuthenticated || !isBackupEnabled) {
            return false;
        }

        try {
            return await saveProductToGoogleDrive(product);
        } catch (error) {
            console.error('Error saving product to Google Drive:', error);
            return false;
        }
    }, [isSupported, isAuthenticated, isBackupEnabled]);

    // Sync all local files to Google Drive
    const syncAllFiles = useCallback(async (): Promise<{
        invoices: number;
        customers: number;
        products: number;
        success: boolean;
    }> => {
        if (!isSupported || !isAuthenticated) {
            console.warn('Cannot sync: Drive not supported or not authenticated.');
            return { invoices: 0, customers: 0, products: 0, success: false };
        }

        setIsLoading(true);
        setSyncProgress({ current: 0, total: 0 }); // Reset progress at the start

        const handleProgress = (progress: { current: number, total: number }) => {
            console.log('Sync Progress:', progress); // Optional: for debugging
            setSyncProgress(progress);
        };

        try {
            console.log('Starting full sync to Google Drive...');
            const result = await syncAllFilesToGoogleDrive(handleProgress); // Pass callback
            console.log('Sync complete:', result);
            return result;
        } catch (error) {
            console.error('Error syncing all files to Google Drive:', error);
            return { invoices: 0, customers: 0, products: 0, success: false };
        } finally {
            setIsLoading(false);
            setSyncProgress(null); // Clear progress when done
        }
    }, [isSupported, isAuthenticated]);

    const contextValue: GoogleDriveContextType = {
        isSupported,
        isInitialized,
        isLoading,
        isAuthenticated,
        isBackupEnabled,
        setIsBackupEnabled,
        requestPermission,
        signOut,
        saveInvoice,
        deleteInvoice,
        saveCustomer,
        saveProduct,
        syncAllFiles,
        connectionStatusMessage,
        syncProgress
    };

    return (
        <GoogleDriveContext.Provider value={contextValue}>
            {children}
        </GoogleDriveContext.Provider>
    );
} 