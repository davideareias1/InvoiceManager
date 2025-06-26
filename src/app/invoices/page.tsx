'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { searchInvoices, getMonthlyTotals } from '../../utils/invoiceUtils';
import { generateInvoicePDF } from '@/utils/pdfUtils';
import { Invoice } from '../../interfaces';
import { PlusCircle, Download, Trash, Search, FileText, AlertCircle, FolderOpen, Clock, X, CheckCircle, ChevronLeft, ChevronRight, ArrowUpDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useFileSystem } from '../../contexts/FileSystemContext';
import { useCompany } from '../../contexts/CompanyContext';
import { showConfirmation, showError, showSuccess, showLoading } from '../../utils/notifications';
import { formatDate, formatCurrency } from '@/utils/formatters';

// Type for sorting options
type SortField = 'invoice_number' | 'invoice_date' | 'customer.name' | 'total';
type SortDirection = 'asc' | 'desc';

export default function Invoices() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
    const [displayedInvoices, setDisplayedInvoices] = useState<Invoice[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [autoRefreshDisabled, setAutoRefreshDisabled] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);

    // Sorting and filtering states
    const [sortField, setSortField] = useState<SortField>('invoice_date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [showPaid, setShowPaid] = useState(true);
    const [showUnpaid, setShowUnpaid] = useState(true);
    const [dateFilter, setDateFilter] = useState<string>('all'); // 'all', 'thisMonth', 'lastMonth', 'thisYear'

    // Use refs to track initialization state without triggering re-renders
    const initialLoadDone = useRef(false);

    const {
        isSupported,
        hasPermission,
        isInitialized,
        loadInvoices,
        deleteInvoice: deleteInvoiceFromFS,
        requestPermission,
        saveInvoice
    } = useFileSystem();

    // Get company information for PDF generation
    const { companyInfo } = useCompany();

    // Add loading state trackers for invoice actions
    const [actionLoading, setActionLoading] = useState<{[key: string]: string}>({});

    // Load invoices function (extracted for reuse)
    const loadInvoicesData = useCallback(async (showLoadingState = true) => {
        if (showLoadingState) {
            setIsLoading(true);
        }
        setLoadError(null);

        try {
            // If File System API is supported and we have permission
            if (isSupported && hasPermission) {
                const loadedInvoices = await loadInvoices();
                console.log(`Loaded ${loadedInvoices.length} invoices`);
                setInvoices(loadedInvoices);

                // Don't directly set filteredInvoices here, let the useEffect handle it
                // This avoids circular dependencies and double updates

                setLastRefreshed(new Date());
            } else {
                // Set empty state - will show permission prompt UI
                setInvoices([]);
                setFilteredInvoices([]);
                setDisplayedInvoices([]);
            }
        } catch (error) {
            console.error("Error loading invoices:", error);
            setLoadError("Failed to load invoices. Please try again.");
            setInvoices([]);
            setFilteredInvoices([]);
            setDisplayedInvoices([]);
        } finally {
            if (showLoadingState) {
                setIsLoading(false);
            }
        }
    }, [isSupported, hasPermission, loadInvoices]);

    // Initial load
    useEffect(() => {
        // Only load once when the page initially renders and context is initialized
        if (isInitialized && !initialLoadDone.current) {
            initialLoadDone.current = true;
            loadInvoicesData();
        }
    }, [isInitialized, loadInvoicesData]);

    // Handle manual refresh
    const handleRefresh = async () => {
        setIsLoading(true);
        setLoadError(null);

        try {
            if (isSupported && hasPermission) {
                await loadInvoicesData();
                showSuccess("Invoices refreshed");
            }
        } catch (error) {
            console.error("Error refreshing invoices:", error);
            setLoadError("Failed to refresh invoices");
            showError("Failed to refresh invoices");
        } finally {
            setIsLoading(false);
        }
    };

    // Function to check if auto refresh is allowed (once per minute)
    const shouldAutoRefresh = useCallback(() => {
        if (autoRefreshDisabled || !lastRefreshed) return false;

        // Only auto-refresh at most once per minute
        const now = new Date();
        const timeSinceLastRefresh = now.getTime() - lastRefreshed.getTime();
        const ONE_MINUTE = 60 * 1000;

        return timeSinceLastRefresh > ONE_MINUTE;
    }, [lastRefreshed, autoRefreshDisabled]);

    // Listen for permission changes, but don't reload on every dependency change
    useEffect(() => {
        // Only do anything if the permission state changes from false to true
        if (isSupported && hasPermission && initialLoadDone.current && shouldAutoRefresh()) {
            loadInvoicesData(false); // Silent refresh without loading indicator
        }
    }, [hasPermission, isSupported, loadInvoicesData, shouldAutoRefresh]);

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

    // Sorting function
    const sortInvoices = (invoices: Invoice[]): Invoice[] => {
        return [...invoices].sort((a, b) => {
            let aValue, bValue;

            // Handle nested properties like customer.name
            if (sortField === 'customer.name') {
                aValue = a.customer.name;
                bValue = b.customer.name;
            } else if (sortField === 'invoice_date') {
                aValue = new Date(a.invoice_date).getTime();
                bValue = new Date(b.invoice_date).getTime();
            } else if (sortField === 'total') {
                aValue = a.total;
                bValue = b.total;
            } else {
                // @ts-ignore - we know sortField is a key of Invoice
                aValue = a[sortField];
                // @ts-ignore
                bValue = b[sortField];
            }

            if (sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    };

    // Filter function
    const filterInvoices = (invoices: Invoice[]): Invoice[] => {
        return invoices.filter(invoice => {
            // Filter by payment status
            if (!showPaid && invoice.is_paid) return false;
            if (!showUnpaid && !invoice.is_paid) return false;

            // Filter by date
            if (dateFilter !== 'all') {
                const invoiceDate = new Date(invoice.invoice_date);
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth();

                if (dateFilter === 'thisMonth') {
                    const isThisMonth =
                        invoiceDate.getFullYear() === currentYear &&
                        invoiceDate.getMonth() === currentMonth;
                    if (!isThisMonth) return false;
                } else if (dateFilter === 'lastMonth') {
                    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                    const yearOfLastMonth = currentMonth === 0 ? currentYear - 1 : currentYear;
                    const isLastMonth =
                        invoiceDate.getFullYear() === yearOfLastMonth &&
                        invoiceDate.getMonth() === lastMonth;
                    if (!isLastMonth) return false;
                } else if (dateFilter === 'thisYear') {
                    if (invoiceDate.getFullYear() !== currentYear) return false;
                }
            }

            return true;
        });
    };

    // Apply all filters and sorting
    const applyFiltersAndSort = useCallback(() => {
        // Apply payment status and date filters first
        const filtered = filterInvoices(invoices);

        // Then, apply search to the already filtered list
        let searchResults;
        if (!searchTerm || searchTerm.trim() === '') {
            searchResults = [...filtered];
        } else {
            // We need to re-implement the search logic here since searchInvoices now only takes a query string.
            const lowerQuery = searchTerm.toLowerCase();
            searchResults = filtered.filter(invoice =>
                (invoice.invoice_number && invoice.invoice_number.toLowerCase().includes(lowerQuery)) ||
                (invoice.customer?.name && invoice.customer.name.toLowerCase().includes(lowerQuery))
            );
        }

        // Then sort the final list
        const sorted = sortInvoices(searchResults);

        // Update the filteredInvoices state with the final results
        setFilteredInvoices(sorted);

        // Update total pages
        setTotalPages(Math.max(1, Math.ceil(sorted.length / itemsPerPage)));
    }, [invoices, searchTerm, itemsPerPage, sortField, sortDirection, showPaid, showUnpaid, dateFilter]);

    // Update displayed invoices whenever filtered results or page changes
    useEffect(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedInvoices = filteredInvoices.slice(start, end);
        setDisplayedInvoices(paginatedInvoices);
    }, [filteredInvoices, currentPage, itemsPerPage]);

    // Apply filters and sorting when dependencies change
    useEffect(() => {
        if (invoices.length > 0) {
            applyFiltersAndSort();
        }
    }, [invoices, searchTerm, sortField, sortDirection, showPaid, showUnpaid, dateFilter, applyFiltersAndSort]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, showPaid, showUnpaid, dateFilter, sortField, sortDirection]);

    // Modified search handler - now just updates the searchTerm
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // The actual filtering will be handled by the applyFiltersAndSort function via dependency change
    };

    // Handle search input clear
    const handleClearSearch = () => {
        setSearchTerm('');
        // The filters will be reapplied automatically via effect
    };

    // Toggle sort direction or change sort field
    const toggleSort = (field: SortField) => {
        if (field === sortField) {
            // Toggle direction if same field
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new field with default desc direction
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Page navigation
    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    // Handle items per page change
    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1); // Reset to first page
    };

    // Handle invoice deletion with loading animation
    const handleDelete = async (invoiceNumber: string) => {
        const confirmed = await showConfirmation(
            'Are you sure you want to delete this invoice?',
            'Delete',
            'Cancel'
        );

        if (confirmed) {
            try {
                // Set loading state for this specific invoice
                setActionLoading(prev => ({...prev, [invoiceNumber]: 'deleting'}));
                
                // Delete from file system
                const success = await deleteInvoiceFromFS(invoiceNumber);

                if (success) {
                    // Update local state - this will trigger the filtering effects
                    const updatedInvoices = invoices.filter(inv => inv.invoice_number !== invoiceNumber);
                    setInvoices(updatedInvoices);
                    showSuccess("Invoice deleted successfully");
                } else {
                    showError("Failed to delete invoice");
                }
            } catch (error) {
                console.error("Error deleting invoice:", error);
                showError("An error occurred while deleting the invoice");
            } finally {
                // Clear loading state
                setActionLoading(prev => {
                    const newState = {...prev};
                    delete newState[invoiceNumber];
                    return newState;
                });
            }
        }
    };

    // Handle toggle paid status with loading animation
    const handleTogglePaidStatus = async (invoice: Invoice) => {
        const updatedInvoice = {
            ...invoice,
            is_paid: !invoice.is_paid,
            status: !invoice.is_paid ? 'paid' : 'unpaid'
        } as Invoice;

        try {
            // Set loading state for this specific invoice
            setActionLoading(prev => ({...prev, [invoice.invoice_number]: 'updating'}));
            
            // Delete and save updated invoice
            await deleteInvoiceFromFS(invoice.invoice_number);
            const success = await saveInvoice(updatedInvoice);

            if (success) {
                // Update local state - this will trigger the filters to reapply
                const updatedInvoices = invoices.map(inv =>
                    inv.invoice_number === invoice.invoice_number
                        ? updatedInvoice
                        : inv
                );
                setInvoices(updatedInvoices);

                // No need to call loadInvoicesData here, as the useEffect will handle the filtering
                showSuccess(`Invoice marked as ${updatedInvoice.is_paid ? 'paid' : 'unpaid'}`);
            }
        } catch (error) {
            console.error("Error updating invoice:", error);
            showError("Failed to update invoice status");
        } finally {
            // Clear loading state after a short delay for animation smoothness
            setTimeout(() => {
                setActionLoading(prev => {
                    const newState = {...prev};
                    delete newState[invoice.invoice_number];
                    return newState;
                });
            }, 300);
        }
    };

    // Download invoice as PDF
    const handleDownloadPDF = async (invoice: Invoice) => {
        try {
            // Use the PDF generation utility
            const pdfBlob = await generateInvoicePDF(invoice, companyInfo);
            
            // Create and click a download link
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Rechnung_${invoice.invoice_number}.pdf`;
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showSuccess("PDF generated successfully");
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            showError("Failed to generate PDF");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with actions */}
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Invoices</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Manage your invoices and track payment status
                                {lastRefreshed && (
                                    <span className="ml-2 text-gray-500 inline-flex items-center">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Last updated: {formatRefreshTime()}
                                    </span>
                                )}
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                onClick={toggleAutoRefresh}
                                title={`${autoRefreshDisabled ? 'Enable' : 'Disable'} auto-refresh`}
                                className={`text-xs px-2.5 py-1 h-9 border ${autoRefreshDisabled ? 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100' : 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100'}`}
                                size="sm"
                            >
                                <Clock className={`mr-1.5 h-3.5 w-3.5`} />
                                {autoRefreshDisabled ? 'Auto-refresh off' : 'Auto-refresh on'}
                            </Button>
                            
                            <Button
                                variant="outline"
                                onClick={handleRefresh}
                                disabled={isLoading || !hasPermission}
                                className="text-xs px-2.5 py-1 h-9 bg-white"
                                size="sm"
                            >
                                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            
                            <Button 
                                className="text-xs px-3 py-1 h-9 bg-primary hover:bg-primary/90 text-white" 
                                size="sm"
                                asChild
                            >
                                <Link href="/create-invoice" className="flex items-center">
                                    <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                                    New Invoice
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Error & permission states */}
                    {loadError && (
                        <div className="p-4 mb-5 rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-center text-sm">
                            <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                            <p>{loadError}</p>
                        </div>
                    )}

                    {isSupported && !hasPermission && !isLoading && (
                        <div className="p-4 mb-5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                            <div className="flex items-start sm:items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500 mr-1 flex-shrink-0 mt-0.5 sm:mt-0" />
                                <div>
                                    <p className="font-medium">Storage access required</p>
                                    <p className="text-sm text-amber-700 mt-0.5">Grant permission to access file storage for managing invoices</p>
                                </div>
                            </div>
                            <Button
                                onClick={requestPermission}
                                className="sm:self-start bg-amber-600 hover:bg-amber-700 text-white"
                                size="sm"
                            >
                                Grant Permission
                            </Button>
                        </div>
                    )}

                    {!isSupported && (
                        <div className="p-4 mb-5 rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 text-red-500 mr-1 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Browser not supported</p>
                                <p className="text-sm mt-0.5">Your browser doesn't support the File System API. Please use Chrome or Edge.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main content - New unified card design */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Search and filters area */}
                    <div className="border-b border-gray-100">
                        {/* Search bar - cleaner, focused design */}
                        <div className="p-4 md:p-5">
                            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search invoices by number, customer name, or amount..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        disabled={isLoading || !hasPermission}
                                        className="pl-10 py-2 h-10 bg-gray-50 border-gray-200 rounded-md w-full focus:bg-white"
                                    />
                                    {searchTerm && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 hover:bg-gray-200 rounded-full p-1"
                                            onClick={handleClearSearch}
                                            title="Clear search"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <Button
                                    type="submit"
                                    className="h-10 px-4 bg-gray-900 hover:bg-gray-800 text-white flex items-center shrink-0"
                                    disabled={isLoading || !hasPermission}
                                >
                                    <Search className="mr-2 h-4 w-4" />
                                    Search
                                </Button>
                            </form>
                        </div>

                        {/* Improved filter design with cleaner UI */}
                        <div className="p-4 md:p-5 bg-gray-50 border-t border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Payment Status Filter - 3 columns on desktop */}
                                <div className="md:col-span-3">
                                    <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Payment Status</h3>
                                    <div className="flex flex-row md:flex-col gap-4 md:gap-2.5">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="filter-paid"
                                                checked={showPaid}
                                                onCheckedChange={(checked) => setShowPaid(checked as boolean)}
                                                className="text-green-600 focus:ring-green-500"
                                            />
                                            <Label htmlFor="filter-paid" className="text-sm flex items-center">
                                                <div className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></div>
                                                Paid Invoices
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="filter-unpaid"
                                                checked={showUnpaid}
                                                onCheckedChange={(checked) => setShowUnpaid(checked as boolean)}
                                                className="text-amber-600 focus:ring-amber-500"
                                            />
                                            <Label htmlFor="filter-unpaid" className="text-sm flex items-center">
                                                <div className="h-2 w-2 rounded-full bg-amber-500 mr-1.5"></div>
                                                Unpaid Invoices
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                {/* Date Filter - 4 columns on desktop */}
                                <div className="md:col-span-5">
                                    <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Date Range</h3>
                                    <Select
                                        value={dateFilter}
                                        onValueChange={setDateFilter}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-white border-gray-200 focus:ring-primary/40">
                                            <SelectValue placeholder="Select time period" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Dates</SelectItem>
                                            <SelectItem value="thisMonth">This Month</SelectItem>
                                            <SelectItem value="lastMonth">Last Month</SelectItem>
                                            <SelectItem value="thisYear">This Year</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Items per page - 4 columns on desktop */}
                                <div className="md:col-span-4">
                                    <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Items per page</h3>
                                    <Select
                                        value={itemsPerPage.toString()}
                                        onValueChange={handleItemsPerPageChange}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-white border-gray-200 focus:ring-primary/40">
                                            <SelectValue placeholder="Results per page" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5 invoices</SelectItem>
                                            <SelectItem value="10">10 invoices</SelectItem>
                                            <SelectItem value="20">20 invoices</SelectItem>
                                            <SelectItem value="50">50 invoices</SelectItem>
                                            <SelectItem value="100">100 invoices</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Invoices list - Improved table design */}
                    <div>
                        {/* Table header - subtle and clean */}
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-medium text-gray-800 flex items-center">
                                Invoice List
                                {filteredInvoices.length > 0 && (
                                    <span className="ml-2 text-sm font-normal text-gray-500">
                                        ({filteredInvoices.length} {filteredInvoices.length === 1 ? 'invoice' : 'invoices'})
                                    </span>
                                )}
                            </h2>
                        </div>

                        {/* Loading state */}
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="rounded-full bg-primary/10 p-3 mb-3">
                                    <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                                </div>
                                <p className="text-gray-600 font-medium">Loading invoices...</p>
                                <p className="text-sm text-gray-500 mt-1">This might take a moment</p>
                            </div>
                        ) : !hasPermission ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="bg-amber-100 p-3 rounded-full mb-3">
                                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                                </div>
                                <p className="text-gray-700 font-medium">Storage access needed</p>
                                <p className="text-sm text-gray-500 mt-1 mb-4 max-w-md text-center">
                                    Grant permission using the button above to view and manage your invoices
                                </p>
                                <Button 
                                    onClick={requestPermission} 
                                    variant="outline"
                                    className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                >
                                    Grant Access
                                </Button>
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="bg-gray-100 p-3 rounded-full mb-3">
                                    <FileText className="h-6 w-6 text-gray-400" />
                                </div>
                                <p className="text-gray-700 font-medium">No invoices found</p>
                                <p className="text-sm text-gray-500 mt-1 mb-4">
                                    {searchTerm ? 'Try a different search term or adjust your filters' : 'Create your first invoice to get started'}
                                </p>
                                {!searchTerm ? (
                                    <Button asChild>
                                        <Link href="/create-invoice" className="flex items-center">
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            Create Invoice
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button variant="outline" onClick={handleClearSearch}>
                                        <X className="mr-2 h-4 w-4" />
                                        Clear Search
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-y border-gray-200">
                                            <th className="px-6 py-3 text-left">
                                                <button
                                                    className="group flex items-center text-xs font-medium text-gray-600 uppercase tracking-wider hover:text-gray-900"
                                                    onClick={() => toggleSort('invoice_number')}
                                                >
                                                    Invoice #
                                                    <ArrowUpDown className={`ml-1 h-3.5 w-3.5 transition-colors ${
                                                        sortField === 'invoice_number' 
                                                            ? 'text-primary' 
                                                            : 'text-gray-400 group-hover:text-gray-600'
                                                    }`} />
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-left">
                                                <button
                                                    className="group flex items-center text-xs font-medium text-gray-600 uppercase tracking-wider hover:text-gray-900"
                                                    onClick={() => toggleSort('invoice_date')}
                                                >
                                                    Date
                                                    <ArrowUpDown className={`ml-1 h-3.5 w-3.5 transition-colors ${
                                                        sortField === 'invoice_date' 
                                                            ? 'text-primary' 
                                                            : 'text-gray-400 group-hover:text-gray-600'
                                                    }`} />
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-left">
                                                <button
                                                    className="group flex items-center text-xs font-medium text-gray-600 uppercase tracking-wider hover:text-gray-900"
                                                    onClick={() => toggleSort('customer.name')}
                                                >
                                                    Customer
                                                    <ArrowUpDown className={`ml-1 h-3.5 w-3.5 transition-colors ${
                                                        sortField === 'customer.name' 
                                                            ? 'text-primary' 
                                                            : 'text-gray-400 group-hover:text-gray-600'
                                                    }`} />
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-right">
                                                <button
                                                    className="group flex items-center ml-auto text-xs font-medium text-gray-600 uppercase tracking-wider hover:text-gray-900"
                                                    onClick={() => toggleSort('total')}
                                                >
                                                    Amount
                                                    <ArrowUpDown className={`ml-1 h-3.5 w-3.5 transition-colors ${
                                                        sortField === 'total' 
                                                            ? 'text-primary' 
                                                            : 'text-gray-400 group-hover:text-gray-600'
                                                    }`} />
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-center">
                                                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                    Status
                                                </span>
                                            </th>
                                            <th className="px-6 py-3 text-center">
                                                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                    Actions
                                                </span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {displayedInvoices.map((invoice) => (
                                            <tr 
                                                key={invoice.id} 
                                                className="hover:bg-gray-50/80 transition-colors"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {invoice.invoice_number}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm text-gray-600">
                                                        {format(new Date(invoice.invoice_date), 'dd.MM.yyyy')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm text-gray-600">
                                                        {invoice.customer.name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {formatCurrency(invoice.total)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex justify-center">
                                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                                            invoice.is_paid 
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {invoice.is_paid ? 'Paid' : 'Pending'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex justify-center gap-1.5">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleTogglePaidStatus(invoice)}
                                                            title={invoice.is_paid ? "Mark as Unpaid" : "Mark as Paid"}
                                                            className={`h-8 w-8 rounded-full ${
                                                                invoice.is_paid 
                                                                    ? 'text-green-600 hover:bg-green-50' 
                                                                    : 'text-amber-600 hover:bg-amber-50'
                                                            } ${actionLoading[invoice.invoice_number] === 'updating' ? 'opacity-70' : ''}`}
                                                            disabled={Boolean(actionLoading[invoice.invoice_number])}
                                                        >
                                                            {actionLoading[invoice.invoice_number] === 'updating' ? (
                                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <CheckCircle className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDownloadPDF(invoice)}
                                                            title="Download PDF"
                                                            className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                                                            disabled={Boolean(actionLoading[invoice.invoice_number])}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                        
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(invoice.invoice_number)}
                                                            title="Delete Invoice"
                                                            className={`h-8 w-8 rounded-full text-red-600 hover:bg-red-50 ${
                                                                actionLoading[invoice.invoice_number] === 'deleting' ? 'opacity-70' : ''
                                                            }`}
                                                            disabled={Boolean(actionLoading[invoice.invoice_number])}
                                                        >
                                                            {actionLoading[invoice.invoice_number] === 'deleting' ? (
                                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Improved pagination design */}
                        {filteredInvoices.length > 0 && (
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="text-sm text-gray-600">
                                    Showing <span className="font-medium">{Math.min(filteredInvoices.length, 1 + (currentPage - 1) * itemsPerPage)}</span> to{" "}
                                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredInvoices.length)}</span> of{" "}
                                    <span className="font-medium">{filteredInvoices.length}</span> invoices
                                </div>
                                <div className="flex items-center">
                                    <div className="hidden md:flex mr-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => goToPage(1)}
                                            disabled={currentPage === 1}
                                            title="First Page"
                                            className="h-8 px-2.5 border-gray-200 text-gray-600 rounded-r-none"
                                        >
                                            First
                                        </Button>
                                    </div>
                                    <div className="flex rounded-md shadow-sm">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => goToPage(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            title="Previous Page"
                                            className="h-8 px-2 border-gray-200 text-gray-600 rounded-r-none"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <div className="relative inline-flex items-center px-3 h-8 text-sm font-medium text-gray-800 bg-white border border-gray-200 border-x-0">
                                            <span className="mx-1">Page</span>
                                            <span className="bg-gray-100 text-gray-800 py-0.5 px-1.5 rounded">
                                                {currentPage} 
                                            </span>
                                            <span className="mx-1">of</span>
                                            <span className="bg-gray-100 text-gray-800 py-0.5 px-1.5 rounded">{totalPages}</span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => goToPage(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                            title="Next Page"
                                            className="h-8 px-2 border-gray-200 text-gray-600 rounded-l-none"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="hidden md:flex ml-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => goToPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                            title="Last Page"
                                            className="h-8 px-2.5 border-gray-200 text-gray-600 rounded-l-none"
                                        >
                                            Last
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 