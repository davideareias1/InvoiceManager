'use client';

import React, { useState, useEffect } from 'react';
import { InvoiceForm } from '../../components/InvoiceForm';
import { useFileSystem } from '../contexts/FileSystemContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { FileText, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CreateInvoicePage() {
    const { isSupported, hasPermission, requestPermission } = useFileSystem();
    const [permissionChecked, setPermissionChecked] = useState(false);

    // Check if permission is granted
    useEffect(() => {
        setPermissionChecked(true);
    }, [hasPermission]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Create Invoice</h1>
                    <p className="text-muted-foreground">Generate professional invoices that comply with German regulations</p>
                </div>
            </div>

            {isSupported && !hasPermission && permissionChecked && (
                <Alert variant="default" className="mb-4 bg-amber-50 border-amber-200 text-amber-800">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Storage access required</AlertTitle>
                    <AlertDescription className="flex justify-between items-center mt-1">
                        <span>Please grant permission to access file storage for saving your invoices.</span>
                        <Button
                            onClick={requestPermission}
                            variant="outline"
                            size="sm"
                            className="ml-4 h-8"
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            Grant Permission
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {!isSupported && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Browser not supported</AlertTitle>
                    <AlertDescription>
                        Your browser doesn't support the File System API. Please use a modern browser like Chrome or Edge.
                    </AlertDescription>
                </Alert>
            )}

            <Card className="border-t-4 border-t-primary">
                <CardHeader className="pb-3">
                    <CardTitle>Invoice Details</CardTitle>
                    <CardDescription>
                        Fill out the form below to create a new invoice
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                    <InvoiceForm />
                </CardContent>
            </Card>
        </div>
    );
} 