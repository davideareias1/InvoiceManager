'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Settings, BarChart2, CheckCircle, XCircle, ArrowUpRight, HardDrive, Shield, Home, Users, PieChart } from 'lucide-react';
import { useFileSystem } from '../contexts/FileSystemContext';
import { useCompany } from '../contexts/CompanyContext';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isThisMonth, isAfter, subMonths } from 'date-fns';
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Separator } from '@/components/ui/separator';

export default function HomePage() {
    const {
        isSupported,
        isInitialized,
        hasPermission,
        requestPermission,
        invoices,
        loadInvoices
    } = useFileSystem();

    const { companyInfo } = useCompany();

    const [isLoading, setIsLoading] = useState(true);

    // Reference to track if initial load is done
    const initialLoadDone = useRef(false);

    // Load invoices once when component mounts
    useEffect(() => {
        // Check if initialization is complete, then set loading to false
        if (isInitialized) {
            if (hasPermission) {
                loadInvoices()
                    .finally(() => setIsLoading(false));
            } else {
                setIsLoading(false);
            }
        }
    }, [isInitialized, hasPermission, loadInvoices]);

    // Calculate analytics data
    const analytics = useMemo(() => {
        if (!invoices || invoices.length === 0) {
            return {
                totalInvoices: 0,
                totalRevenue: 0,
                thisMonthInvoices: 0,
                thisMonthRevenue: 0,
                paidInvoices: 0,
                unpaidInvoices: 0,
                last3Months: [],
                statusData: []
            };
        }

        // Basic counts
        const paidInvoices = invoices.filter(inv => inv.is_paid).length;
        const unpaidInvoices = invoices.length - paidInvoices;
        const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);

        // This month
        const thisMonthInvoices = invoices.filter(inv => isThisMonth(parseISO(inv.invoice_date))).length;
        const thisMonthRevenue = invoices
            .filter(inv => isThisMonth(parseISO(inv.invoice_date)))
            .reduce((sum, inv) => sum + inv.total, 0);

        // Status data for pie chart
        const statusData = [
            { name: 'Paid', value: paidInvoices },
            { name: 'Unpaid', value: unpaidInvoices }
        ].filter(item => item.value > 0);

        // Last 3 months revenue data for bar chart
        const now = new Date();
        const monthNames = [];
        const monthlyRevenue = [];

        for (let i = 2; i >= 0; i--) {
            const monthDate = subMonths(now, i);
            const monthName = format(monthDate, 'MMM');
            monthNames.push(monthName);

            const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
            const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

            const monthRevenue = invoices
                .filter(inv => {
                    const invoiceDate = parseISO(inv.invoice_date);
                    return invoiceDate >= startOfMonth && invoiceDate <= endOfMonth;
                })
                .reduce((sum, inv) => sum + inv.total, 0);

            monthlyRevenue.push({
                name: monthName,
                revenue: monthRevenue
            });
        }

        return {
            totalInvoices: invoices.length,
            totalRevenue,
            thisMonthInvoices,
            thisMonthRevenue,
            paidInvoices,
            unpaidInvoices,
            last3Months: monthlyRevenue,
            statusData
        };
    }, [invoices]);

    // Format currency
    const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
    };

    // Colors for charts
    const COLORS = ['#16a34a', '#f43f5e', '#3b82f6', '#f97316'];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Welcome to E-Rechnung</h1>
                    <p className="text-muted-foreground">Modern invoice management for German businesses</p>
                </div>
                <Button asChild>
                    <Link href="/invoices">
                        <FileText className="mr-2 h-4 w-4" />
                        Manage Invoices
                    </Link>
                </Button>
            </div>

            {(!isSupported || !hasPermission) && (
                <Card className={`${!isSupported ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex gap-2 items-center">
                            <Shield className="h-5 w-5 text-amber-600" />
                            {!isSupported ? 'Browser Compatibility Issue' : 'Storage Access Required'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                        <p className="text-sm">
                            {!isSupported
                                ? "Your browser doesn't support the File System API. For the best experience, we recommend using Chrome or Microsoft Edge."
                                : "To manage your invoices, this app needs permission to access file storage."}
                        </p>
                    </CardContent>
                    {!isSupported ? null : (
                        <CardFooter className="pt-0">
                            <Button
                                onClick={requestPermission}
                                variant="secondary"
                                className="bg-amber-100 hover:bg-amber-200 text-amber-900"
                            >
                                Grant Access
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="group hover:border-primary/50 transition-colors cursor-pointer">
                    <Link href="/create-invoice" className="block p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="p-3 rounded-full bg-primary/10 text-primary mb-3">
                                <FileText className="h-6 w-6" />
                            </div>
                            <h3 className="font-medium mb-1 group-hover:text-primary transition-colors">Create Invoice</h3>
                            <p className="text-sm text-muted-foreground">Generate professional invoices or credit notes</p>
                        </div>
                    </Link>
                </Card>

                <Card className="group hover:border-primary/50 transition-colors cursor-pointer">
                    <Link href="/company" className="block p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mb-3">
                                <Settings className="h-6 w-6" />
                            </div>
                            <h3 className="font-medium mb-1 group-hover:text-primary transition-colors">Company Settings</h3>
                            <p className="text-sm text-muted-foreground">Manage your business details and preferences</p>
                        </div>
                    </Link>
                </Card>

                <Card className="group hover:border-primary/50 transition-colors cursor-pointer">
                    <Link href="/analytics" className="block p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 mb-3">
                                <BarChart2 className="h-6 w-6" />
                            </div>
                            <h3 className="font-medium mb-1 group-hover:text-primary transition-colors">Analytics</h3>
                            <p className="text-sm text-muted-foreground">View financial insights and reports</p>
                        </div>
                    </Link>
                </Card>
            </div>

            {/* System Status */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <HardDrive className="h-5 w-5 text-gray-500" />
                        System Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1 rounded-lg border p-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">File System API</span>
                                    <Badge variant={isSupported ? "outline" : "destructive"} className={`font-normal ${isSupported ? "bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800" : ""}`}>
                                        {isSupported ? 'Supported' : 'Not Supported'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-1 rounded-lg border p-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Storage Access</span>
                                    <Badge variant="outline" className={`font-normal ${hasPermission ? "bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800" : ""}`}>
                                        {hasPermission ? 'Granted' : 'Not Granted'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-1 rounded-lg border p-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Company Setup</span>
                                    <Link href="/company">
                                        <Badge variant="outline" className={`font-normal cursor-pointer ${companyInfo.name !== 'Your Company Name' ? "bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800" : ""}`}>
                                            {companyInfo.name !== 'Your Company Name' ? 'Complete' : 'Incomplete'}
                                        </Badge>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Analytics Overview */}
            {isInitialized && hasPermission && !isLoading && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-gray-500" />
                            Quick Analytics
                        </CardTitle>
                        <CardDescription>Overview of your invoicing activity</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-6">
                            {/* Key Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="border-none shadow-none bg-slate-50">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col items-center text-center">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Invoices</p>
                                            <p className="text-2xl font-bold">{analytics.totalInvoices}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-none bg-slate-50">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col items-center text-center">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">This Month</p>
                                            <p className="text-2xl font-bold">{analytics.thisMonthInvoices}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-none bg-slate-50">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col items-center text-center">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Paid</p>
                                            <div className="flex items-center gap-1">
                                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                                <p className="text-2xl font-bold">{analytics.paidInvoices}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-none bg-slate-50">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col items-center text-center">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Unpaid</p>
                                            <div className="flex items-center gap-1">
                                                <XCircle className="h-4 w-4 text-rose-500" />
                                                <p className="text-2xl font-bold">{analytics.unpaidInvoices}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Separator />

                            {/* Revenue Overview */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <Card className="md:col-span-2 border-none shadow-none bg-slate-50">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Revenue</p>
                                            <p className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                This month: {formatCurrency(analytics.thisMonthRevenue)}
                                            </p>
                                            <div className="mt-4">
                                                <Button variant="outline" size="sm" asChild className="w-full">
                                                    <Link href="/analytics" className="flex items-center justify-center">
                                                        <span>View Detailed Analytics</span>
                                                        <ArrowUpRight className="ml-2 h-3 w-3" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Invoice Status Chart */}
                                <div className="md:col-span-3">
                                    {analytics.last3Months.some(m => m.revenue > 0) ? (
                                        <div className="h-44">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={analytics.last3Months}>
                                                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                                                    <YAxis
                                                        tickFormatter={(value) =>
                                                            new Intl.NumberFormat('de-DE', {
                                                                style: 'currency',
                                                                currency: 'EUR',
                                                                notation: 'compact',
                                                                maximumFractionDigits: 1
                                                            }).format(value)
                                                        }
                                                        tickLine={false}
                                                        axisLine={false}
                                                    />
                                                    <Tooltip
                                                        formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                                                    />
                                                    <Bar
                                                        dataKey="revenue"
                                                        fill="#3b82f6"
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-44 bg-slate-50 rounded-lg">
                                            <p className="text-muted-foreground text-sm">No revenue data available</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
} 