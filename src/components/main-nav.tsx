'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FileText, BarChart2, Settings, Home } from 'lucide-react';

export function MainNav() {
    const pathname = usePathname();

    return (
        <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center space-x-2">
                {/* Logo and App Name */}
                <Link href="/" className="mr-6 flex items-center space-x-2">
                    <FileText className="h-6 w-6" />
                    <span className="hidden font-bold sm:inline-block">InvoiceManager</span>
                </Link>

                {/* Navigation Links */}
                <nav className="flex items-center space-x-1 text-sm font-medium">
                    <Link
                        href="/"
                        className={cn(
                            "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                            pathname === "/" && "bg-accent text-accent-foreground"
                        )}
                    >
                        <Home className="mr-2 h-4 w-4" />
                        <span>Home</span>
                    </Link>

                    <Link
                        href="/invoices"
                        className={cn(
                            "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                            pathname === "/invoices" || pathname.startsWith("/invoices/") ?
                                "bg-accent text-accent-foreground" : ""
                        )}
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Invoices</span>
                    </Link>

                    <Link
                        href="/analytics"
                        className={cn(
                            "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                            pathname === "/analytics" && "bg-accent text-accent-foreground"
                        )}
                    >
                        <BarChart2 className="mr-2 h-4 w-4" />
                        <span>Analytics</span>
                    </Link>

                    <Link
                        href="/company"
                        className={cn(
                            "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                            pathname === "/company" && "bg-accent text-accent-foreground"
                        )}
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </Link>
                </nav>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-2">
                <Button asChild variant="ghost" size="sm" className="mr-2">
                    <Link href="/create-invoice">
                        <FileText className="mr-2 h-4 w-4" />
                        <span>New Invoice</span>
                    </Link>
                </Button>
            </div>
        </div>
    );
} 