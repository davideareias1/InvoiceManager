"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';

const navigationItems = [
    { href: '/', label: 'Home' },
    { href: '/invoices', label: 'Invoices' },
    { href: '/invoices/new', label: 'Create Invoice' },
    { href: '/statistics', label: 'Statistics' },
    { href: '/settings', label: 'Settings' },
];

export function Navigation() {
    const pathname = usePathname();

    return (
        <nav className="border-b border-neutral-200 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="text-xl font-bold text-neutral-900">
                            InvoiceManager
                        </Link>
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
