'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, RefreshCw, Cloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGoogleDrive } from '../../infrastructure/contexts/GoogleDriveContext';

export default function SyncSettings() {
    const {
        isAuthenticated,
        isSyncEnabled,
        isOnline,
        lastSyncTime,
        syncError,
        isSyncing,
        requestPermission,
        signOut,
        manualSync,
        setSyncEnabled,
    } = useGoogleDrive();

    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    // ===== HANDLERS =====

    const handleConnect = async () => {
        setIsProcessing(true);
        setStatusMessage(null);
        try {
            await requestPermission();
            setStatusMessage({ type: 'success', text: 'Successfully connected to Google Drive!' });
        } catch (error) {
            console.error('Error connecting to Google Drive:', error);
            setStatusMessage({ type: 'error', text: 'Failed to connect to Google Drive' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDisconnect = async () => {
        setIsProcessing(true);
        setStatusMessage(null);
        try {
            await signOut();
            setSyncEnabled(false);
            setStatusMessage({ type: 'info', text: 'Disconnected from Google Drive' });
        } catch (error) {
            console.error('Error disconnecting from Google Drive:', error);
            setStatusMessage({ type: 'error', text: 'Failed to disconnect from Google Drive' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleToggleSync = async (enabled: boolean) => {
        try {
            setSyncEnabled(enabled);
            setStatusMessage({
                type: 'success',
                text: enabled ? 'Auto-sync enabled' : 'Auto-sync disabled'
            });
        } catch (error) {
            console.error('Error toggling sync:', error);
            setStatusMessage({ type: 'error', text: 'Failed to toggle sync' });
        }
    };

    const handleManualSync = async () => {
        setIsProcessing(true);
        setStatusMessage(null);
        try {
            await manualSync();
            setStatusMessage({ type: 'success', text: 'Manual sync completed successfully!' });
        } catch (error: any) {
            console.error('Error during manual sync:', error);
            setStatusMessage({ type: 'error', text: error.message || 'Failed to sync' });
        } finally {
            setIsProcessing(false);
        }
    };

    // ===== COMPUTED =====

    const formatLastSyncTime = (time: Date | null): string => {
        if (!time) return 'Never';
        
        const now = new Date();
        const diff = Math.floor((now.getTime() - time.getTime()) / 1000);
        
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        return time.toLocaleDateString();
    };

    // ===== RENDER =====

    return (
        <div className="space-y-6">
            {/* Status Message */}
            {statusMessage && (
                <Alert variant={statusMessage.type === 'error' ? 'destructive' : 'default'}>
                    <AlertDescription>{statusMessage.text}</AlertDescription>
                </Alert>
            )}

            {/* Google Drive Connection */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    Google Drive Connection
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">
                                Status: {isAuthenticated ? (
                                    <span className="text-green-600">Connected</span>
                                ) : (
                                    <span className="text-gray-500">Not Connected</span>
                                )}
                            </p>
                            {!isOnline && (
                                <p className="text-sm text-amber-600">Currently offline</p>
                            )}
                        </div>
                        <Button
                            onClick={isAuthenticated ? handleDisconnect : handleConnect}
                            disabled={isProcessing}
                            variant={isAuthenticated ? 'outline' : 'default'}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : isAuthenticated ? (
                                'Disconnect'
                            ) : (
                                'Connect to Google Drive'
                            )}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Sync Settings */}
            {isAuthenticated && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        Automatic Sync
                    </h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="auto-sync">Enable Automatic Sync</Label>
                                <p className="text-sm text-muted-foreground">
                                    Automatically sync changes every 10 seconds
                                </p>
                            </div>
                            <Switch
                                id="auto-sync"
                                checked={isSyncEnabled}
                                onCheckedChange={handleToggleSync}
                                disabled={!isOnline}
                            />
                        </div>

                        <div className="pt-4 border-t">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-sm font-medium">Last Sync</p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatLastSyncTime(lastSyncTime)}
                                    </p>
                                </div>
                                <Button
                                    onClick={handleManualSync}
                                    disabled={isProcessing || isSyncing || !isOnline}
                                    size="sm"
                                    variant="outline"
                                >
                                    {isSyncing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Sync Now
                                        </>
                                    )}
                                </Button>
                            </div>

                            {syncError && (
                                <div className="flex items-center gap-2 text-sm text-destructive mt-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{syncError.message}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Information */}
            <Card className="p-6 bg-blue-50 border-blue-200">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    How Sync Works
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Changes are automatically synchronized every 10 seconds when auto-sync is enabled</li>
                    <li>• Last-write-wins: The newest version of data always takes precedence</li>
                    <li>• All changes require an internet connection (read-only mode when offline)</li>
                    <li>• Data is synced at the entity level (invoice-by-invoice, customer-by-customer)</li>
                </ul>
            </Card>
        </div>
    );
}

