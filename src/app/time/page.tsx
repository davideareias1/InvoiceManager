"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { loadCustomers } from '@/infrastructure/repositories/customerRepository';
import type { CustomerData } from '@/domain/models';

export default function TimePage() {
    const { isInitialized, hasPermission } = useFileSystem();
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


    return (
        <div className="p-6 h-[calc(100vh-6rem)] overflow-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Customers</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {customers.map(c => (
                            <Link key={c.id} href={`/time/${encodeURIComponent(c.id)}`}>
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



