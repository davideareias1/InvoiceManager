"use client";

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CustomerData } from '@/domain/models';
import { formatDate } from '@/shared/formatters';

export type CustomersTableProps = {
    customers: CustomerData[];
    isLoading: boolean;
    onEdit: (customer: CustomerData) => void;
    onDelete: (customer: CustomerData) => void;
};

export function CustomersTable({ customers, isLoading, onEdit, onDelete }: CustomersTableProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <Table>
                <TableHeader className="bg-gray-50">
                    <TableRow>
                        <TableHead className="font-medium text-gray-700">Name</TableHead>
                        <TableHead className="font-medium text-gray-700">Number</TableHead>
                        <TableHead className="font-medium text-gray-700">City</TableHead>
                        <TableHead className="font-medium text-gray-700 text-right">Hourly Rate</TableHead>
                        <TableHead className="font-medium text-gray-700">Last Updated</TableHead>
                        <TableHead className="font-medium text-gray-700 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="py-12 text-center">
                                <div className="flex items-center justify-center gap-2 text-gray-500">
                                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                                    Loading customers…
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : customers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="py-12 text-center text-gray-500">
                                No customers found.
                            </TableCell>
                        </TableRow>
                    ) : customers.map(c => (
                        <TableRow key={c.id} className="hover:bg-gray-50 transition-colors">
                            <TableCell className="font-medium">
                                <div className="truncate max-w-[200px]" title={c.name}>{c.name}</div>
                            </TableCell>
                            <TableCell className="text-gray-600">
                                <div className="truncate max-w-[120px]" title={c.number || ''}>{c.number || '–'}</div>
                            </TableCell>
                            <TableCell className="text-gray-600">
                                <div className="truncate max-w-[150px]" title={c.city || ''}>{c.city || '–'}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {typeof c.hourlyRate === 'number' ? (
                                    <span className="text-green-700 bg-green-50 px-2 py-1 rounded text-sm">
                                        €{c.hourlyRate.toFixed(2)}
                                    </span>
                                ) : (
                                    <span className="text-gray-400">–</span>
                                )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                                {formatDate(c.lastModified)}
                            </TableCell>
                            <TableCell>
                                <div className="flex justify-end gap-2">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => onEdit(c)}
                                        className="h-8 px-3 text-xs hover:bg-gray-100"
                                    >
                                        Edit
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => onDelete(c)}
                                        className="h-8 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}


