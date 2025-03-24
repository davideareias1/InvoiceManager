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
import { PlusCircle, Download, Trash, Search, FileText, AlertCircle, FolderOpen, Clock, X, CheckCircle, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
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
        // Start with search-filtered results from invoices array
        let searchResults;
        if (!searchTerm || searchTerm.trim() === '') {
            searchResults = [...invoices];
        } else {
            searchResults = searchInvoices(invoices, searchTerm) as Invoice[];
        }

        // Apply payment status and date filters
        const filtered = filterInvoices(searchResults);

        // Then sort
        const sorted = sortInvoices(filtered);

        // Update the filteredInvoices state with both filtered and sorted results
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

    // Handle invoice deletion
    const handleDelete = async (invoiceNumber: string) => {
        const confirmed = await showConfirmation(
            'Are you sure you want to delete this invoice?',
            'Delete',
            'Cancel'
        );

        if (confirmed) {
            try {
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
            }
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
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with actions */}
                <header className="mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Invoice Dashboard</h1>
                            {lastRefreshed && (
                                <p className="text-sm text-gray-500 mt-1">
                                    Last refreshed: {formatRefreshTime()}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant="outline"
                                onClick={toggleAutoRefresh}
                                title={`${autoRefreshDisabled ? 'Enable' : 'Disable'} auto-refresh`}
                                className="flex items-center"
                                size="sm"
                            >
                                <Clock className={`mr-2 h-4 w-4 ${autoRefreshDisabled ? 'text-red-500' : 'text-green-500'}`} />
                                {autoRefreshDisabled ? 'Auto-refresh off' : 'Auto-refresh on'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleRefresh}
                                disabled={isLoading || !hasPermission}
                                className="flex items-center"
                                size="sm"
                            >
                                <FolderOpen className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                            <Link href="/create-invoice">
                                <Button className="flex items-center" size="sm">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Create New Invoice
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Error states */}
                    {loadError && (
                        <div className="p-4 mb-5 rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-center">
                            <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" />
                            <p className="font-medium">{loadError}</p>
                        </div>
                    )}

                    {isSupported && !hasPermission && !isLoading && (
                        <div className="p-4 mb-5 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200 flex items-center justify-between">
                            <div className="flex items-center">
                                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" />
                                <div>
                                    <p className="font-medium">Storage access required</p>
                                    <p className="text-sm text-yellow-700">Please grant permission to access file storage for managing your invoices.</p>
                                </div>
                            </div>
                            <Button
                                onClick={requestPermission}
                                className="bg-yellow-500 hover:bg-yellow-600"
                                size="sm"
                            >
                                Grant Permission
                            </Button>
                        </div>
                    )}

                    {!isSupported && (
                        <div className="p-4 mb-5 rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-center">
                            <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" />
                            <div>
                                <p className="font-medium">Browser not supported</p>
                                <p className="text-sm">Your browser doesn't support the File System API. Please use a modern browser like Chrome.</p>
                            </div>
                        </div>
                    )}
                </header>

                {/* Main content - Search, Filters, and Invoices combined in a single card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* Search bar */}
                    <div className="p-5 border-b border-gray-200">
                        <form onSubmit={handleSearch} className="flex gap-3">
                            <div className="flex-1 relative">
                                <Input
                                    type="text"
                                    placeholder="Search by invoice number or customer name"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    disabled={isLoading || !hasPermission}
                                    className="pr-10"
                                />
                                {searchTerm && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
                                        onClick={handleClearSearch}
                                        title="Clear search"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            <Button
                                type="submit"
                                className="flex items-center"
                                disabled={isLoading || !hasPermission}
                                size="sm"
                            >
                                <Search className="mr-2 h-4 w-4" />
                                Search
                            </Button>
                        </form>
                    </div>

                    {/* Filters */}
                    <div className="p-5 bg-gray-50 border-b border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Payment Status Filter */}
                            <div>
                                <h3 className="text-sm font-medium mb-2 text-gray-700">Payment Status</h3>
                                <div className="flex gap-4 md:flex-col md:gap-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="filter-paid"
                                            checked={showPaid}
                                            onCheckedChange={(checked) => setShowPaid(checked as boolean)}
                                        />
                                        <Label htmlFor="filter-paid" className="text-sm">Show Paid</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="filter-unpaid"
                                            checked={showUnpaid}
                                            onCheckedChange={(checked) => setShowUnpaid(checked as boolean)}
                                        />
                                        <Label htmlFor="filter-unpaid" className="text-sm">Show Unpaid</Label>
                                    </div>
                                </div>
                            </div>

                            {/* Date Filter */}
                            <div>
                                <h3 className="text-sm font-medium mb-2 text-gray-700">Time Period</h3>
                                <Select
                                    value={dateFilter}
                                    onValueChange={setDateFilter}
                                >
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Select time period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Time</SelectItem>
                                        <SelectItem value="thisMonth">This Month</SelectItem>
                                        <SelectItem value="lastMonth">Last Month</SelectItem>
                                        <SelectItem value="thisYear">This Year</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Items per page */}
                            <div>
                                <h3 className="text-sm font-medium mb-2 text-gray-700">Items per page</h3>
                                <Select
                                    value={itemsPerPage.toString()}
                                    onValueChange={handleItemsPerPageChange}
                                >
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Select items per page" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5</SelectItem>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Invoices list header */}
                    <div className="p-5 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-800">Your Invoices</h2>
                    </div>

                    {/* Invoices table */}
                    <div className="overflow-x-auto">
                        {isLoading ? (
                            <div className="flex justify-center items-center p-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <span className="ml-3 text-gray-600">Loading invoices...</span>
                            </div>
                        ) : !hasPermission ? (
                            <p className="text-center py-10 text-gray-500">Grant storage permission to view invoices</p>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                                <div className="bg-gray-100 p-3 rounded-full mb-3">
                                    <FileText className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-gray-600 mb-1">No invoices found</p>
                                <p className="text-sm text-gray-500 mb-4">Create your first invoice to get started</p>
                                <Link href="/create-invoice">
                                    <Button size="sm">
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Create Invoice
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <table className="w-full table-auto">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <button
                                                className="flex items-center font-medium text-gray-700 hover:text-gray-900"
                                                onClick={() => toggleSort('invoice_number')}
                                            >
                                                Invoice Number
                                                <ArrowUpDown className={`ml-1 h-4 w-4 ${sortField === 'invoice_number' ? 'opacity-100 text-blue-600' : 'opacity-30'}`} />
                                            </button>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <button
                                                className="flex items-center font-medium text-gray-700 hover:text-gray-900"
                                                onClick={() => toggleSort('invoice_date')}
                                            >
                                                Date
                                                <ArrowUpDown className={`ml-1 h-4 w-4 ${sortField === 'invoice_date' ? 'opacity-100 text-blue-600' : 'opacity-30'}`} />
                                            </button>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <button
                                                className="flex items-center font-medium text-gray-700 hover:text-gray-900"
                                                onClick={() => toggleSort('customer.name')}
                                            >
                                                Customer
                                                <ArrowUpDown className={`ml-1 h-4 w-4 ${sortField === 'customer.name' ? 'opacity-100 text-blue-600' : 'opacity-30'}`} />
                                            </button>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <button
                                                className="flex items-center ml-auto font-medium text-gray-700 hover:text-gray-900"
                                                onClick={() => toggleSort('total')}
                                            >
                                                Total
                                                <ArrowUpDown className={`ml-1 h-4 w-4 ${sortField === 'total' ? 'opacity-100 text-blue-600' : 'opacity-30'}`} />
                                            </button>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {displayedInvoices.map((invoice) => (
                                        <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {invoice.invoice_number}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {format(new Date(invoice.invoice_date), 'dd.MM.yyyy')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {invoice.customer.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                {formatCurrency(invoice.total)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                <div className="flex justify-center gap-2">
                                                    <Button
                                                        variant={invoice.is_paid ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={async () => {
                                                            const updatedInvoice = {
                                                                ...invoice,
                                                                is_paid: !invoice.is_paid,
                                                                status: !invoice.is_paid ? 'paid' : 'unpaid'
                                                            } as Invoice;

                                                            try {
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
                                                            }
                                                        }}
                                                        title={invoice.is_paid ? "Mark as Unpaid" : "Mark as Paid"}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <CheckCircle className={`h-4 w-4 ${invoice.is_paid ? 'text-white' : 'text-gray-500'}`} />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDownloadPDF(invoice)}
                                                        title="Download PDF"
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDelete(invoice.invoice_number)}
                                                        title="Delete Invoice"
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* Pagination */}
                        {filteredInvoices.length > 0 && (
                            <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-gray-50 border-t border-gray-200">
                                <div className="text-sm text-gray-500 mb-4 sm:mb-0">
                                    Showing {Math.min(filteredInvoices.length, 1 + (currentPage - 1) * itemsPerPage)}-{Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(1)}
                                        disabled={currentPage === 1}
                                        title="First Page"
                                        className="h-8 px-2"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" /> First
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        title="Previous Page"
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="flex items-center px-3 h-8 bg-white border border-gray-300 rounded text-sm">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        title="Next Page"
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => goToPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        title="Last Page"
                                        className="h-8 px-2"
                                    >
                                        Last <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 