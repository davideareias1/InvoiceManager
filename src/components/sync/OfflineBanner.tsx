'use client';

import React from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { CloudOff, WifiOff } from 'lucide-react';

// ===== TYPES =====

interface OfflineBannerProps {
    isOnline: boolean;
    className?: string;
}

// ===== COMPONENT =====

export function OfflineBanner({ isOnline, className }: OfflineBannerProps) {
    if (isOnline) {
        return null;
    }

    return (
        <Alert variant="destructive" className={className}>
            <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4" />
                <AlertDescription className="flex-1">
                    <strong>You are offline.</strong> Working in read-only mode. Changes cannot be
                    saved until connection is restored.
                </AlertDescription>
            </div>
        </Alert>
    );
}

