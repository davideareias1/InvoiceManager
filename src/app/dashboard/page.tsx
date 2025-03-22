'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Input } from '../components/Input';
import { getInvoices, deleteInvoice, searchInvoices, getMonthlyTotals } from '../utils/invoiceUtils';
import { generateInvoicePDF } from '../utils/pdfUtils';
import { Invoice } from '../interfaces';
import { PlusCircle, Download, Trash, Search, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useCompany } from '../contexts/CompanyContext';
import { showLoading, showError } from '../utils/notifications';

export default function Dashboard() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [monthlyTotals, setMonthlyTotals] = useState<Record<string, number>>({});

    // Get company info for PDF generation
    const { companyInfo } = useCompany();

    // Load invoices from local storage
    useEffect(() => {
        const loadedInvoices = getInvoices();
        setInvoices(loadedInvoices);
        setFilteredInvoices(loadedInvoices);
        setMonthlyTotals(getMonthlyTotals(loadedInvoices));
    }, []);

    // Handle search
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setFilteredInvoices(searchInvoices(invoices, searchTerm));
    };

    // Handle invoice deletion
    const handleDelete = (invoiceNumber: string) => {
        if (window.confirm('Are you sure you want to delete this invoice?')) {
            deleteInvoice(invoiceNumber);
            const updatedInvoices = invoices.filter(inv => inv.invoice_number !== invoiceNumber);
            setInvoices(updatedInvoices);
            setFilteredInvoices(searchInvoices(updatedInvoices, searchTerm));
            setMonthlyTotals(getMonthlyTotals(updatedInvoices));
        }
    };

    // Download invoice as PDF
    const handleDownloadPDF = async (invoice: Invoice) => {
        try {
            const loadingToast = showLoading("Generating PDF...");
            // Use the new PDF generation utility that supports XRechnung 2025
            const pdfBlob = await generateInvoicePDF(invoice, companyInfo);

            // Create a URL for the blob
            const url = URL.createObjectURL(pdfBlob);

            // Create and click a download link
            const link = document.createElement('a');
            link.href = url;
            link.download = `Rechnung_${invoice.invoice_number}.pdf`;
            document.body.appendChild(link);
            link.click();

            // Clean up
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            loadingToast.success("PDF generated successfully");
        } catch (error) {
            console.error("Error generating PDF:", error);
            showError("Failed to generate PDF");
        }
    };

    // Download invoice as JSON
    const handleDownloadJSON = (invoice: Invoice) => {
        const jsonData = JSON.stringify(invoice, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${invoice.invoice_number}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Format currency
    const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Invoice Dashboard</h1>
                    <Link href="/create-invoice">
                        <Button className="flex items-center">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New Invoice
                        </Button>
                    </Link>
                </div>

                {/* Search */}
                <Card className="mb-8">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSearch} className="flex gap-4">
                            <div className="flex-1">
                                <Input
                                    type="text"
                                    placeholder="Search by invoice number or customer name"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="flex items-center">
                                <Search className="mr-2 h-4 w-4" />
                                Search
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Invoices table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Your Invoices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            {filteredInvoices.length === 0 ? (
                                <p className="text-center py-6 text-gray-500">No invoices found.</p>
                            ) : (
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4">Invoice Number</th>
                                            <th className="text-left py-3 px-4">Date</th>
                                            <th className="text-left py-3 px-4">Customer</th>
                                            <th className="text-right py-3 px-4">Total</th>
                                            <th className="text-center py-3 px-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInvoices.map((invoice) => (
                                            <tr key={invoice.id} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4">{invoice.invoice_number}</td>
                                                <td className="py-3 px-4">
                                                    {format(new Date(invoice.invoice_date), 'dd.MM.yyyy')}
                                                </td>
                                                <td className="py-3 px-4">{invoice.customer.name}</td>
                                                <td className="py-3 px-4 text-right">
                                                    {formatCurrency(invoice.total)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex justify-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDownloadPDF(invoice)}
                                                            title="Download PDF"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDownloadJSON(invoice)}
                                                            title="Download JSON"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDelete(invoice.invoice_number)}
                                                            title="Delete Invoice"
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
                        </div>
                    </CardContent>
                </Card>

                {/* Monthly totals */}
                {Object.keys(monthlyTotals).length > 0 && (
                    <Card className="mt-8">
                        <CardHeader>
                            <CardTitle>Monthly Totals</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-4">Month</th>
                                        <th className="text-right py-2 px-4">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(monthlyTotals)
                                        .sort((a, b) => b[0].localeCompare(a[0])) // Sort by month descending
                                        .map(([month, total]) => (
                                            <tr key={month} className="border-b hover:bg-gray-50">
                                                <td className="py-2 px-4">{month}</td>
                                                <td className="py-2 px-4 text-right font-bold">
                                                    {formatCurrency(total)}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
} 