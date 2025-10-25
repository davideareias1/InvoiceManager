"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { SyncStatusIndicator } from './sync/SyncStatusIndicator';
import { useGoogleDrive } from '../infrastructure/contexts/GoogleDriveContext';

const navigationItems = [
    { href: '/', label: 'Home' },
    { href: '/customers', label: 'Customers' },
    { href: '/invoices', label: 'Invoices' },
    { href: '/invoices/new', label: 'Create Invoice' },
    { href: '/time', label: 'Time' },
    { href: '/statistics', label: 'Statistics' },
    { href: '/settings', label: 'Settings' },
];

export function Navigation() {
    const pathname = usePathname();
    const { isSyncing, lastSyncTime, isOnline, syncError, isSyncEnabled } = useGoogleDrive();

    return (
        <nav className="border-b border-neutral-200 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="text-xl font-bold text-neutral-900">
                            InvoiceManager
                        </Link>
                        {isSyncEnabled && (
                            <SyncStatusIndicator
                                isSyncing={isSyncing}
                                lastSyncTime={lastSyncTime}
                                isOnline={isOnline}
                                syncError={syncError}
                            />
                        )}
                    </div>
                    <div className="flex items-center space-x-1">
                        {navigationItems.map((item) => (
                            <Link key={item.href} href={item.href} passHref>
                                <Button
                                    variant={pathname === item.href ? "default" : "ghost"}
                                    size="sm"
                                    className="text-sm"
                                >
                                    {item.label}
                                </Button>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
}
