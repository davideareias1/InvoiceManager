'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useFileSystem } from '../../contexts/FileSystemContext';
import { Invoice } from '../../interfaces';
import { format, subMonths, isAfter, parseISO } from 'date-fns';

import { Clock, FolderOpen, BarChart2, PieChart, LayoutGrid, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess } from '../../utils/notifications';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function AnalyticsPage() {
    const { invoices, isLoading, loadInvoices } = useFileSystem();
    const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('all');
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [autoRefreshDisabled, setAutoRefreshDisabled] = useState(false);
    const [activeView, setActiveView] = useState<'overview' | 'revenue' | 'customers'>('overview');

    // Reference to track if initial load is done
    const initialLoadDone = useRef(false);

    // Load invoices function extracted for reuse
    const loadInvoicesData = useCallback(async (showLoadingState = true) => {
        try {
            await loadInvoices();
            setLastRefreshed(new Date());
        } catch (error) {
            console.error("Error loading invoices:", error);
        }
    }, [loadInvoices]);

    // Initial load
    useEffect(() => {
        if (!initialLoadDone.current) {
            initialLoadDone.current = true;
            loadInvoicesData();
        }
    }, [loadInvoicesData]);

    // Function to check if auto refresh is allowed (once per minute)
    const shouldAutoRefresh = useCallback(() => {
        if (autoRefreshDisabled || !lastRefreshed) return false;

        // Only auto-refresh at most once per minute
        const now = new Date();
        const timeSinceLastRefresh = now.getTime() - lastRefreshed.getTime();
        const ONE_MINUTE = 60 * 1000;

        return timeSinceLastRefresh > ONE_MINUTE;
    }, [lastRefreshed, autoRefreshDisabled]);

    // Auto-refresh effect
    useEffect(() => {
        // Set up an interval to check if we should refresh
        const interval = setInterval(() => {
            if (shouldAutoRefresh()) {
                loadInvoicesData(false); // Silent refresh without loading indicator
            }
        }, 10000); // Check every 10 seconds, but only refresh if it's been 60 seconds

        return () => clearInterval(interval);
    }, [loadInvoicesData, shouldAutoRefresh]);

    // Handle manual refresh
    const handleRefresh = async () => {
        await loadInvoicesData();
        showSuccess("Analytics data refreshed");
    };

    // Toggle auto-refresh
    const toggleAutoRefresh = () => {
        setAutoRefreshDisabled(!autoRefreshDisabled);
        showSuccess(`Auto-refresh ${autoRefreshDisabled ? 'enabled' : 'disabled'}`);
    };

    // Format timestamp
    const formatRefreshTime = () => {
        if (!lastRefreshed) return 'Never';
        return format(lastRefreshed, 'HH:mm:ss');
    };

    // Format currency
    const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
    };

    // Filter invoices by time range
    const filteredInvoices = useMemo(() => {
        if (timeRange === 'all') return invoices;

        const now = new Date();
        let filterDate: Date; // Explicitly typed as Date

        if (timeRange === '3m') filterDate = subMonths(now, 3);
        else if (timeRange === '6m') filterDate = subMonths(now, 6);
        else filterDate = subMonths(now, 12); // '1y' case

        return invoices.filter(invoice => {
            const invoiceDate = parseISO(invoice.invoice_date);
            return isAfter(invoiceDate, filterDate);
        });
    }, [invoices, timeRange]);

    // 1. Monthly Revenue Data
    const monthlyRevenueData = useMemo(() => {
        const monthlyData: Record<string, number> = {};

        // Get the last 12 months (including current month)
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const date = subMonths(now, i);
            const monthYear = format(date, 'MMM yyyy');
            monthlyData[monthYear] = 0;
        }

        // Add invoice totals to their respective months
        filteredInvoices.forEach(invoice => {
            const date = parseISO(invoice.invoice_date);
            const monthYear = format(date, 'MMM yyyy');

            // Only count months we're showing in our chart
            if (monthlyData[monthYear] !== undefined) {
                monthlyData[monthYear] += invoice.total;
            }
        });

        // Convert to array format for Recharts
        return Object.entries(monthlyData)
            .map(([month, amount]) => ({ month, amount }))
            .reverse(); // Show oldest to newest
    }, [filteredInvoices]);

    // 2. Top Customers Data
    const customerData = useMemo(() => {
        const customerTotals: Record<string, number> = {};

        // Sum up invoices by customer
        filteredInvoices.forEach(invoice => {
            const customerName = invoice.customer.name;
            if (!customerTotals[customerName]) {
                customerTotals[customerName] = 0;
            }
            customerTotals[customerName] += invoice.total;
        });

        // Sort by total amount and take top 5
        return Object.entries(customerTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));
    }, [filteredInvoices]);

    // 3. Invoice Status Distribution
    const statusData = useMemo(() => {
        const statusCounts: Record<string, number> = {
            'paid': 0,
            'unpaid': 0,
            'overdue': 0,
            'draft': 0,
            'cancelled': 0
        };

        // Count invoices by status
        filteredInvoices.forEach(invoice => {
            const status = invoice.status?.toLowerCase() || (invoice.is_paid ? 'paid' : 'unpaid');
            if (statusCounts[status] !== undefined) {
                statusCounts[status]++;
            } else {
                // For any other statuses not in our predefined list
                statusCounts['unpaid']++;
            }
        });

        // Convert to array format for Recharts
        return Object.entries(statusCounts)
            .filter(([_, count]) => count > 0) // Only include statuses with invoices
            .map(([name, value]) => ({ name, value }));
    }, [filteredInvoices]);

    // 4. Popular Products
    const productData = useMemo(() => {
        const productCounts: Record<string, { count: number, revenue: number }> = {};

        // Count products and sum revenue
        filteredInvoices.forEach(invoice => {
            invoice.items.forEach(item => {
                const productName = item.name;
                if (!productCounts[productName]) {
                    productCounts[productName] = { count: 0, revenue: 0 };
                }
                productCounts[productName].count += item.quantity;
                productCounts[productName].revenue += item.quantity * item.price;
            });
        });

        // Sort by count and take top 5
        return Object.entries(productCounts)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([name, data]) => ({
                name,
                count: data.count,
                revenue: data.revenue
            }));
    }, [filteredInvoices]);

    // Colors for charts
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#EC7063'];

    // Loading state
    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">Analytics & Insights</h1>
                <div className="flex justify-center items-center h-64">
                    <p className="text-lg text-gray-500">Loading data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Analytics & Insights</h1>
                    <p className="text-muted-foreground">Get valuable insights about your invoices and financial data</p>
                    {lastRefreshed && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Last refreshed: {formatRefreshTime()}
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={toggleAutoRefresh}
                        className="flex items-center"
                        size="sm"
                    >
                        <Clock className={`mr-2 h-4 w-4 ${autoRefreshDisabled ? 'text-red-500' : 'text-green-500'}`} />
                        {autoRefreshDisabled ? 'Auto-refresh off' : 'Auto-refresh on'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="flex items-center"
                        size="sm"
                    >
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Refresh Data
                    </Button>
                </div>
            </div>

            {/* Tabs & Filters */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-start">
                <Card className="md:col-span-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Analytics Views</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                        <Tabs
                            value={activeView}
                            onValueChange={(value) => setActiveView(value as 'overview' | 'revenue' | 'customers')}
                            className="w-full"
                        >
                            <TabsList className="grid grid-cols-3 mb-2">
                                <TabsTrigger value="overview" className="flex items-center gap-2">
                                    <LayoutGrid className="h-4 w-4" />
                                    <span>Overview</span>
                                </TabsTrigger>
                                <TabsTrigger value="revenue" className="flex items-center gap-2">
                                    <BarChart2 className="h-4 w-4" />
                                    <span>Revenue</span>
                                </TabsTrigger>
                                <TabsTrigger value="customers" className="flex items-center gap-2">
                                    <PieChart className="h-4 w-4" />
                                    <span>Customers</span>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </CardContent>
                </Card>

                <Card className="md:col-span-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Filter className="h-4 w-4 text-gray-500" />
                            Time Period
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                onClick={() => setTimeRange('3m')}
                                variant={timeRange === '3m' ? 'default' : 'outline'}
                                size="sm"
                            >
                                3 Months
                            </Button>
                            <Button
                                onClick={() => setTimeRange('6m')}
                                variant={timeRange === '6m' ? 'default' : 'outline'}
                                size="sm"
                            >
                                6 Months
                            </Button>
                            <Button
                                onClick={() => setTimeRange('1y')}
                                variant={timeRange === '1y' ? 'default' : 'outline'}
                                size="sm"
                            >
                                1 Year
                            </Button>
                            <Button
                                onClick={() => setTimeRange('all')}
                                variant={timeRange === 'all' ? 'default' : 'outline'}
                                size="sm"
                            >
                                All Time
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Analytics Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="text-2xl font-bold mb-1">
                                {filteredInvoices.length}
                            </div>
                            <p className="text-sm text-muted-foreground">Total Invoices</p>
                            <Separator className="my-3" />
                            <div className="flex justify-center gap-4 w-full">
                                <div className="flex flex-col items-center">
                                    <Badge className="mb-1 bg-green-100 text-green-800 hover:bg-green-100">
                                        {filteredInvoices.filter(inv => inv.is_paid).length}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">Paid</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <Badge className="mb-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                                        {filteredInvoices.filter(inv => !inv.is_paid).length}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">Unpaid</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="text-2xl font-bold mb-1">
                                {formatCurrency(
                                    filteredInvoices.reduce((sum, invoice) => sum + invoice.total, 0)
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">Total Revenue</p>
                            <Separator className="my-3" />
                            <div className="flex justify-center gap-4 w-full">
                                <div className="flex flex-col items-center">
                                    <Badge className="mb-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
                                        {filteredInvoices.length > 0
                                            ? formatCurrency(
                                                filteredInvoices.reduce((sum, invoice) => sum + invoice.total, 0) /
                                                filteredInvoices.length
                                            )
                                            : "€0,00"
                                        }
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">Avg. Value</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <Badge className="mb-1 bg-purple-100 text-purple-800 hover:bg-purple-100">
                                        {formatCurrency(
                                            Math.max(...filteredInvoices.map(invoice => invoice.total), 0)
                                        )}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">Max Value</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="text-2xl font-bold mb-1">
                                {new Set(filteredInvoices.map(inv => inv.customer.name)).size}
                            </div>
                            <p className="text-sm text-muted-foreground">Unique Customers</p>
                            <Separator className="my-3" />
                            <div className="flex justify-center gap-4 w-full">
                                <div className="flex flex-col items-center">
                                    <Badge className="mb-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-100">
                                        {filteredInvoices.length > 0
                                            ? (filteredInvoices.reduce((sum, invoice) => sum + invoice.items.length, 0) / filteredInvoices.length).toFixed(1)
                                            : "0"
                                        }
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">Avg. Items</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <Badge className="mb-1 bg-teal-100 text-teal-800 hover:bg-teal-100">
                                        {Object.entries(
                                            filteredInvoices.reduce((acc, inv) => {
                                                inv.items.forEach(item => {
                                                    acc[item.name] = (acc[item.name] || 0) + item.quantity;
                                                });
                                                return acc;
                                            }, {} as Record<string, number>)
                                        ).sort((a, b) => b[1] - a[1])[0]?.[0]?.slice(0, 6) || "None"}...
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">Top Item</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Visualization Content that changes based on activeView */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>
                        {activeView === 'overview' ? 'Dashboard Overview' :
                            activeView === 'revenue' ? 'Revenue Analysis' : 'Customer Analysis'}
                    </CardTitle>
                    <CardDescription>
                        {activeView === 'overview' ? 'Key metrics and trends at a glance' :
                            activeView === 'revenue' ? 'Detailed revenue breakdown over time' : 'Customer spending patterns and distribution'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {activeView === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Monthly Revenue Chart */}
                            <div className="h-[300px]">
                                <h3 className="text-sm font-medium mb-2">Monthly Revenue</h3>
                                {monthlyRevenueData.some(m => m.amount > 0) ? (
                                    <ResponsiveContainer width="100%" height="90%">
                                        <BarChart data={monthlyRevenueData}>
                                            <XAxis dataKey="month" tickLine={false} axisLine={false} />
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
                                                dataKey="amount"
                                                fill="#3b82f6"
                                                radius={[4, 4, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[250px] bg-slate-50 rounded-lg">
                                        <p className="text-muted-foreground text-sm">No revenue data available</p>
                                    </div>
                                )}
                            </div>

                            {/* Invoice Status Chart */}
                            <div className="h-[300px]">
                                <h3 className="text-sm font-medium mb-2">Invoice Status</h3>
                                {statusData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="90%">
                                        <RechartsPieChart>
                                            <Pie
                                                data={statusData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {statusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: any) => [`${value} invoices`]} />
                                        </RechartsPieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[250px] bg-slate-50 rounded-lg">
                                        <p className="text-muted-foreground text-sm">No status data available</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeView === 'revenue' && (
                        <div className="space-y-6">
                            {/* Revenue Over Time Chart - Full Width */}
                            <div className="h-[400px]">
                                <h3 className="text-sm font-medium mb-2">Revenue Trend</h3>
                                {monthlyRevenueData.some(m => m.amount > 0) ? (
                                    <ResponsiveContainer width="100%" height="90%">
                                        <BarChart data={monthlyRevenueData}>
                                            <XAxis dataKey="month" tickLine={false} axisLine={false} />
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
                                                dataKey="amount"
                                                fill="#3b82f6"
                                                radius={[4, 4, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[350px] bg-slate-50 rounded-lg">
                                        <p className="text-muted-foreground text-sm">No revenue data available</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeView === 'customers' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top Customers Chart */}
                            <div className="h-[350px]">
                                <h3 className="text-sm font-medium mb-2">Top Customers by Revenue</h3>
                                {customerData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="90%">
                                        <RechartsPieChart>
                                            <Pie
                                                data={customerData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                                label={({ name, percent }) => `${name.slice(0, 12)}${name.length > 12 ? '...' : ''}: ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {customerData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: any) => [formatCurrency(value), 'Revenue']} />
                                        </RechartsPieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] bg-slate-50 rounded-lg">
                                        <p className="text-muted-foreground text-sm">No customer data available</p>
                                    </div>
                                )}
                            </div>

                            {/* Popular Products Chart */}
                            <div className="h-[350px]">
                                <h3 className="text-sm font-medium mb-2">Top Products by Quantity</h3>
                                {productData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="90%">
                                        <BarChart
                                            layout="vertical"
                                            data={productData.slice(0, 5)}
                                            margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                                        >
                                            <XAxis type="number" tickLine={false} axisLine={false} />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                tickLine={false}
                                                axisLine={false}
                                                width={120}
                                                tick={props => {
                                                    const { x, y, payload } = props;
                                                    const name = payload.value as string;
                                                    const displayName = name.length > 15 ? `${name.slice(0, 15)}...` : name;
                                                    return (
                                                        <text x={x} y={y} dy={3} textAnchor="end" fill="#666" fontSize={12}>
                                                            {displayName}
                                                        </text>
                                                    );
                                                }}
                                            />
                                            <Tooltip formatter={(value: any) => [`${value} units`]} />
                                            <Bar dataKey="count" fill="#16a34a" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] bg-slate-50 rounded-lg">
                                        <p className="text-muted-foreground text-sm">No product data available</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 