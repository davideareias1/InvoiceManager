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
            }
            return success;
        } catch (error) {
            console.error("Error deleting invoice:", error);
            return false;
        }
    };

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
                {children}
        </FileSystemContext.Provider>
    );
} 