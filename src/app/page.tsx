'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    FileText, Settings, BarChart2, CheckCircle, XCircle, ArrowUpRight,
    HardDrive, Cloud, RefreshCw, AlertTriangle, PieChart, Database, LayoutDashboard, HelpCircle, FileX
} from 'lucide-react';
import { useFileSystem } from '../contexts/FileSystemContext';
import { useCompany } from '../contexts/CompanyContext';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';
import { isGoogleDriveAuthenticated } from '../utils/googleDriveStorage';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isThisMonth, subMonths } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { showSuccess, showError } from '../utils/notifications';

// Helper component for status display
const StatusIndicator = ({ status, text, icon: Icon }: { status: 'success' | 'warning' | 'error' | 'info' | 'loading', text: string, icon?: React.ElementType }) => {
    const baseClasses = "text-xs font-medium px-2.5 py-0.5 rounded-full inline-flex items-center gap-1";
    const statusClasses = {
        success: "bg-green-100 text-green-800",
        warning: "bg-amber-100 text-amber-800",
        error: "bg-red-100 text-red-800",
        info: "bg-blue-100 text-blue-800",
        loading: "bg-gray-100 text-gray-800 animate-pulse"
    };
    const DefaultIcon = status === 'success' ? CheckCircle : status === 'warning' ? AlertTriangle : status === 'error' ? XCircle : RefreshCw;
    const FinalIcon = Icon || DefaultIcon;

    return (
        <span className={`${baseClasses} ${statusClasses[status]}`}>
            <FinalIcon className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
            {text}
        </span>
    );
};

// Helper component for loading sections
const SectionSkeleton = ({ count = 3 }: { count?: number }) => (
    <div className="space-y-3">
        {[...Array(count)].map((_, i) => (
            <Skeleton key={i} className={`h-4 w-${i === 0 ? 'full' : i === 1 ? '5/6' : '4/6'}`} />
        ))}
    </div>
);

