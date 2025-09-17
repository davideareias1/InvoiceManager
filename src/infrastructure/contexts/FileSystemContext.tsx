'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    isFileSystemAccessSupported,
    requestDirectoryPermission,
    createNewWorkspaceDirectory,
    hasSavedDirectory,
    initializeFileSystem,
    getSavedDirectoryHandle,
    setDirectoryHandle as setFileSystemDirectoryHandle,
    resetDirectoryAccess
} from '../filesystem/fileSystemStorage';
import { Invoice } from '../../domain/models';
import { setDirectoryHandle as setCustomerDirectoryHandle } from '../repositories/customerRepository';
import { setDirectoryHandle as setProductDirectoryHandle } from '../repositories/productRepository';
import { setDirectoryHandle as setInvoiceDirectoryHandle, loadInvoices as loadInvoicesFromUtils, deleteInvoice as deleteInvoiceFromUtils, saveInvoice as saveInvoiceToUtils } from '../repositories/invoiceRepository';
import { setDirectoryHandle as setTimeTrackingDirectoryHandle } from '../repositories/timeTrackingRepository';

interface FileSystemContextType {
    isSupported: boolean;
    isInitialized: boolean;
    isSaving: boolean;
    isLoading: boolean;
    hasPermission: boolean;
    directoryRequested: boolean;
    invoices: Invoice[];
    currentFolderName: string | null;
    requestPermission: () => Promise<boolean>;
    createWorkspace: () => Promise<boolean>;
    resetDirectoryAccess: () => Promise<void>;
    saveInvoices: (invoices: Invoice[]) => Promise<boolean>;
    saveInvoice: (invoice: Invoice) => Promise<boolean>;
    loadInvoices: () => Promise<Invoice[]>;
    deleteInvoice: (invoiceNumber: string) => Promise<boolean>;
    refreshInvoices: () => Promise<void>;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function useFileSystem() {
    const context = useContext(FileSystemContext);
    if (context === undefined) {
        throw new Error('useFileSystem must be used within a FileSystemProvider');
    }
    return context;
}

interface FileSystemProviderProps {
    children: ReactNode;
}

export function FileSystemProvider({ children }: FileSystemProviderProps) {
    const [isSupported, setIsSupported] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [directoryRequested, setDirectoryRequested] = useState(false);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentFolderName, setCurrentFolderName] = useState<string | null>(null);
    
    // For Google Drive backup - this will be passed to child context components
    const [googleDriveBackup, setGoogleDriveBackup] = useState<{
        saveInvoice: ((invoice: Invoice) => Promise<boolean>) | null;
        deleteInvoice: ((invoiceNumber: string) => Promise<boolean>) | null;
        saveCustomer: ((customer: any) => Promise<boolean>) | null;
        saveProduct: ((product: any) => Promise<boolean>) | null;
        isBackupEnabled: boolean;
    }>({
        saveInvoice: null,
        deleteInvoice: null,
        saveCustomer: null,
        saveProduct: null,
        isBackupEnabled: false
    });

    // Share directory handle with other utilities
    const shareDirectoryHandle = React.useCallback(async (): Promise<void> => {
        try {
            // Get the current directory handle from the storage API
            const currentHandle = await getSavedDirectoryHandle();
            if (currentHandle) {
                // Get the folder name for display
                setCurrentFolderName(currentHandle.name);
                
                // Share it with all utilities
                setFileSystemDirectoryHandle(currentHandle);
                setCustomerDirectoryHandle(currentHandle);
                setProductDirectoryHandle(currentHandle);
                setInvoiceDirectoryHandle(currentHandle);
                setTimeTrackingDirectoryHandle(currentHandle);
            }
        } catch (error) {
            console.error("Error sharing directory handle:", error);
        }
    }, []);

