'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { isOnline as checkIsOnline, initializeNetworkMonitor, cleanupNetworkMonitor, onNetworkStatusChange } from '../sync/networkMonitor';
import { getSyncState, setSyncEnabled, isSyncEnabled as checkSyncEnabled } from '../sync/syncState';
import { onSyncCompleted, onSyncErrorOccurred, onSyncProgressUpdate, onSyncStarted, startSyncScheduler, stopSyncScheduler, triggerImmediateSync, setSyncEngine } from '../sync/syncScheduler';
import { isNextcloudConfigured } from '../nextcloud/nextcloudStorage';
import { syncWithNextcloud, isNextcloudSyncInProgress } from '../sync/syncEngineNextcloud';
import { SyncProgress, SyncResult } from '../sync/types';

interface NextcloudContextType {
    isInitialized: boolean;
    isLoading: boolean;
    isConfigured: boolean;
    isSyncing: boolean;
    isOnline: boolean;
    isReadOnly: boolean;
    isSyncEnabled: boolean;
    lastSyncTime: Date | null;
    syncError: Error | null;
    connectionStatusMessage: string;
    syncProgress: SyncProgress | null;
    requestPermission: () => Promise<void>;
    signOut: () => Promise<void>;
    manualSync: () => Promise<void>;
    setSyncEnabled: (enabled: boolean) => void;
}

const NextcloudContext = createContext<NextcloudContextType | undefined>(undefined);

export function useNextcloud() {
    const ctx = useContext(NextcloudContext);
    if (!ctx) throw new Error('useNextcloud must be used within a NextcloudProvider');
    return ctx;
}

interface NextcloudProviderProps { children: React.ReactNode; }

export function NextcloudProvider({ children }: NextcloudProviderProps) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfigured, setIsConfigured] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncEnabled, setIsSyncEnabledState] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState<Error | null>(null);
    const [connectionStatusMessage, setConnectionStatusMessage] = useState('Initializing...');
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

    const isReadOnly = !isOnline;

    // Network monitor
    useEffect(() => {
        initializeNetworkMonitor();
        const unsubscribe = onNetworkStatusChange(status => setIsOnline(status.isOnline));
        return () => { cleanupNetworkMonitor(); unsubscribe(); };
    }, []);

    // Initialize: probe server config and load flags
    useEffect(() => {
        const init = async () => {
            try {
                const configured = await isNextcloudConfigured();
                setIsConfigured(configured);
                setConnectionStatusMessage(configured ? 'Connected' : 'Ready to connect');
                const syncEnabled = checkSyncEnabled();
                setIsSyncEnabledState(syncEnabled);
                const syncState = getSyncState();
                if (syncState.lastSyncTimestamp) setLastSyncTime(new Date(syncState.lastSyncTimestamp));
            } catch (e) {
                setIsConfigured(false);
                setConnectionStatusMessage('Not configured');
            } finally {
                setIsInitialized(true);
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // Wire scheduler callbacks (engine selection will be handled in scheduler-wire step)
    useEffect(() => {
        onSyncStarted(() => { setIsSyncing(true); setSyncError(null); });
        onSyncCompleted((result: SyncResult) => { setIsSyncing(false); if (result.success) { setLastSyncTime(new Date()); setSyncError(null); } else { setSyncError(result.error || new Error('Sync failed')); } });
        onSyncProgressUpdate((p: SyncProgress) => setSyncProgress(p));
        onSyncErrorOccurred((e: Error) => { setSyncError(e); setIsSyncing(false); });
    }, []);

    // Start/stop scheduler
    useEffect(() => {
        if (isSyncEnabled && isConfigured) {
            // Select Nextcloud engine
            setSyncEngine(syncWithNextcloud, isNextcloudSyncInProgress);
            startSyncScheduler();
            // immediate sync to pull remote changes
            triggerImmediateSync();
            return () => stopSyncScheduler();
        }
    }, [isSyncEnabled, isConfigured]);

    const requestPermission = useCallback(async () => {
        setIsLoading(true);
        setConnectionStatusMessage('Connecting to Nextcloud...');
        try {
            const configured = await isNextcloudConfigured();
            setIsConfigured(configured);
            setConnectionStatusMessage(configured ? 'Connected' : 'Not configured');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const signOut = useCallback(async () => {
        // For server-side credentials, sign-out is effectively disabling sync
        setIsConfigured(false);
        setIsSyncEnabledState(false);
        setSyncEnabled(false);
        stopSyncScheduler();
    }, []);

    const manualSync = useCallback(async () => {
        if (!isConfigured) throw new Error('Nextcloud not configured');
        if (!checkIsOnline()) throw new Error('Cannot sync while offline');
        await syncWithNextcloud();
    }, [isConfigured]);

    const handleSetSyncEnabled = useCallback((enabled: boolean) => {
        setSyncEnabled(enabled);
        setIsSyncEnabledState(enabled);
    }, []);

    const value: NextcloudContextType = useMemo(() => ({
        isInitialized,
        isLoading,
        isConfigured,
        isSyncing,
        isOnline,
        isReadOnly,
        isSyncEnabled,
        lastSyncTime,
        syncError,
        connectionStatusMessage,
        syncProgress,
        requestPermission,
        signOut,
        manualSync,
        setSyncEnabled: handleSetSyncEnabled,
    }), [
        isInitialized, isLoading, isConfigured, isSyncing, isOnline, isReadOnly, isSyncEnabled, lastSyncTime, syncError, connectionStatusMessage, syncProgress, requestPermission, signOut, manualSync, handleSetSyncEnabled
    ]);

    return (
        <NextcloudContext.Provider value={value}>
            {children}
        </NextcloudContext.Provider>
    );
}