export default function HomePage() {
    const {
        isSupported,
        isInitialized: isFileSystemInitialized,
        hasPermission,
        requestPermission,
        resetDirectoryAccess,
        invoices,
        loadInvoices
    } = useFileSystem();

    const {
        isSupported: isDriveSupported,
        isInitialized: isDriveInitialized,
        isAuthenticated: isDriveAuthenticated,
        isLoading: isDriveLoading,
        connectionStatusMessage: driveConnectionStatus,
        isBackupEnabled,
        setIsBackupEnabled,
        requestPermission: requestDrivePermission,
        signOut: signOutDrive,
        backup,
        syncProgress
    } = useGoogleDrive();

    const { companyInfo } = useCompany();

    const [isFileSystemLoading, setIsFileSystemLoading] = useState(true);
    const [isFileSystemRequesting, setIsFileSystemRequesting] = useState(false);
    const [isDriveConnecting, setIsDriveConnecting] = useState(true); // Controls the initial Drive connection state visual

    // Determine overall loading state
    const isPageLoading = isFileSystemLoading || isDriveConnecting;

    // Load invoices once file system is ready
    useEffect(() => {
        if (isFileSystemInitialized) {
            if (hasPermission) {
                loadInvoices().finally(() => setIsFileSystemLoading(false));
            } else {
                setIsFileSystemLoading(false); // Not loading invoices, just ready
            }
        }
    }, [isFileSystemInitialized, hasPermission, loadInvoices]);

    // Manage Google Drive connection state visual
    useEffect(() => {
        // Show connecting state only when actually loading/initializing
        if (isDriveLoading || !isDriveInitialized) {
            setIsDriveConnecting(true);
        } else {
            setIsDriveConnecting(false);
        }
    }, [isDriveInitialized, isDriveLoading]);

    // Calculate analytics data
    const analytics = useMemo(() => {
        if (isFileSystemLoading || !invoices || invoices.length === 0) {
            return {
                totalInvoices: 0,
                totalRevenue: 0,
                thisMonthInvoices: 0,
                thisMonthRevenue: 0,
                paidInvoices: 0,
                unpaidInvoices: 0,
                last3Months: Array(3).fill({ name: '...', revenue: 0 }),
                statusData: [],
                hasData: false
            };
        }

        // Calculate paid invoices (excluding rectified ones)
        const paidInvoices = invoices.filter(inv => inv.is_paid && !inv.isRectified).length;
        
        // Calculate unpaid invoices (excluding rectified and storno invoices)
        const unpaidInvoices = invoices.filter(inv => !inv.is_paid && !inv.isRectified).length;
        
        // Count rectified invoices separately
        const rectifiedInvoices = invoices.filter(inv => inv.isRectified).length;
        const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const thisMonthInvoices = invoices.filter(inv => isThisMonth(parseISO(inv.invoice_date))).length;
        const thisMonthRevenue = invoices
            .filter(inv => isThisMonth(parseISO(inv.invoice_date)))
            .reduce((sum, inv) => sum + inv.total, 0);

        const statusData = [
            { name: 'Paid', value: paidInvoices },
            { name: 'Unpaid', value: unpaidInvoices },
            { name: 'Rectified', value: rectifiedInvoices }
        ].filter(item => item.value > 0);

        const now = new Date();
        const monthlyRevenue = Array.from({ length: 3 }).map((_, i) => {
            const monthDate = subMonths(now, 2 - i); // Iterate 0, 1, 2 months ago
            const monthName = format(monthDate, 'MMM');
            const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
            const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

            const revenue = invoices
                .filter(inv => {
                    const invoiceDate = parseISO(inv.invoice_date);
                    return invoiceDate >= startOfMonth && invoiceDate <= endOfMonth;
                })
                .reduce((sum, inv) => sum + inv.total, 0);

            return { name: monthName, revenue: revenue };
        });

        return {
            totalInvoices: invoices.length,
            totalRevenue,
            thisMonthInvoices,
            thisMonthRevenue,
            paidInvoices,
            unpaidInvoices,
            rectifiedInvoices,
            last3Months: monthlyRevenue,
            statusData,
            hasData: invoices.length > 0
        };
    }, [invoices, isFileSystemLoading]);

    const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
    };

    const handleBackupFiles = async () => {
        if (!isDriveAuthenticated || !isBackupEnabled || syncProgress != null) return;
        try {
            await backup();
            showSuccess(`Backup to Google Drive complete.`);
            // After sync, we might want to reload local data to reflect changes
            if (hasPermission) {
                await loadInvoices();
            }
        } catch (error) {
            console.error('Error backing up files:', error);
            showError('Error backing up files.');
        }
    };

    const handleToggleBackup = async (enabled: boolean) => {
        if (enabled && !isDriveAuthenticated) {
            // Need to authenticate first
            setIsDriveConnecting(true);
            try {
                await requestDrivePermission();
                // The context automatically enables backup after successful auth
                showSuccess('Google Drive connected and backup enabled.');
            } catch (error) {
                console.error('Failed to connect to Google Drive:', error);
                showError('Failed to connect to Google Drive. Please try again.');
            } finally {
                setIsDriveConnecting(false);
            }
        } else {
            // Just toggle the backup setting
            setIsBackupEnabled(enabled);
            if (enabled) {
                showSuccess('Google Drive backup enabled.');
            } else {
                showSuccess('Google Drive backup disabled.');
            }
        }
    };

     const handleRequestFileSystemPermission = async () => {
        setIsFileSystemRequesting(true);
        try {
            await requestPermission();
            // State updates (hasPermission, invoices) will trigger re-renders via context/useEffect
        } catch (err) {
            console.error("Error requesting permission:", err);
            showError("Failed to get file system permission.");
        } finally {
            // Add a small delay to prevent flicker if permission is granted instantly
            setTimeout(() => setIsFileSystemRequesting(false), 300);
        }
    };

    const handleChangeFolderLocation = async () => {
        setIsFileSystemRequesting(true);
        try {
            await resetDirectoryAccess();
            // After reset, request new permission
            await requestPermission();
            showSuccess("Folder location changed successfully.");
        } catch (err) {
            console.error("Error changing folder location:", err);
            showError("Failed to change folder location.");
        } finally {
            setTimeout(() => setIsFileSystemRequesting(false), 300);
        }
    };

    const handleSignOutDrive = async () => {
        setIsDriveConnecting(true); // Show visual feedback during sign out
        try {
            await signOutDrive();
            showSuccess('Disconnected from Google Drive.');
        } catch (error) {
            console.error('Error signing out of Google Drive:', error);
            showError('Failed to disconnect from Google Drive.');
        } finally {
            // Always reset the connecting state after sign out attempt
            setTimeout(() => setIsDriveConnecting(false), 1000);
        }
    };


    // Colors for charts
    const BAR_CHART_COLOR = "#3b82f6"; // Example primary color

    return (
        <div className="space-y-8 p-4 md:p-6 lg:p-8 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                    <p className="text-sm md:text-base text-gray-600">Welcome back! Here's your business overview.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/settings">
                            <Settings className="mr-2 h-4 w-4" /> Settings
                        </Link>
                    </Button>
                     <Button size="sm" asChild>
                        <Link href="/create-invoice">
                            <FileText className="mr-2 h-4 w-4" /> Create Invoice
                        </Link>
                    </Button>
                </div>
            </div>

            {/* System Status & Setup */}
             <Card className="bg-white shadow-sm border border-gray-200">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                        <LayoutDashboard className="h-5 w-5 text-primary" />
                        System Setup & Status
                    </CardTitle>
                    <CardDescription>Check essential configurations and connections.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {/* Local Storage Section */}
                     <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                         <div className="flex items-center justify-between">
                            <h3 className="font-medium text-sm flex items-center gap-1.5 text-gray-700">
                                <HardDrive className="h-4 w-4" /> Local Storage
                            </h3>
                            {!isSupported ? (
                                <StatusIndicator status="error" text="Not Supported" />
                            ) : isFileSystemLoading || isFileSystemRequesting ? (
                                <StatusIndicator status="loading" text="Checking..." />
                            ) : hasPermission ? (
                                <StatusIndicator status="success" text="Access Granted" />
                            ) : (
                                <StatusIndicator status="warning" text="Action Required" />
                            )}
                        </div>
                         <p className="text-xs text-gray-600">
                            {!isSupported
                                ? "Your browser doesn't support the required File System API. Try Chrome or Edge."
                                : hasPermission
                                ? "Ready to manage invoices locally."
                                : "Permission needed to store and access invoice files on your device."}
                        </p>
                         {!isSupported ? null : !hasPermission && !isFileSystemRequesting && !isFileSystemLoading && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleRequestFileSystemPermission}
                                className="w-full"
                                disabled={isFileSystemRequesting}
                            >
                                Grant Access
                            </Button>
                        )}
                        {!isSupported ? null : hasPermission && !isFileSystemRequesting && !isFileSystemLoading && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleChangeFolderLocation}
                                className="w-full"
                                disabled={isFileSystemRequesting}
                            >
                                Change Folder
                            </Button>
                        )}
                        {isFileSystemRequesting && (
                            <Button size="sm" variant="secondary" className="w-full" disabled>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Processing...
                            </Button>
                        )}
                     </div>

                     {/* Google Drive Section */}
                     <div className="space-y-3 p-4 border rounded-lg bg-gray-50 relative overflow-hidden">
                         {/* Loading/Connecting Overlay */}
                         {(isDriveConnecting || (!isDriveSupported && isDriveInitialized)) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm z-10">
                                <div className="flex flex-col items-center text-center p-4">
                                    <RefreshCw className="h-6 w-6 text-blue-600 animate-spin mb-2" />
                                    <p className="text-sm font-medium text-blue-800">
                                        { !isDriveSupported && isDriveInitialized ? "Not Supported" : "Connecting..."}
                                    </p>
                                    {!isDriveSupported && isDriveInitialized && <p className="text-xs text-gray-600 mt-1">Drive API unavailable in this browser.</p>}
                                    {isDriveConnecting && isDriveSupported && <p className="text-xs text-gray-600 mt-1">{driveConnectionStatus}</p>}
                                </div>
                            </div>
                        )}

                         <div className="flex items-center justify-between">
                             <h3 className="font-medium text-sm flex items-center gap-1.5 text-gray-700">
                                <Cloud className="h-4 w-4" /> Google Drive Backup
                            </h3>
                             {!isDriveSupported ? (
                                 <StatusIndicator status="error" text="Not Supported" />
                             ) : !isDriveInitialized || isDriveLoading ? (
                                 <StatusIndicator status="loading" text="Initializing..." />
                             ) : isDriveAuthenticated ? (
                                 <StatusIndicator status="success" text="Connected" />
                             ) : (
                                 <StatusIndicator status="info" text="Not Connected" />
                             )}
                         </div>

                         <p className="text-xs text-gray-600">
                             {isDriveSupported
                                 ? "Automatically sync your data to Google Drive for safety and accessibility."
                                 : "Google Drive connection is not available in your current browser."}
                        </p>

                        {isDriveSupported && isDriveInitialized && !isDriveLoading && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                     <label htmlFor="gdrive-switch" className="text-xs text-gray-600 flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            id="gdrive-switch"
                                            className="sr-only"
                                            checked={isBackupEnabled}
                                            onChange={(e) => handleToggleBackup(e.target.checked)}
                                            disabled={isDriveConnecting}
                                         />
                                        <Switch
                                             id="gdrive-switch-visual" // Use different ID for visual switch if needed by label
                                             checked={isBackupEnabled}
                                             onCheckedChange={handleToggleBackup}
                                             disabled={isDriveConnecting}
                                             aria-labelledby="gdrive-switch" // Link visual switch back to the label
                                         />
                                         <span className="ml-2">Enable Backup</span>
                                     </label>
                                </div>

                                {isDriveAuthenticated && isBackupEnabled && (
                                    <div className="space-y-2">
                                         <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleBackupFiles}
                                            className="w-full relative"
                                            disabled={syncProgress != null}
                                        >
                                            {syncProgress != null ? (
                                                <>
                                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                    Backing up ({syncProgress.current}/{syncProgress.total})
                                                    <Progress
                                                        value={syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}
                                                        className="absolute bottom-0 left-0 right-0 h-1 rounded-none"
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <Cloud className="mr-2 h-4 w-4" />
                                                    Backup Now
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {isDriveAuthenticated && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleSignOutDrive}
                                        className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                                        disabled={isDriveConnecting}
                                    >
                                        <XCircle className="mr-2 h-4 w-4" /> Disconnect Drive
                                    </Button>
                                )}
                             </div>
                         )}
                     </div>

                    {/* Company Info Section */}
                    <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                         <div className="flex items-center justify-between">
                            <h3 className="font-medium text-sm flex items-center gap-1.5 text-gray-700">
                                <Settings className="h-4 w-4" /> Company Profile
                            </h3>
                            {companyInfo && companyInfo.name !== 'Your Company Name' ? (
                                 <StatusIndicator status="success" text="Setup Complete" />
                             ) : (
                                 <StatusIndicator status="warning" text="Incomplete" />
                             )}
                         </div>
                        {companyInfo ? (
                             <>
                                 <p className="text-xs text-gray-600">
                                     {companyInfo.name !== 'Your Company Name'
                                        ? `Profile for ${companyInfo.name} is configured.`
                                        : "Please complete your company details for accurate invoices."}
                                 </p>
                                 <Button size="sm" variant="secondary" asChild className="w-full">
                                     <Link href="/settings">
                                         {companyInfo.name !== 'Your Company Name' ? 'View/Edit Profile' : 'Setup Company Profile'}
                                         <ArrowUpRight className="ml-2 h-3 w-3" />
                                     </Link>
                                 </Button>
                             </>
                         ) : (
                             <SectionSkeleton count={2} />
                         )}
                     </div>
                </CardContent>
            </Card>


            {/* Quick Actions (Simplified) */}
            {/* We might integrate these actions elsewhere or keep them minimal */}
            {/* Example: Maybe add "Create Invoice" button prominently */}

            {/* Analytics Overview */}
            <Card className="bg-white shadow-sm border border-gray-200">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                         <BarChart2 className="h-5 w-5 text-primary" />
                         Analytics Overview
                    </CardTitle>
                     <CardDescription>A quick look at your key financial metrics.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!isSupported || !hasPermission ? (
                         <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-800">
                              <AlertTriangle className="h-4 w-4" />
                             <AlertTitle>Storage Access Required</AlertTitle>
                              <AlertDescription>
                                Please grant local storage access in the 'System Setup' section above to view analytics.
                            </AlertDescription>
                        </Alert>
                     ) : isFileSystemLoading ? (
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                             {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                         </div>
                     ) : !analytics.hasData ? (
                         <div className="text-center py-12 text-gray-500">
                             <Database className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                            <h3 className="font-medium">No Invoice Data Yet</h3>
                             <p className="text-sm mt-1">Create your first invoice to see analytics here.</p>
                             <Button size="sm" className="mt-4" asChild>
                                 <Link href="/create-invoice">Create Invoice</Link>
                             </Button>
                         </div>
                    ) : (
                         <>
                            {/* Key Metrics */}
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <MetricCard title="Total Invoices" value={analytics.totalInvoices} />
                                 <MetricCard title="This Month" value={analytics.thisMonthInvoices} />
                                 <MetricCard title="Paid" value={analytics.paidInvoices} icon={CheckCircle} iconClass="text-green-600" />
                                 <MetricCard title="Unpaid" value={analytics.unpaidInvoices} icon={XCircle} iconClass="text-red-600" />
                                 <MetricCard title="Rectified" value={analytics.rectifiedInvoices} icon={FileX} iconClass="text-gray-600" />
                             </div>

                            <Separator className="my-6" />

                             {/* Revenue & Chart */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                                <div className="md:col-span-2 space-y-3">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">Total Revenue</p>
                                         <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalRevenue)}</p>
                                    </div>
                                     <div>
                                         <p className="text-xs text-gray-500 uppercase tracking-wider">This Month's Revenue</p>
                                        <p className="text-lg font-medium text-gray-700">{formatCurrency(analytics.thisMonthRevenue)}</p>
                                     </div>
                                    <Button variant="outline" size="sm" asChild className="w-full">
                                         <Link href="/analytics">
                                             View Full Analytics
                                             <ArrowUpRight className="ml-2 h-3 w-3" />
                                         </Link>
                                     </Button>
                                 </div>

                                <div className="md:col-span-3 h-52">
                                    <p className="text-xs text-center font-medium text-gray-600 mb-2">Revenue Last 3 Months</p>
                                     <ResponsiveContainer width="100%" height="100%">
                                         <BarChart data={analytics.last3Months} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                                             <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" tickLine={false} axisLine={false} />
                                             <YAxis
                                                 tickFormatter={(value) => `€${value / 1000}k`}
                                                tick={{ fontSize: 10 }}
                                                 stroke="#9ca3af"
                                                 tickLine={false}
                                                 axisLine={false}
                                                 width={35}
                                             />
                                             <Tooltip
                                                contentStyle={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                                                 formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                                                 cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                             />
                                             <Bar dataKey="revenue" radius={[4, 4, 0, 0]} >
                                                 {analytics.last3Months.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={BAR_CHART_COLOR} />
                                                 ))}
                                             </Bar>
                                         </BarChart>
                                     </ResponsiveContainer>
                                 </div>
                            </div>
                         </>
                     )}
                 </CardContent>
             </Card>

            {/* Optional: Add a Help/Support Link Card */}
             <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-sm">
                 <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-full">
                            <HelpCircle className="h-5 w-5 text-blue-600" />
                         </div>
                         <div>
                            <h3 className="font-semibold text-gray-800">Need Help?</h3>
                            <p className="text-sm text-gray-600">Find answers in our documentation or contact support.</p>
                        </div>
                     </div>
                     <Button variant="outline" size="sm" className="bg-white">
                        Go to Help Center
                     </Button>
                 </CardContent>
             </Card>

         </div>
     );
 }

 // Helper component for Metric Cards in Analytics
 const MetricCard = ({ title, value, icon: Icon, iconClass }: { title: string; value: string | number; icon?: React.ElementType; iconClass?: string }) => (
    <Card className="bg-gray-50 border border-gray-200 shadow-none">
         <CardContent className="p-4">
             <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{title}</p>
             <div className="flex items-center gap-2">
                 {Icon && <Icon className={`h-4 w-4 ${iconClass ?? 'text-gray-600'}`} />}
                 <p className="text-xl md:text-2xl font-bold text-gray-900">{value}</p>
             </div>
         </CardContent>
     </Card>
 );