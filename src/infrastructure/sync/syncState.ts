'use client';

import md5 from 'blueimp-md5';
import { SyncState } from './types';

const SYNC_STATE_KEY = 'invoice-manager-sync-state';

/**
 * Get current sync state from localStorage
 */
export function getSyncState(): SyncState {
    if (typeof window === 'undefined') {
        return getDefaultSyncState();
    }

    try {
        const stored = localStorage.getItem(SYNC_STATE_KEY);
        if (!stored) {
            return getDefaultSyncState();
        }

        const parsed = JSON.parse(stored);
        return {
            ...getDefaultSyncState(),
            ...parsed,
        };
    } catch (error) {
        console.error('Error reading sync state:', error);
        return getDefaultSyncState();
    }
}

/**
 * Update sync state in localStorage
 */
export function updateSyncState(updates: Partial<SyncState>): SyncState {
    const current = getSyncState();
    const updated = { ...current, ...updates };

    try {
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Error saving sync state:', error);
    }

    return updated;
}

/**
 * Clear sync state (useful for troubleshooting or reset)
 */
export function clearSyncState(): void {
    try {
        localStorage.removeItem(SYNC_STATE_KEY);
    } catch (error) {
        console.error('Error clearing sync state:', error);
    }
}

/**
 * Compute hash of data for change detection
 */
export function computeDataHash(data: any): string {
    try {
        // Serialize and hash the data
        const serialized = JSON.stringify(data, Object.keys(data).sort());
        return md5(serialized);
    } catch (error) {
        console.error('Error computing data hash:', error);
        return '';
    }
}

/**
 * Check if data has changed since last sync
 */
export function hasDataChanged(currentData: any): boolean {
    const state = getSyncState();
    if (!state.lastDataHash) {
        return true; // No previous hash, consider it changed
    }

    const currentHash = computeDataHash(currentData);
    return currentHash !== state.lastDataHash;
}

/**
 * Update the last known data hash
 */
export function updateDataHash(data: any): void {
    const hash = computeDataHash(data);
    updateSyncState({ lastDataHash: hash });
}

/**
 * Mark sync as pending
 */
export function markSyncPending(): void {
    updateSyncState({ isPendingSync: true });
}

/**
 * Mark sync as complete
 */
export function markSyncComplete(): void {
    updateSyncState({
        isPendingSync: false,
        lastSyncTimestamp: new Date().toISOString(),
    });
}

/**
 * Check if sync is enabled
 */
export function isSyncEnabled(): boolean {
    return getSyncState().syncEnabled;
}

/**
 * Enable or disable sync
 */
export function setSyncEnabled(enabled: boolean): void {
    updateSyncState({ syncEnabled: enabled });
}

/**
 * Check if data source has been selected
 */
export function isDataSourceSelected(): boolean {
    return getSyncState().dataSourceSelected;
}

/**
 * Set data source selection
 */
export function setDataSource(source: 'local' | 'drive' | 'merged'): void {
    updateSyncState({
        dataSource: source,
        dataSourceSelected: true,
    });
}

/**
 * Get the selected data source
 */
export function getDataSource(): 'local' | 'drive' | 'merged' | null {
    return getSyncState().dataSource;
}

/**
 * Reset data source selection (useful for testing or account switching)
 */
export function resetDataSourceSelection(): void {
    updateSyncState({
        dataSource: null,
        dataSourceSelected: false,
    });
}

function getDefaultSyncState(): SyncState {
    return {
        lastSyncTimestamp: null,
        lastDataHash: null,
        isPendingSync: false,
        syncEnabled: false,
        dataSourceSelected: false,
        dataSource: null,
    };
}

