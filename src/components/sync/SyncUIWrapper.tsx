'use client';

import React, { useState, useEffect } from 'react';
import { useGoogleDrive } from '../../infrastructure/contexts/GoogleDriveContext';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { SyncProgressDialog } from './SyncProgressDialog';
import { OfflineBanner } from './OfflineBanner';
import { DataSourceSelector } from './DataSourceSelector';
import { isDataSourceSelected } from '../../infrastructure/sync/syncState';

export function SyncUIWrapper({ children }: { children: React.ReactNode }) {
    const {
        isSyncing,
        isOnline,
        lastSyncTime,
        syncError,
        syncProgress,
        isAuthenticated,
    } = useGoogleDrive();

    const [showDataSourceSelector, setShowDataSourceSelector] = useState(false);
    const [dataSourceChecked, setDataSourceChecked] = useState(false);

    // Check if data source selection is needed on mount
    useEffect(() => {
        if (isAuthenticated && !dataSourceChecked) {
            const selected = isDataSourceSelected();
            setShowDataSourceSelector(!selected);
            setDataSourceChecked(true);
        }
    }, [isAuthenticated, dataSourceChecked]);

    const handleDataSourceSelected = (source: 'local' | 'drive' | 'merged') => {
        console.log('Data source selected:', source);
        setShowDataSourceSelector(false);
        // Reload the page to reflect the selected data
        window.location.reload();
    };

    return (
        <>
            {/* Offline Banner */}
            <OfflineBanner isOnline={isOnline} className="m-4" />

            {/* Main Content */}
            {children}

            {/* Data Source Selector Dialog */}
            {showDataSourceSelector && (
                <DataSourceSelector onDataSourceSelected={handleDataSourceSelected} />
            )}

            {/* Sync Progress Dialog */}
            <SyncProgressDialog 
                isOpen={isSyncing && syncProgress !== null} 
                progress={syncProgress} 
            />
        </>
    );
}

