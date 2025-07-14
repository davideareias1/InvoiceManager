'use client';

import React, { useState, useEffect } from 'react';
import { InvoiceForm } from '../../components/InvoiceForm';
import { useFileSystem } from '../../contexts/FileSystemContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
    FileText, ShieldAlert, AlertTriangle, ArrowLeft, 
    Save, PlusCircle, Receipt, HardDrive, Download, CheckCircle 
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default function CreateInvoicePage() {
    const { isSupported, hasPermission, requestPermission, resetDirectoryAccess } = useFileSystem();
    const [permissionChecked, setPermissionChecked] = useState(false);

    // Check if permission is granted
    useEffect(() => {
        setPermissionChecked(true);
    }, [hasPermission]);

    return (
        <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Page Header with Back Button */}
                <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center mb-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Link 
                                href="/invoices" 
                                className="inline-flex items-center justify-center text-sm font-medium transition-colors bg-white hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-md"
                            >
                                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                                Back to Invoices
                            </Link>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create New Invoice</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Generate professional invoices that comply with German regulations
                        </p>
                    </div>
                    <div className="flex items-center gap-2 self-stretch md:self-auto">
                        <Button 
                            form="invoice-form" 
                            type="submit" 
                            variant="outline"
                            className="h-9 text-sm border-gray-200 hover:border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                        >
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Save Draft
                        </Button>
                        <Button 
                            form="invoice-form" 
                            type="submit" 
                            className="h-9 text-sm bg-primary hover:bg-primary/90"
                        >
                            <Receipt className="mr-1.5 h-3.5 w-3.5" />
                            Create & Download
                        </Button>
                    </div>
                </div>

                {/* Permission Alerts - Improved styling */}
                {isSupported && !hasPermission && permissionChecked && (
                    <Alert variant="default" className="mb-4 bg-amber-50 border-amber-200 text-amber-800">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Storage Access Required</AlertTitle>
                        <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
                            <span>You need to grant file storage access to save invoices</span>
                            <Button
                                onClick={requestPermission}
                                variant="secondary"
                                size="sm"
                                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-none"
                            >
                                <HardDrive className="mr-2 h-4 w-4" />
                                Grant Access
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {isSupported && hasPermission && permissionChecked && (
                    <Alert variant="default" className="mb-4 bg-green-50 border-green-200 text-green-800">
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Storage Access Granted</AlertTitle>
                        <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
                            <span>Ready to create and save invoices. You can change the folder location if needed.</span>
                            <Button
                                onClick={async () => {
                                    try {
                                        await resetDirectoryAccess();
                                        await requestPermission();
                                    } catch (error) {
                                        console.error('Error changing folder:', error);
                                    }
                                }}
                                variant="outline"
                                size="sm"
                                className="bg-green-100 hover:bg-green-200 text-green-900 border-green-300"
                            >
                                <HardDrive className="mr-2 h-4 w-4" />
                                Change Folder
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {!isSupported && (
                    <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Browser Compatibility Issue</AlertTitle>
                        <AlertDescription>
                            Your browser doesn't support the File System API needed to save invoices. Please use Chrome or Edge for full functionality.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Main form card with modern styling */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="border-b border-gray-100 p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-medium text-gray-900">Invoice Details</h2>
                                <p className="text-sm text-gray-600">
                                    Complete the form below to create a new invoice
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        {/* The InvoiceForm component will be rendered here */}
                        <InvoiceForm />
                    </div>
                    
                    <div className="bg-gray-50 border-t border-gray-100 p-5">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-sm text-gray-600">
                                All fields marked with an asterisk (*) are required
                            </div>
                            <div className="flex items-center gap-3">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    asChild
                                    className="border-gray-200 h-9 text-sm"
                                >
                                    <Link href="/invoices">
                                        Cancel
                                    </Link>
                                </Button>
                                <Button 
                                    form="invoice-form" 
                                    type="submit" 
                                    className="h-9 text-sm"
                                >
                                    <Receipt className="mr-1.5 h-3.5 w-3.5" />
                                    Create Invoice
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Quick Tips Section */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-5">
                    <h3 className="text-sm font-medium text-blue-800 mb-3">Invoice Creation Tips</h3>
                    <ul className="space-y-2 text-sm text-blue-700">
                        <li className="flex items-start gap-2">
                            <span className="bg-blue-100 text-blue-600 rounded-full p-1 mt-0.5">
                                <PlusCircle className="h-3 w-3" />
                            </span>
                            <span>You can add multiple items to your invoice using the "Add Item" button</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="bg-blue-100 text-blue-600 rounded-full p-1 mt-0.5">
                                <Download className="h-3 w-3" />
                            </span>
                            <span>After creating an invoice, you'll have the option to download it as a PDF</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="bg-blue-100 text-blue-600 rounded-full p-1 mt-0.5">
                                <HardDrive className="h-3 w-3" />
                            </span>
                            <span>All invoices are stored locally on your device and can be accessed offline</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
} 