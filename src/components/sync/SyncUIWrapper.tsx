'use client';

import React from 'react';
import { useGoogleDrive } from '../../infrastructure/contexts/GoogleDriveContext';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { OfflineBanner } from './OfflineBanner';

export function SyncUIWrapper({ children }: { children: React.ReactNode }) {
    const { isOnline } = useGoogleDrive();

    return (
        <>
            {/* Offline Banner */}
            <OfflineBanner isOnline={isOnline} className="m-4" />

            {/* Main Content */}
            {children}

            {/* Sync progress dialog removed */}
        </>
    );
}

