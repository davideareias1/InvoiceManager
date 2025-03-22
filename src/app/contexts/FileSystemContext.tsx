'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    isFileSystemAccessSupported,
    requestDirectoryPermission,
    hasSavedDirectory,
    saveInvoiceToFile,
    loadInvoicesFromFiles,
    deleteInvoiceFile,
    initializeFileSystem,
    getSavedDirectoryHandle,
    setDirectoryHandle as setFileSystemDirectoryHandle
} from '../utils/fileSystemStorage';
import { Invoice } from '../interfaces';
import { setDirectoryHandle as setCustomerDirectoryHandle } from '../utils/customerUtils';
import { setDirectoryHandle as setProductDirectoryHandle } from '../utils/productUtils';

interface FileSystemContextType {
    isSupported: boolean;
    isInitialized: boolean;
    isSaving: boolean;
    isLoading: boolean;
    hasPermission: boolean;
    directoryRequested: boolean;
    invoices: Invoice[];
    requestPermission: () => Promise<boolean>;
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
                    setIsInitialized(true);

                    if (initialized) {
                        // Share the directory handle with customer and product utils
                        await shareDirectoryHandle();
                        // Load invoices automatically
                        await refreshInvoicesInternal();
                    }
                } else {
                    setIsInitialized(true);
                }
            };

            checkSavedDirectory();
        } else {
            setIsInitialized(true);
        }
    }, []);

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

    // Share directory handle with other utilities
    const shareDirectoryHandle = async (): Promise<void> => {
        try {
            // Get the current directory handle from the storage API
            const currentHandle = await getSavedDirectoryHandle();
            if (currentHandle) {
                // Share it with all utilities
                setFileSystemDirectoryHandle(currentHandle);
                setCustomerDirectoryHandle(currentHandle);
                setProductDirectoryHandle(currentHandle);

                // Load initial data
                try {
                    await Promise.all([
                        refreshInvoicesInternal(),
                        // The following functions don't need to be awaited as they
                        // will load data internally when the directory handle is set
                    ]);
                } catch (error) {
                    console.error("Error loading initial data:", error);
                }
            }
        } catch (error) {
            console.error("Error sharing directory handle:", error);
        }
    };

    // Internal function to refresh invoices
    const refreshInvoicesInternal = async (): Promise<void> => {
        setIsLoading(true);
        try {
            const loadedInvoices = await loadInvoicesFromFiles();
            setInvoices(loadedInvoices);
        } catch (error) {
            console.error("Error loading invoices:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Public function to refresh invoices
    const refreshInvoices = async (): Promise<void> => {
        await refreshInvoicesInternal();
    };

    // Save a single invoice
    const saveInvoice = async (invoice: Invoice): Promise<boolean> => {
        setIsSaving(true);
        try {
            const result = await saveInvoiceToFile(invoice);

            if (result) {
                // Update local state - replace or add invoice
                setInvoices(prev => {
                    const index = prev.findIndex(inv => inv.invoice_number === invoice.invoice_number);
                    if (index >= 0) {
                        // Replace existing invoice
                        const updated = [...prev];
                        updated[index] = invoice;
                        return updated;
                    } else {
                        // Add new invoice
                        return [...prev, invoice];
                    }
                });
            }

            return result;
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
            // Save each invoice individually
            for (const invoice of invoicesToSave) {
                const result = await saveInvoiceToFile(invoice);
                if (!result) {
                    success = false;
                }
            }
            if (success) {
                setInvoices(invoicesToSave);
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
            const loadedInvoices = await loadInvoicesFromFiles();
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
            const success = await deleteInvoiceFile(invoiceNumber);
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

    const value = {
        isSupported,
        isInitialized,
        isSaving,
        isLoading,
        hasPermission,
        directoryRequested,
        invoices,
        requestPermission,
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