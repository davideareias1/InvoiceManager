'use client';

import { syncWithDrive, isSyncInProgress } from './syncEngine';
import { getSyncState, hasDataChanged, isSyncEnabled } from './syncState';
import { isOnline } from './networkMonitor';
import { SyncProgress, SyncResult } from './types';
import {
    loadInvoicesFromFiles,
    loadCustomersFromFiles,
    loadProductsFromFiles,
    loadCompanyInfoFromFile,
} from '../filesystem/fileSystemStorage';

const SYNC_INTERVAL_MS = 10000; // 10 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

let syncTimer: NodeJS.Timeout | null = null;
let retryCount = 0;
let isSchedulerRunning = false;
let lastSyncAttempt: Date | null = null;

// Callbacks
let onSyncStart: (() => void) | null = null;
let onSyncComplete: ((result: SyncResult) => void) | null = null;
let onSyncProgress: ((progress: SyncProgress) => void) | null = null;
let onSyncError: ((error: Error) => void) | null = null;

/**
 * Start the periodic sync scheduler
 */
export function startSyncScheduler(): void {
    if (isSchedulerRunning) {
        console.log('Sync scheduler already running');
        return;
    }

    console.log('Starting sync scheduler...');
    isSchedulerRunning = true;
    scheduleNextCheck();
}

/**
 * Stop the periodic sync scheduler
 */
export function stopSyncScheduler(): void {
    console.log('Stopping sync scheduler...');
    isSchedulerRunning = false;
    
    if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
    }
}

/**
 * Force an immediate sync check
 */
export async function triggerImmediateSync(): Promise<SyncResult | null> {
    if (!isSchedulerRunning) {
        console.log('Cannot trigger sync: scheduler not running');
        return null;
    }

    return await performSyncCheck();
}

/**
 * Schedule the next sync check
 */
function scheduleNextCheck(): void {
    if (!isSchedulerRunning) return;

    syncTimer = setTimeout(async () => {
        await performSyncCheck();
        scheduleNextCheck(); // Schedule next check after completion
    }, SYNC_INTERVAL_MS);
}

/**
 * Perform a sync check and sync if needed
 */
async function performSyncCheck(): Promise<SyncResult | null> {
    // Don't check if sync is already in progress
    if (isSyncInProgress()) {
        console.log('Sync already in progress, skipping check');
        return null;
    }

    // Don't sync if not enabled
    if (!isSyncEnabled()) {
        return null;
    }

    // Don't sync if offline
    if (!isOnline()) {
        return null;
    }

    // Check if data has changed
    try {
        const currentData = await loadCurrentData();
        const changed = hasDataChanged(currentData);

        if (!changed) {
            // No changes detected
            return null;
        }

        console.log('Changes detected, starting sync...');
        lastSyncAttempt = new Date();

        // Notify sync start
        onSyncStart?.();

        // Perform sync
        const result = await syncWithDrive(progress => {
            onSyncProgress?.(progress);
        });

        if (result.success) {
            retryCount = 0; // Reset retry count on success
            onSyncComplete?.(result);
            console.log('Sync completed successfully', result.stats);
        } else {
            handleSyncError(result.error);
        }

        return result;
    } catch (error) {
        handleSyncError(error as Error);
        return null;
    }
}

/**
 * Handle sync errors with retry logic
 */
function handleSyncError(error: Error | undefined): void {
    const err = error || new Error('Unknown sync error');
    console.error('Sync error:', err);
    onSyncError?.(err);

    retryCount++;

    if (retryCount < MAX_RETRY_ATTEMPTS) {
        console.log(`Will retry sync (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS}) in ${RETRY_DELAY_MS / 1000}s`);
        setTimeout(() => {
            if (isSchedulerRunning) {
                performSyncCheck();
            }
        }, RETRY_DELAY_MS);
    } else {
        console.error('Max retry attempts reached, will try again on next scheduled check');
        retryCount = 0; // Reset for next interval
    }
}

/**
 * Load current data for change detection
 */
async function loadCurrentData(): Promise<any> {
    try {
        const [invoices, customers, products, companyInfo] = await Promise.all([
            loadInvoicesFromFiles().catch(() => []),
            loadCustomersFromFiles().catch(() => []),
            loadProductsFromFiles().catch(() => []),
            loadCompanyInfoFromFile().catch(() => null),
        ]);

        return {
            invoices,
            customers,
            products,
            companyInfo,
        };
    } catch (error) {
        console.error('Error loading current data:', error);
        return {
            invoices: [],
            customers: [],
            products: [],
            companyInfo: null,
        };
    }
}

/**
 * Register callback for sync start
 */
export function onSyncStarted(callback: () => void): void {
    onSyncStart = callback;
}

/**
 * Register callback for sync completion
 */
export function onSyncCompleted(callback: (result: SyncResult) => void): void {
    onSyncComplete = callback;
}

/**
 * Register callback for sync progress
 */
export function onSyncProgressUpdate(callback: (progress: SyncProgress) => void): void {
    onSyncProgress = callback;
}

/**
 * Register callback for sync errors
 */
export function onSyncErrorOccurred(callback: (error: Error) => void): void {
    onSyncError = callback;
}

/**
 * Get scheduler status
 */
export function getSyncSchedulerStatus(): {
    isRunning: boolean;
    lastSyncAttempt: Date | null;
    retryCount: number;
} {
    return {
        isRunning: isSchedulerRunning,
        lastSyncAttempt,
        retryCount,
    };
}

/**
 * Check if scheduler is running
 */
export function isSyncSchedulerRunning(): boolean {
    return isSchedulerRunning;
}

