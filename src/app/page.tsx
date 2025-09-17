"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFileSystem } from '../infrastructure/contexts/FileSystemContext';
import { useCompany } from '../infrastructure/contexts/CompanyContext';
import { FolderSelection } from '../components/FolderSelection';
import Link from 'next/link';
import { CheckCircle2, Folder } from 'lucide-react';

export default function HomePage() {
    const { isInitialized, hasPermission, loadInvoices, currentFolderName } = useFileSystem();
    const { loadAndSetCompanyInfo } = useCompany();

    // ===== EFFECTS =====
    useEffect(() => {
        if (isInitialized && hasPermission) {
            loadInvoices();
            loadAndSetCompanyInfo();
        }
    }, [isInitialized, hasPermission, loadInvoices, loadAndSetCompanyInfo]);

    // ===== RENDER =====
    
    // Gated globally in layout, so we can assume access here

    // Show recommendations when folder is selected
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-5xl mx-auto px-6 py-16">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-light text-black mb-4">Welcome back</h1>
                    <p className="text-xl text-gray-600">Choose what you'd like to work on</p>
                </div>

                {/* Action Grid */}
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Create Invoice */}
                    <Link href="/invoices/new">
                        <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-black bg-white">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-2xl font-light text-black group-hover:text-black transition-colors">
                                    Create Invoice
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-lg text-gray-600 leading-relaxed">
                                    Generate a new professional invoice for your clients
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Manage Invoices */}
                    <Link href="/invoices">
                        <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-black bg-white">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-2xl font-light text-black group-hover:text-black transition-colors">
                                    Manage Invoices
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-lg text-gray-600 leading-relaxed">
                                    View, edit, and organize all your invoices
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Track Time */}
                    <Link href="/time">
                        <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-black bg-white">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-2xl font-light text-black group-hover:text-black transition-colors">
                                    Track Time
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-lg text-gray-600 leading-relaxed">
                                    Log billable hours and manage project time
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* View Statistics */}
                    <Link href="/statistics">
                        <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 hover:border-black bg-white">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-2xl font-light text-black group-hover:text-black transition-colors">
                                    View Statistics
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-lg text-gray-600 leading-relaxed">
                                    Analyze revenue, taxes, and business performance
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                {/* Secondary Actions */}
                <div className="flex justify-center gap-8 mt-12">
                    <Link href="/settings">
                        <Button variant="outline" className="px-8 py-3 text-base font-light border-gray-300 hover:border-black hover:bg-black hover:text-white transition-all duration-300">
                            Settings
                        </Button>
                    </Link>
                    <Link href="/customers">
                        <Button variant="outline" className="px-8 py-3 text-base font-light border-gray-300 hover:border-black hover:bg-black hover:text-white transition-all duration-300">
                            Customers
                        </Button>
                    </Link>
                </div>

                {/* Footer */}
                <div className="text-center mt-16">
                    <p className="text-gray-500 font-light">
                        Everything you need to manage invoices professionally
                    </p>
                </div>
            </div>
            
            {/* Folder Status - only show when folder is selected */}
            {isInitialized && hasPermission && (
                <div className="fixed bottom-4 right-4">
                    <div className="bg-white border border-gray-200 rounded px-3 py-2 shadow-sm flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-xs text-gray-600 font-light">Folder Connected</span>
                        <FolderSelection isDialog={true}>
                            <button className="text-xs text-gray-400 hover:text-gray-600 font-light">
                                Change
                            </button>
                        </FolderSelection>
                    </div>
                </div>
            )}
        </div>
    );
}

