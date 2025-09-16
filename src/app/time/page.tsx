"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { loadCustomers } from '@/infrastructure/repositories/customerRepository';
import type { CustomerData } from '@/domain/models';

export default function TimePage() {
    const { isInitialized, hasPermission, requestPermission } = useFileSystem();
    const [customers, setCustomers] = useState<CustomerData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const run = async () => {
            if (!isInitialized || !hasPermission) return;
            setIsLoading(true);
            try {
                const list = await loadCustomers();
                setCustomers(list as unknown as CustomerData[]);
            } finally {
                setIsLoading(false);
            }
        };
        run();
    }, [isInitialized, hasPermission]);

    if (!isInitialized) return <div className="p-6">Loading…</div>;

    if (!hasPermission) {
        return (
            <div className="p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Time Tracking</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-sm text-neutral-600">Grant access to your InvoiceManager folder to load customers.</div>
                        <Button onClick={() => requestPermission()} disabled={isLoading}>Grant Folder Access</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Customers</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {customers.map(c => (
                            <Link key={c.id} href={`/time/${encodeURIComponent(c.id)}?name=${encodeURIComponent(c.name)}&rate=${encodeURIComponent(String(c.hourlyRate ?? ''))}`}>
                                <div className="border rounded-md p-3 hover:bg-neutral-50 cursor-pointer">
                                    <div className="font-medium">{c.name}</div>
                                    <div className="text-sm text-neutral-600">{c.city}</div>
                                </div>
                            </Link>
                        ))}
                        {!isLoading && customers.length === 0 && (
                            <div className="text-sm text-neutral-600">No customers found.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}



