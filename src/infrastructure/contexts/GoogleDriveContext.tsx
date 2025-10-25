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
} from '../google/googleDriveStorage';
import { Invoice } from '../../domain/models';
import { useFileSystemChild } from './FileSystemContext';
import {
    initializeNetworkMonitor,
    cleanupNetworkMonitor,
    onNetworkStatusChange,
    isOnline as checkIsOnline,
} from '../sync/networkMonitor';
import {
    startSyncScheduler,
    stopSyncScheduler,
    triggerImmediateSync,
    onSyncStarted,
    onSyncCompleted,
    onSyncProgressUpdate,
    onSyncErrorOccurred,
} from '../sync/syncScheduler';
import {
    getSyncState,
    setSyncEnabled,
    isSyncEnabled as checkSyncEnabled,
    isDataSourceSelected,
} from '../sync/syncState';
import { SyncProgress, SyncResult } from '../sync/types';

interface GoogleDriveContextType {
    isSupported: boolean;
    isInitialized: boolean;
    isLoading: boolean;
    isAuthenticated: boolean;
    isBackupEnabled: boolean;
    isSyncing: boolean;
    isOnline: boolean;
    isReadOnly: boolean;
    isSyncEnabled: boolean;
    lastSyncTime: Date | null;
    syncError: Error | null;
    setIsBackupEnabled: (enabled: boolean) => void;
    setSyncEnabled: (enabled: boolean) => void;
    requestPermission: () => Promise<void>;
    signOut: () => Promise<void>;
    saveInvoice: (invoice: Invoice) => Promise<boolean>;
    deleteInvoice: (invoiceNumber: string) => Promise<boolean>;
    saveCustomer: (customer: any) => Promise<boolean>;
    saveProduct: (product: any) => Promise<boolean>;
    backup: () => Promise<void>;
    manualSync: () => Promise<void>;
    connectionStatusMessage: string;
    syncProgress: SyncProgress | null;
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
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncEnabled, setIsSyncEnabledState] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState<Error | null>(null);
    const [connectionStatusMessage, setConnectionStatusMessage] = useState('Initializing...');
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

    const fileSystemChildContext = useFileSystemChild();

    // Computed: read-only mode when offline
    const isReadOnly = !isOnline;
    
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

    // Initialize network monitor
    useEffect(() => {
        initializeNetworkMonitor();
        
        const unsubscribe = onNetworkStatusChange((status) => {
            setIsOnline(status.isOnline);
        });

        return () => {
            cleanupNetworkMonitor();
            unsubscribe();
        };
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
                
                // Load sync enabled state
                const syncEnabled = checkSyncEnabled();
                setIsSyncEnabledState(syncEnabled);
                
                // Load last sync time from sync state
                const syncState = getSyncState();
                if (syncState.lastSyncTimestamp) {
                    setLastSyncTime(new Date(syncState.lastSyncTimestamp));
                }
                
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

    // Start/stop sync scheduler based on sync enabled and authentication
    useEffect(() => {
        if (isSyncEnabled && isAuthenticated && isDataSourceSelected()) {
            // Register sync callbacks
            onSyncStarted(() => {
                setIsSyncing(true);
                setSyncError(null);
            });

            onSyncCompleted((result: SyncResult) => {
                setIsSyncing(false);
                if (result.success) {
                    setLastSyncTime(new Date());
                    setSyncError(null);
                } else {
                    setSyncError(result.error || new Error('Sync failed'));
                }
            });

            onSyncProgressUpdate((progress: SyncProgress) => {
                setSyncProgress(progress);
            });

            onSyncErrorOccurred((error: Error) => {
                setSyncError(error);
                setIsSyncing(false);
            });

            // Start the sync scheduler
            startSyncScheduler();
            console.log('Sync scheduler started');

            return () => {
                stopSyncScheduler();
                console.log('Sync scheduler stopped');
            };
        } else {
            stopSyncScheduler();
        }
    }, [isSyncEnabled, isAuthenticated]);

    // Monitor legacy sync status
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
        
        setIsLoading(true);
        setConnectionStatusMessage('Signing out...');
        
        try {
            await signOutGoogleDrive();
            setIsAuthenticated(false);
            setIsBackupEnabled(false);
            setConnectionStatusMessage('Signed out');
        } catch (error) {
            console.error('Error signing out of Google Drive:', error);
            setConnectionStatusMessage('Sign out failed');
            // Still update the auth state even if sign out had errors
            setIsAuthenticated(false);
            setIsBackupEnabled(false);
        } finally {
            setIsLoading(false);
        }
    }, [isSupported]);

    const backup = useCallback(async (): Promise<void> => {
        if (!isSupported || !isAuthenticated) {
            throw new Error('Google Drive not available or not authenticated');
        }

        setConnectionStatusMessage('Backing up...');
        setSyncProgress({ 
            current: 0, 
            total: 0, 
            stage: 'pushing',
            message: 'Starting backup...'
        });
        
        const handleProgress = (progress: { current: number, total: number }) => {
            setSyncProgress({
                ...progress,
                stage: 'pushing',
                message: 'Backing up data...'
            });
        };

        try {
            await backupAllDataToDrive(handleProgress);
            setConnectionStatusMessage('Backup completed');
        } catch (error) {
            console.error('Error backing up all files to Google Drive:', error);
            setConnectionStatusMessage('Backup failed');
            throw error;
        } finally {
            setSyncProgress(null);
            // Reset status message after a delay if no other operation is running
            setTimeout(() => {
                setConnectionStatusMessage(isAuthenticated ? 'Connected' : 'Not connected');
            }, 3000);
        }
    }, [isSupported, isAuthenticated]);

    const handleSetSyncEnabled = useCallback((enabled: boolean) => {
        setSyncEnabled(enabled);
        setIsSyncEnabledState(enabled);
    }, []);

    const manualSync = useCallback(async (): Promise<void> => {
        if (!isSupported || !isAuthenticated) {
            throw new Error('Google Drive not available or not authenticated');
        }

        if (!isOnline) {
            throw new Error('Cannot sync while offline');
        }

        if (!isDataSourceSelected()) {
            throw new Error('Data source not selected. Please select a data source first.');
        }

        try {
            await triggerImmediateSync();
        } catch (error) {
            console.error('Error during manual sync:', error);
            throw error;
        }
    }, [isSupported, isAuthenticated, isOnline]);

    const contextValue: GoogleDriveContextType = React.useMemo(() => ({
        isSupported,
        isInitialized,
        isLoading,
        isAuthenticated,
        isBackupEnabled,
        isSyncing,
        isOnline,
        isReadOnly,
        isSyncEnabled,
        lastSyncTime,
        syncError,
        setIsBackupEnabled,
        setSyncEnabled: handleSetSyncEnabled,
        requestPermission,
        signOut,
        saveInvoice,
        deleteInvoice,
        saveCustomer,
        saveProduct,
        backup,
        manualSync,
        connectionStatusMessage,
        syncProgress
    }), [
        isSupported,
        isInitialized,
        isLoading,
        isAuthenticated,
        isBackupEnabled,
        isSyncing,
        isOnline,
        isReadOnly,
        isSyncEnabled,
        lastSyncTime,
        syncError,
        handleSetSyncEnabled,
        requestPermission,
        signOut,
        saveInvoice,
        deleteInvoice,
        saveCustomer,
        saveProduct,
        backup,
        manualSync,
        connectionStatusMessage,
        syncProgress
    ]);

    return (
        <GoogleDriveContext.Provider value={contextValue}>
            {children}
        </GoogleDriveContext.Provider>
    );
} 