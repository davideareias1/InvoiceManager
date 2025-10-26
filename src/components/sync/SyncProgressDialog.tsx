'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Progress } from '../ui/progress';
import { Loader2, Download, Upload, Merge, CheckCircle2 } from 'lucide-react';
import { SyncProgress } from '../../infrastructure/sync/types';

// ===== TYPES =====

interface SyncProgressDialogProps {
    isOpen: boolean;
    progress: SyncProgress | null;
}

// ===== COMPONENT =====

export function SyncProgressDialog({ isOpen, progress }: SyncProgressDialogProps) {
    if (!progress) {
        return null;
    }

    const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
    const { icon: Icon, color, label } = getStageDetails(progress.stage);

    return (
        <Dialog open={isOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Synchronizing Data</DialogTitle>
                    <DialogDescription>
                        Please wait while your data is synchronized with Google Drive
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${color}`} />
                        <div className="flex-1">
                            <p className="text-sm font-medium">{label}</p>
                            {progress.message && (
                                <p className="text-xs text-muted-foreground">{progress.message}</p>
                            )}
                        </div>
                    </div>

                    <Progress value={percentage} className="h-2" />

                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progress.current} of {progress.total}</span>
                        <span>{Math.round(percentage)}%</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ===== HELPERS =====

function getStageDetails(stage: SyncProgress['stage']) {
    switch (stage) {
        case 'pulling':
            return {
                icon: Download,
                color: 'text-blue-600 animate-pulse',
                label: 'Downloading from Drive',
            };
        case 'pushing':
            return {
                icon: Upload,
                color: 'text-blue-600 animate-pulse',
                label: 'Uploading to Drive',
            };
        case 'merging':
            return {
                icon: Merge,
                color: 'text-purple-600 animate-pulse',
                label: 'Merging data',
            };
        case 'complete':
            return {
                icon: CheckCircle2,
                color: 'text-green-600',
                label: 'Sync complete',
            };
        default:
            return {
                icon: Loader2,
                color: 'text-gray-600 animate-spin',
                label: 'Processing',
            };
    }
}

