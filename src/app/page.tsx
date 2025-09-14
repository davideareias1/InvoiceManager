"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFileSystem } from '../infrastructure/contexts/FileSystemContext';
import { isFileSystemAccessSupported } from '../infrastructure/filesystem/fileSystemStorage';
import { useCompany } from '../infrastructure/contexts/CompanyContext';
import { invoiceRepositoryAdapter } from '../infrastructure/repositories/invoiceRepository';
import { CreateInvoice, ListInvoices } from '../application/usecases';

export default function HomePage() {
    const { isInitialized, hasPermission, requestPermission, loadInvoices } = useFileSystem();
    const [isFSA, setIsFSA] = useState(false);
    const { companyInfo, loadAndSetCompanyInfo } = useCompany();

    // Update FSA support after component mounts
    useEffect(() => {
        setIsFSA(isFileSystemAccessSupported());
    }, []);

    useEffect(() => {
        if (isInitialized && hasPermission) {
            loadInvoices();
            loadAndSetCompanyInfo();
        }
    }, [isInitialized, hasPermission, loadInvoices, loadAndSetCompanyInfo]);

    const handleGrantAccess = async () => {
        await requestPermission();
    };

    const handleQuickInvoice = async () => {
        const create = new CreateInvoice(invoiceRepositoryAdapter);
        await create.execute({
            issuer: companyInfo as any,
            invoice_date: new Date().toISOString().slice(0, 10),
            items: [],
            total: 0,
            customer: {
                id: 'draft', name: 'Draft', address: '', city: '', lastModified: new Date().toISOString()
            } as any,
            bank_details: {
                name: companyInfo?.bank_name || '', iban: companyInfo?.iban || '', bic: companyInfo?.swift_bic || ''
            } as any,
        });
    };

    return (
        <div className="p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>InvoiceManager</CardTitle>
                    <CardDescription>Minimal, action-first interface.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {!hasPermission ? (
                        <div className="flex flex-col gap-2">
                            <Button onClick={handleGrantAccess} disabled={!isFSA}>
                                {isFSA ? 'Grant Folder Access' : 'Folder Access Not Supported'}
                            </Button>
                            {!isFSA && (
                                <p className="text-sm text-neutral-600">
                                    Your browser does not support selecting a local folder. On Firefox, this feature is unavailable.
                                    You can still download PDFs, or use a Chromium-based browser (Chrome, Edge, Brave) to enable folder access.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <Button onClick={handleQuickInvoice}>New Invoice</Button>
                            <Button variant="outline" onClick={() => new ListInvoices(invoiceRepositoryAdapter).execute()}>Refresh Invoices</Button>
                        </div>
                    )}
                    <div className="flex gap-2 items-center">
                        <Input placeholder="Search (coming soon)" />
                        <Button variant="outline">Search</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

