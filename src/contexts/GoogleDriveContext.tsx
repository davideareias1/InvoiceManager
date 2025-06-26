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
    synchronizeData,
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
    synchronize: () => Promise<void>;
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
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isBackupEnabled, setIsBackupEnabled] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [connectionStatusMessage, setConnectionStatusMessage] = useState('Initializing...');
    const [syncProgress, setSyncProgress] = useState<{ current: number, total: number } | null>(null);

    const fileSystemChildContext = useFileSystemChild();
    
    const saveInvoice = useCallback(async (invoice: Invoice): Promise<boolean> => {
        if (!isSupported || !isAuthenticated || !isBackupEnabled) return false;
        setIsSyncing(true);
        try {
            await saveInvoiceToGoogleDrive(invoice);
            return true;
        } catch (e) {
            console.error("Failed to save invoice to drive", e);
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [isSupported, isAuthenticated, isBackupEnabled]);
    
    const deleteInvoice = useCallback(async (invoiceNumber: string): Promise<boolean> => {
        // Deletion is handled by the sync engine when an item is marked as deleted.
        // This function is here to satisfy the FileSystemContext interface.
        console.warn(`deleteInvoice in GoogleDriveContext is deprecated for invoice: ${invoiceNumber}`);
        return true;
    }, []);

    const saveCustomer = useCallback(async (customer: any): Promise<boolean> => {
        if (!isSupported || !isAuthenticated || !isBackupEnabled) return false;
        setIsSyncing(true);
        try {
            await saveCustomerToGoogleDrive(customer);
            return true;
        } catch (e) {
            console.error("Failed to save customer to drive", e);
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [isSupported, isAuthenticated, isBackupEnabled]);

    const saveProduct = useCallback(async (product: any): Promise<boolean> => {
        if (!isSupported || !isAuthenticated || !isBackupEnabled) return false;
        setIsSyncing(true);
        try {
            await saveProductToGoogleDrive(product);
            return true;
        } catch (e) {
            console.error("Failed to save product to drive", e);
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [isSupported, isAuthenticated, isBackupEnabled]);

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
                setConnectionStatusMessage(authStatus ? 'Connected.' : 'Ready to connect.');

                const backupEnabled = localStorage.getItem('google-drive-backup-enabled') === 'true';
                setIsBackupEnabled(backupEnabled && authStatus);
            } catch (error) {
                console.error('Error during Google Drive initialization:', error);
                setConnectionStatusMessage('Error during initialization.');
            } finally {
                setIsInitialized(true);
                setIsLoading(false);
            }
        };

        initialize();

        const interval = setInterval(async () => {
            const authStatus = await isGoogleDriveAuthenticated();
            if(authStatus !== isAuthenticated) setIsAuthenticated(authStatus);
            const syncStatus = getSyncStatus();
            if(syncStatus.isSyncing !== isSyncing) setIsSyncing(syncStatus.isSyncing);
        }, 2000); // Periodically check auth and sync status

        return () => clearInterval(interval);

    }, [isAuthenticated, isSyncing]);

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

    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('google-drive-backup-enabled', isBackupEnabled.toString());
        }
    }, [isBackupEnabled, isInitialized]);

    const requestPermission = useCallback(async (): Promise<void> => {
        if (!isSupported) return;
        setIsLoading(true);
        try {
            await requestGoogleDriveAuthorization();
            // Auth state will be updated by the periodic check
        } catch (error) {
            console.error('Error requesting Google Drive authorization:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isSupported]);

    const signOut = useCallback(async (): Promise<void> => {
        if (!isSupported || !isAuthenticated) return;
        await signOutGoogleDrive();
        setIsAuthenticated(false);
        setIsBackupEnabled(false);
    }, [isSupported, isAuthenticated]);

    const synchronize = useCallback(async (): Promise<void> => {
        if (!isSupported || !isAuthenticated) return;

        setSyncProgress({ current: 0, total: 0 });
        const handleProgress = (progress: { current: number, total: number }) => {
            setSyncProgress(progress);
        };

        try {
            await synchronizeData(handleProgress);
        } catch (error) {
            console.error('Error syncing all files to Google Drive:', error);
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
        synchronize,
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
        synchronize,
        connectionStatusMessage,
        syncProgress
    ]);

    return (
        <GoogleDriveContext.Provider value={contextValue}>
            {children}
        </GoogleDriveContext.Provider>
    );
} 