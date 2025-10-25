export interface SyncProgress {
    current: number;
    total: number;
    stage: 'pulling' | 'pushing' | 'merging' | 'complete';
    message?: string;
}

export interface SyncResult {
    success: boolean;
    error?: Error;
    conflicts?: SyncConflict[];
    stats: {
        pulled: number;
        pushed: number;
        merged: number;
        conflicts: number;
    };
}

export interface SyncConflict {
    entityType: 'invoice' | 'customer' | 'product' | 'company' | 'timesheet' | 'taxSettings';
    entityId: string;
    localTimestamp: string;
    remoteTimestamp: string;
    resolution: 'local' | 'remote';
}

export interface SyncableData {
    invoices: any[];
    customers: any[];
    products: any[];
    companyInfo: any | null;
    timesheets: any[];
    taxSettings: any | null;
}

export interface SyncState {
    lastSyncTimestamp: string | null;
    lastDataHash: string | null;
    isPendingSync: boolean;
    syncEnabled: boolean;
    dataSourceSelected: boolean;
    dataSource: 'local' | 'drive' | 'merged' | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

export interface NetworkStatus {
    isOnline: boolean;
    lastChecked: Date;
}

