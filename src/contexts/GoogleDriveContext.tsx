'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
    isGoogleDriveSupported,
    isGoogleDriveAuthenticated,
    requestGoogleDriveAuthorization,
    signOutGoogleDrive,
    initializeGoogleDriveApi,
    saveInvoiceToGoogleDrive,
    saveCustomerToGoogleDrive,
    saveProductToGoogleDrive,
    backupAllDataToDrive,
    getSyncStatus,
} from '../utils/googleDriveStorage';
import { Invoice } from '../interfaces';
import { useFileSystemChild } from './FileSystemContext';

interface GoogleDriveContextType {
    isSupported: boolean;
    isInitialized: boolean;
    isLoading: boolean;
    isAuthenticated: boolean;
    isBackupEnabled: boolean;
    isSyncing: boolean;
    setIsBackupEnabled: (enabled: boolean) => void;
    requestPermission: () => Promise<void>;
    signOut: () => Promise<void>;
    saveInvoice: (invoice: Invoice) => Promise<boolean>;
    deleteInvoice: (invoiceNumber: string) => Promise<boolean>;
    saveCustomer: (customer: any) => Promise<boolean>;
    saveProduct: (product: any) => Promise<boolean>;
    backup: () => Promise<void>;
    connectionStatusMessage: string;
    syncProgress: { current: number, total: number } | null;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

export function useGoogleDrive() {
    const context = useContext(GoogleDriveContext);
    if (!context) {
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
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isBackupEnabled, setIsBackupEnabled] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [connectionStatusMessage, setConnectionStatusMessage] = useState('Initializing...');
    const [syncProgress, setSyncProgress] = useState<{ current: number, total: number } | null>(null);

    const fileSystemChildContext = useFileSystemChild();
    
    const saveInvoice = useCallback(async (invoice: Invoice): Promise<boolean> => {
        return true;
    }, []);
    
    const deleteInvoice = useCallback(async (invoiceNumber: string): Promise<boolean> => {
        // Deletion is handled by the sync engine when an item is marked as deleted.
        // This function is here to satisfy the FileSystemContext interface.
        console.warn(`deleteInvoice in GoogleDriveContext is deprecated for invoice: ${invoiceNumber}`);
        return true;
    }, []);

    const saveCustomer = useCallback(async (customer: any): Promise<boolean> => {
        return true;
    }, []);

    const saveProduct = useCallback(async (product: any): Promise<boolean> => {
        return true;
    }, []);

    // Initialize Google Drive API
    useEffect(() => {
        const initialize = async () => {
            const supported = isGoogleDriveSupported();
            setIsSupported(supported);
            
            if (!supported) {
                setConnectionStatusMessage('Google Drive not supported or credentials missing.');
                setIsInitialized(true);
                setIsLoading(false);
                return;
            }

            try {
                setConnectionStatusMessage('Loading Google APIs...');
                await initializeGoogleDriveApi();
                
                const authStatus = await isGoogleDriveAuthenticated();
                setIsAuthenticated(authStatus);
                setConnectionStatusMessage(authStatus ? 'Connected' : 'Ready to connect');

                // Load backup setting from localStorage
                const backupEnabled = localStorage.getItem('google-drive-backup-enabled') === 'true';
                setIsBackupEnabled(backupEnabled && authStatus);
                
                setConnectionStatusMessage(authStatus ? 'Connected' : 'Ready to connect');
            } catch (error) {
                console.error('Error during Google Drive initialization:', error);
                setConnectionStatusMessage('Error during initialization');
                setIsAuthenticated(false);
                setIsBackupEnabled(false);
            } finally {
                setIsInitialized(true);
                setIsLoading(false);
            }
        };

        initialize();
    }, []); // Only run once on mount

    // Monitor sync status
    useEffect(() => {
        const interval = setInterval(() => {
            const syncStatus = getSyncStatus();
            if (syncStatus.isSyncing !== isSyncing) {
                setIsSyncing(syncStatus.isSyncing);
            }
        }, 1000); // Check sync status every second

        return () => clearInterval(interval);
    }, [isSyncing]);

    // Register backup functions with file system context
    useEffect(() => {
        if (!fileSystemChildContext || !isInitialized) return;

        const backupConfig = {
            saveInvoice: isBackupEnabled && isAuthenticated ? saveInvoice : null,
            deleteInvoice: isBackupEnabled && isAuthenticated ? deleteInvoice : null,
            saveCustomer: isBackupEnabled && isAuthenticated ? saveCustomer : null,
            saveProduct: isBackupEnabled && isAuthenticated ? saveProduct : null,
            isBackupEnabled: isBackupEnabled && isAuthenticated,
        };
        fileSystemChildContext.registerGoogleDriveBackup(backupConfig);
    }, [isBackupEnabled, isAuthenticated, isInitialized, fileSystemChildContext, saveInvoice, deleteInvoice, saveCustomer, saveProduct]);

    // Save backup setting to localStorage
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('google-drive-backup-enabled', isBackupEnabled.toString());
        }
    }, [isBackupEnabled, isInitialized]);

    const requestPermission = useCallback(async (): Promise<void> => {
        if (!isSupported) {
            throw new Error('Google Drive not supported');
        }
        
        setIsLoading(true);
        setConnectionStatusMessage('Requesting authorization...');
        
        try {
            await requestGoogleDriveAuthorization();
            
            // Verify authentication was successful
            const authStatus = await isGoogleDriveAuthenticated();
            setIsAuthenticated(authStatus);
            
            if (authStatus) {
                setConnectionStatusMessage('Connected');
                setIsBackupEnabled(true); // Automatically enable backup after successful auth
            } else {
                setConnectionStatusMessage('Authorization failed');
                throw new Error('Authorization failed');
            }
        } catch (error) {
            console.error('Error requesting Google Drive authorization:', error);
            setConnectionStatusMessage('Authorization failed');
            setIsAuthenticated(false);
            setIsBackupEnabled(false);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported]);

    const signOut = useCallback(async (): Promise<void> => {
        if (!isSupported) return;
        
        try {
            await signOutGoogleDrive();
            setIsAuthenticated(false);
            setIsBackupEnabled(false);
            setConnectionStatusMessage('Signed out');
        } catch (error) {
            console.error('Error signing out of Google Drive:', error);
        }
    }, [isSupported]);

    const backup = useCallback(async (): Promise<void> => {
        if (!isSupported || !isAuthenticated) {
            throw new Error('Google Drive not available or not authenticated');
        }

        setSyncProgress({ current: 0, total: 0 });
        const handleProgress = (progress: { current: number, total: number }) => {
            setSyncProgress(progress);
        };

        try {
            await backupAllDataToDrive(handleProgress);
        } catch (error) {
            console.error('Error backing up all files to Google Drive:', error);
            throw error;
        } finally {
            setSyncProgress(null);
        }
    }, [isSupported, isAuthenticated]);

    const contextValue: GoogleDriveContextType = React.useMemo(() => ({
        isSupported,
        isInitialized,
        isLoading,
        isAuthenticated,
        isBackupEnabled,
        isSyncing,
        setIsBackupEnabled,
        requestPermission,
        signOut,
        saveInvoice,
        deleteInvoice,
        saveCustomer,
        saveProduct,
        backup,
        connectionStatusMessage,
        syncProgress
    }), [
        isSupported,
        isInitialized,
        isLoading,
        isAuthenticated,
        isBackupEnabled,
        isSyncing,
        requestPermission,
        signOut,
        saveInvoice,
        deleteInvoice,
        saveCustomer,
        saveProduct,
        backup,
        connectionStatusMessage,
        syncProgress
    ]);

    return (
        <GoogleDriveContext.Provider value={contextValue}>
            {children}
        </GoogleDriveContext.Provider>
    );
} 