    // Internal function to refresh invoices
    const refreshInvoicesInternal = React.useCallback(async (): Promise<void> => {
        setIsLoading(true);
        try {
            const loadedInvoices = await loadInvoicesFromUtils();
            setInvoices(loadedInvoices);
        } catch (error) {
            console.error("Error loading invoices:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Reset directory access
    const resetDirectoryAccessInternal = async (): Promise<void> => {
        try {
            await resetDirectoryAccess();
            setHasPermission(false);
            setDirectoryRequested(false);
            setInvoices([]);
            setCurrentFolderName(null);
        } catch (error) {
            console.error('Error resetting directory access:', error);
        }
    };

    // Initialize on client side only
    useEffect(() => {
        // Check if File System Access API is supported
        const supported = isFileSystemAccessSupported();
        setIsSupported(supported);

        if (supported) {
            // Check if we have a saved directory
            const checkSavedDirectory = async () => {
                const hasSaved = await hasSavedDirectory();
                if (hasSaved) {
                    // Try to initialize with saved directory
                    const initialized = await initializeFileSystem();
                    setHasPermission(initialized);

                    if (initialized) {
                        // Share the directory handle with all repositories BEFORE marking initialized
                        await shareDirectoryHandle();
                        // Load invoices automatically (non-blocking for other pages)
                        await refreshInvoicesInternal();
                    }
                    setIsInitialized(true);
                } else {
                    setIsInitialized(true);
                }
            };

            checkSavedDirectory();
        } else {
            setIsInitialized(true);
        }
    }, [shareDirectoryHandle, refreshInvoicesInternal]);

    // Request directory permission
    const requestPermission = async (): Promise<boolean> => {
        setDirectoryRequested(true);
        const granted = await requestDirectoryPermission();
        setHasPermission(granted);

        if (granted) {
            // Share the directory handle with customer and product utils
            await shareDirectoryHandle();
            await refreshInvoicesInternal();
        }

        return granted;
    };

    // Create workspace and request permission to it
    const createWorkspace = async (): Promise<boolean> => {
        setDirectoryRequested(true);
        const created = await createNewWorkspaceDirectory();
        setHasPermission(created);

        if (created) {
            await shareDirectoryHandle();
            await refreshInvoicesInternal();
        }

        return created;
    };

    // Public function to refresh invoices
    const refreshInvoices = async (): Promise<void> => {
        await refreshInvoicesInternal();
    };

    // Save a single invoice
    const saveInvoice = async (invoice: Invoice): Promise<boolean> => {
        setIsSaving(true);
        try {
            const savedInvoice = await saveInvoiceToUtils(invoice);

            if (savedInvoice) {
                // Update local state - replace or add invoice
                setInvoices(prev => {
                    const index = prev.findIndex(inv => inv.invoice_number === savedInvoice.invoice_number);
                    if (index >= 0) {
                        // Replace existing invoice
                        const updated = [...prev];
                        updated[index] = savedInvoice;
                        return updated;
                    } else {
                        // Add new invoice
                        return [...prev, savedInvoice];
                    }
                });
                
                // If Google Drive backup is enabled, also save there
                if (googleDriveBackup.isBackupEnabled && googleDriveBackup.saveInvoice !== null) {
                    try {
                        await googleDriveBackup.saveInvoice(savedInvoice);
                    } catch (error) {
                        console.error("Error backing up invoice to Google Drive:", error);
                        // We don't want to fail the operation if just backup fails
                    }
                }
            }

            return !!savedInvoice;
        } catch (error) {
            console.error("Error saving invoice:", error);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    // Save invoices
    const saveInvoices = async (invoicesToSave: Invoice[]): Promise<boolean> => {
        setIsSaving(true);
        try {
            let success = true;
            const savedInvoices: Invoice[] = [];
            
            // Save each invoice individually
            for (const invoice of invoicesToSave) {
                try {
                    const savedInvoice = await saveInvoiceToUtils(invoice);
                    if (savedInvoice) {
                        savedInvoices.push(savedInvoice);
                        
                        if (googleDriveBackup.isBackupEnabled && googleDriveBackup.saveInvoice !== null) {
                            // Also backup to Google Drive if enabled
                            try {
                                await googleDriveBackup.saveInvoice(savedInvoice);
                            } catch (error) {
                                console.error("Error backing up invoice to Google Drive:", error);
                                // We don't want to fail the operation if just backup fails
                            }
                        }
                    } else {
                        success = false;
                    }
                } catch (error) {
                    console.error("Error saving invoice:", error);
                    success = false;
                }
            }
            
            if (success) {
                setInvoices(savedInvoices);
            }
            return success;
        } catch (error) {
            console.error("Error saving invoices:", error);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    // Load invoices
    const loadInvoices = async (): Promise<Invoice[]> => {
        setIsLoading(true);
        try {
            const loadedInvoices = await loadInvoicesFromUtils();
            setInvoices(loadedInvoices);
            return loadedInvoices;
        } catch (error) {
            console.error("Error loading invoices:", error);
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    // Delete invoice
    const deleteInvoice = async (invoiceNumber: string): Promise<boolean> => {
        try {
            // Find the invoice by number first
            const invoiceToDelete = invoices.find(inv => inv.invoice_number === invoiceNumber);
            if (!invoiceToDelete) {
                console.error(`Invoice with number ${invoiceNumber} not found.`);
                return false;
            }

            const success = await deleteInvoiceFromUtils(invoiceToDelete.id);
            if (success) {
                // Update local state
                setInvoices(prevInvoices => prevInvoices.filter(inv => inv.invoice_number !== invoiceNumber));
                
                // Also delete from Google Drive if backup is enabled
                if (googleDriveBackup.isBackupEnabled && googleDriveBackup.deleteInvoice !== null) {
                    try {
                        await googleDriveBackup.deleteInvoice(invoiceNumber);
                    } catch (error) {
                        console.error("Error deleting invoice from Google Drive backup:", error);
                        // We don't want to fail the operation if just backup fails
                    }
                }
            }
            return success;
        } catch (error) {
            console.error("Error deleting invoice:", error);
            return false;
        }
    };

    // Register Google Drive backup functions passed from the GoogleDriveProvider
    // This allows the GoogleDriveContext to register its functions with FileSystemContext
    const registerGoogleDriveBackup = (backupFunctions: {
        saveInvoice: ((invoice: Invoice) => Promise<boolean>) | null;
        deleteInvoice: ((invoiceNumber: string) => Promise<boolean>) | null;
        saveCustomer: ((customer: any) => Promise<boolean>) | null;
        saveProduct: ((product: any) => Promise<boolean>) | null;
        isBackupEnabled: boolean;
    }) => {
        // Only update state if the backup enabled status has actually changed
        // We can't compare the functions directly as they will always be different references
        if (backupFunctions.isBackupEnabled !== googleDriveBackup.isBackupEnabled) {
            setGoogleDriveBackup(backupFunctions);
        }
    };

    // Make registerGoogleDriveBackup available to child contexts
    const childContextValue = { registerGoogleDriveBackup };

    const value: FileSystemContextType = {
        isSupported,
        isInitialized,
        isSaving,
        isLoading,
        hasPermission,
        directoryRequested,
        invoices,
        currentFolderName,
        requestPermission,
        createWorkspace,
        resetDirectoryAccess: resetDirectoryAccessInternal,
        saveInvoices,
        saveInvoice,
        loadInvoices,
        deleteInvoice,
        refreshInvoices
    };

    return (
        <FileSystemContext.Provider value={value}>
            {/* @ts-ignore - childContextValue is passed to GoogleDriveProvider through context API */}
            <FileSystemChildContext.Provider value={childContextValue}>
                {children}
            </FileSystemChildContext.Provider>
        </FileSystemContext.Provider>
    );
}

// Export a child context for use by the GoogleDriveProvider
export interface FileSystemChildContextType {
    registerGoogleDriveBackup: (backupFunctions: {
        saveInvoice: ((invoice: Invoice) => Promise<boolean>) | null;
        deleteInvoice: ((invoiceNumber: string) => Promise<boolean>) | null;
        saveCustomer: ((customer: any) => Promise<boolean>) | null;
        saveProduct: ((product: any) => Promise<boolean>) | null;
        isBackupEnabled: boolean;
    }) => void;
}

const FileSystemChildContext = createContext<FileSystemChildContextType | undefined>(undefined);

export function useFileSystemChild() {
    const context = useContext(FileSystemChildContext);
    if (context === undefined) {
        throw new Error('useFileSystemChild must be used within a FileSystemProvider');
    }
    return context;
} 