'use client';

import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../ui/tooltip';
import { Badge } from '../ui/badge';

// ===== TYPES =====

interface SyncStatusIndicatorProps {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    isOnline: boolean;
    syncError: Error | null;
    className?: string;
}

// ===== COMPONENT =====

export function SyncStatusIndicator({
    isSyncing,
    lastSyncTime,
    isOnline,
    syncError,
    className,
}: SyncStatusIndicatorProps) {
    const [timeAgo, setTimeAgo] = useState<string>('');

    // ===== EFFECTS =====

    useEffect(() => {
        if (!lastSyncTime) {
            setTimeAgo('Never');
            return;
        }

        const updateTimeAgo = () => {
            const seconds = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000);
            
            if (seconds < 10) {
                setTimeAgo('Just now');
            } else if (seconds < 60) {
                setTimeAgo(`${seconds}s ago`);
            } else if (seconds < 3600) {
                setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
            } else if (seconds < 86400) {
                setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
            } else {
                setTimeAgo(`${Math.floor(seconds / 86400)}d ago`);
            }
        };

        updateTimeAgo();
        const interval = setInterval(updateTimeAgo, 10000); // Update every 10 seconds

        return () => clearInterval(interval);
    }, [lastSyncTime]);

    // ===== COMPUTED =====

    const status = getStatus(isSyncing, isOnline, syncError);
    const { icon: Icon, color, label, description } = getStatusDetails(status, timeAgo);

    // ===== RENDER =====

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={cn(
                            'flex items-center gap-1.5 cursor-default',
                            color,
                            className
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs">{label}</span>
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="text-sm">
                        <p className="font-medium">{description}</p>
                        {lastSyncTime && !isSyncing && (
                            <p className="text-muted-foreground text-xs mt-1">
                                Last synced: {timeAgo}
                            </p>
                        )}
                        {syncError && (
                            <p className="text-destructive text-xs mt-1">
                                Error: {syncError.message}
                            </p>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// ===== HELPERS =====

type SyncStatusType = 'syncing' | 'synced' | 'offline' | 'error' | 'idle';

function getStatus(
    isSyncing: boolean,
    isOnline: boolean,
    syncError: Error | null
): SyncStatusType {
    if (!isOnline) return 'offline';
    if (syncError) return 'error';
    if (isSyncing) return 'syncing';
    return 'synced';
}

function getStatusDetails(status: SyncStatusType, timeAgo: string) {
    switch (status) {
        case 'syncing':
            return {
                icon: Cloud,
                color: 'text-blue-600 border-blue-600',
                label: 'Syncing',
                description: 'Synchronizing with Google Drive...',
            };
        case 'synced':
            return {
                icon: CheckCircle2,
                color: 'text-green-600 border-green-600',
                label: 'Synced',
                description: 'All changes synchronized',
            };
        case 'offline':
            return {
                icon: CloudOff,
                color: 'text-gray-500 border-gray-500',
                label: 'Offline',
                description: 'Working offline (read-only mode)',
            };
        case 'error':
            return {
                icon: AlertCircle,
                color: 'text-destructive border-destructive',
                label: 'Error',
                description: 'Sync error occurred',
            };
        default:
            return {
                icon: Cloud,
                color: 'text-muted-foreground',
                label: 'Idle',
                description: 'Sync idle',
            };
    }
}

