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

    // Always call the hook unconditionally
    const fileSystemChildContext = useFileSystemChild();
    const hasFileSystemContext = fileSystemChildContext !== null && fileSystemChildContext !== undefined;

    // Initialize on client side only
    useEffect(() => {
        const initialize = async () => {
            // Check if Google Drive API is supported
            const supported = isGoogleDriveSupported();
            setIsSupported(supported);

            if (!supported) {
                console.error('Google Drive API is not supported or API credentials are missing');
                setIsInitialized(true);
                return;
            }

            if (supported) {
                try {
                    console.log('Initializing Google Drive API...');
                    // Load the Google API scripts
                    await loadGoogleApiScript().catch(err => {
                        console.error('Error loading Google API script:', err);
                        throw err;
                    });
                    
                    setGApiLoaded(true);
                    console.log('Google API script loaded successfully');
                    
                    await loadGoogleIdentityScript().catch(err => {
                        console.error('Error loading Google Identity Services script:', err);
                        throw err;
                    });
                    
                    setGisLoaded(true);
                    console.log('Google Identity Services script loaded successfully');

                    // Initialize the API
                    const initialized = await initializeGoogleDriveApi()
                        .catch(err => {
                            console.error('Error initializing Google Drive API:', err);
                            return false;
                        });
                    
                    setIsInitialized(true);
                    console.log('Google Drive API initialized:', initialized);

                    // Check if already authenticated
                    const authenticated = await isGoogleDriveAuthenticated()
                        .catch(err => {
                            console.error('Error checking Google Drive authentication:', err);
                            return false;
                        });
                    
                    setIsAuthenticated(authenticated);
                    console.log('Google Drive authenticated:', authenticated);

                    // Check if backup is enabled from localStorage
                    try {
                        const backupEnabled = localStorage.getItem('google-drive-backup-enabled') === 'true';
                        setIsBackupEnabled(backupEnabled && authenticated);
                    } catch (error) {
                        console.error('Error reading backup preference:', error);
                    }
                } catch (error) {
                    console.error('Error initializing Google Drive API:', error);
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

    const value = {
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
        saveProduct
    };

    return (
        <GoogleDriveContext.Provider value={value}>
            {children}
        </GoogleDriveContext.Provider>
    );
} 