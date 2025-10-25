'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Cloud, HardDrive, Merge } from 'lucide-react';
import { setDataSource, isDataSourceSelected } from '../../infrastructure/sync/syncState';
import { restoreFromDrive, hasRemoteData } from '../../infrastructure/sync/syncEngine';
import { isGoogleDriveAuthenticated } from '../../infrastructure/google/googleDriveStorage';
import {
    loadInvoicesFromFiles,
    loadCustomersFromFiles,
    loadProductsFromFiles,
} from '../../infrastructure/filesystem/fileSystemStorage';

// ===== TYPES =====

interface DataSourceSelectorProps {
    onDataSourceSelected: (source: 'local' | 'drive' | 'merged') => void;
}

// ===== COMPONENT =====

export function DataSourceSelector({ onDataSourceSelected }: DataSourceSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLocalData, setHasLocalData] = useState(false);
    const [hasDriveData, setHasDriveData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // ===== EFFECTS =====

    useEffect(() => {
        checkDataSources();
    }, []);

    // ===== HANDLERS =====

    async function checkDataSources() {
        setIsLoading(true);
        setError(null);

        try {
            // Check if data source already selected
            if (isDataSourceSelected()) {
                setIsOpen(false);
                return;
            }

            // Check for local data
            const [invoices, customers, products] = await Promise.all([
                loadInvoicesFromFiles().catch(() => []),
                loadCustomersFromFiles().catch(() => []),
                loadProductsFromFiles().catch(() => []),
            ]);

            const hasLocal = invoices.length > 0 || customers.length > 0 || products.length > 0;
            setHasLocalData(hasLocal);

            // Check for Drive authentication and data
            const authenticated = await isGoogleDriveAuthenticated();
            setIsAuthenticated(authenticated);

            if (authenticated) {
                const hasDrive = await hasRemoteData();
                setHasDriveData(hasDrive);
            }

            // Show dialog if not already selected and there's data to choose from
            if (!isDataSourceSelected() && (hasLocal || (authenticated && hasDriveData))) {
                setIsOpen(true);
            }
        } catch (err) {
            console.error('Error checking data sources:', err);
            setError('Failed to check data sources');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSelectLocal() {
        setDataSource('local');
        setIsOpen(false);
        onDataSourceSelected('local');
    }

    async function handleSelectDrive() {
        if (!isAuthenticated) {
            setError('Please authenticate with Google Drive first');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await restoreFromDrive();
            setDataSource('drive');
            setIsOpen(false);
            onDataSourceSelected('drive');
        } catch (err) {
            console.error('Error restoring from Drive:', err);
            setError('Failed to restore data from Google Drive');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSelectMerged() {
        if (!isAuthenticated) {
            setError('Please authenticate with Google Drive first');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Merging will be handled by the sync engine on first sync
            setDataSource('merged');
            setIsOpen(false);
            onDataSourceSelected('merged');
        } catch (err) {
            console.error('Error setting up merge:', err);
            setError('Failed to set up data merge');
        } finally {
            setIsLoading(false);
        }
    }

    // ===== RENDER =====

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Choose Data Source</DialogTitle>
                    <DialogDescription>
                        You have data in multiple locations. Please choose which data you want to use.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {hasLocalData && (
                        <Button
                            variant="outline"
                            className="w-full h-auto py-4 flex flex-col items-start gap-2"
                            onClick={handleSelectLocal}
                            disabled={isLoading}
                        >
                            <div className="flex items-center gap-2">
                                <HardDrive className="h-5 w-5" />
                                <span className="font-semibold">Use Local Data</span>
                            </div>
                            <p className="text-sm text-muted-foreground text-left">
                                Continue with the data currently on this device
                            </p>
                        </Button>
                    )}

                    {isAuthenticated && hasDriveData && (
                        <Button
                            variant="outline"
                            className="w-full h-auto py-4 flex flex-col items-start gap-2"
                            onClick={handleSelectDrive}
                            disabled={isLoading}
                        >
                            <div className="flex items-center gap-2">
                                <Cloud className="h-5 w-5" />
                                <span className="font-semibold">Restore from Google Drive</span>
                            </div>
                            <p className="text-sm text-muted-foreground text-left">
                                Download and use data from Google Drive
                            </p>
                        </Button>
                    )}

                    {hasLocalData && isAuthenticated && hasDriveData && (
                        <Button
                            variant="outline"
                            className="w-full h-auto py-4 flex flex-col items-start gap-2"
                            onClick={handleSelectMerged}
                            disabled={isLoading}
                        >
                            <div className="flex items-center gap-2">
                                <Merge className="h-5 w-5" />
                                <span className="font-semibold">Merge Both</span>
                            </div>
                            <p className="text-sm text-muted-foreground text-left">
                                Combine local and Drive data (newer timestamps win)
                            </p>
                        </Button>
                    )}

                    {isLoading && (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="ml-2">Loading...</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <p className="text-xs text-muted-foreground">
                        This choice can be changed later in settings
                    </p>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

