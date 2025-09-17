"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CustomerData } from '@/domain/models';
import { customerRepositoryAdapter } from '@/infrastructure/repositories/customerRepository';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { CustomersTable } from '@/components/customers/CustomersTable';
import { CustomerForm } from '@/components/customers/CustomerForm';

export default function CustomersPage() {
    // ===== HOOKS & EXTERNAL STATE =====
    const { isInitialized, hasPermission } = useFileSystem();

    // ===== LOCAL STATE =====
    const [allCustomers, setAllCustomers] = useState<CustomerData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<CustomerData | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<CustomerData | null>(null);

    // ===== EFFECTS =====
    useEffect(() => {
        const load = async () => {
            if (!isInitialized || !hasPermission) return;
            setIsLoading(true);
            try {
                const list = await customerRepositoryAdapter.loadCustomers();
                setAllCustomers(list);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [isInitialized, hasPermission]);

    // ===== DERIVED/COMPUTED =====
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return allCustomers.slice().sort((a, b) => a.name.localeCompare(b.name));
        return allCustomers
            .filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.number || '').toLowerCase().includes(q) ||
                (c.city || '').toLowerCase().includes(q) ||
                (c.address || '').toLowerCase().includes(q)
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allCustomers, query]);

    // ===== ACTION HANDLERS =====
    const startCreate = () => {
        setEditing(null);
        setShowForm(true);
    };

    const startEdit = (c: CustomerData) => {
        setEditing(c);
        setShowForm(true);
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditing(null);
    };

    const saveCustomer = async (partial: Partial<CustomerData>) => {
        setIsSaving(true);
        try {
            const payload: CustomerData = {
                id: partial.id || (editing?.id ? editing.id : ''), // Fix: properly preserve ID for updates
                name: partial.name || '',
                address: partial.address || '',
                city: partial.city || '',
                number: partial.number,
                hourlyRate: typeof partial.hourlyRate === 'number' ? partial.hourlyRate : undefined,
                lastModified: new Date().toISOString(),
                isDeleted: false,
            };
            const saved = await customerRepositoryAdapter.saveCustomer(payload);
            const list = await customerRepositoryAdapter.loadCustomers();
            setAllCustomers(list);
            setShowForm(false);
            setEditing(null);
            return saved;
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setIsLoading(true);
        try {
            await customerRepositoryAdapter.deleteCustomer(pendingDelete.id);
            const list = await customerRepositoryAdapter.loadCustomers();
            setAllCustomers(list);
        } finally {
            setIsLoading(false);
            setPendingDelete(null);
        }
    };

    // ===== RENDER =====
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-6xl mx-auto px-6 py-16">
                {/* Centered Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-light text-black mb-2">Customers</h1>
                    {filtered.length > 0 && (
                        <p className="text-lg text-gray-600 mb-8">
                            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
                        </p>
                    )}
                    
                    {/* Centered Controls */}
                    <div className="flex items-center justify-center gap-4 max-w-2xl mx-auto">
                        <div className="relative flex-1">
                            <Input
                                placeholder="Search customers…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="w-full h-12 text-base border-gray-300 focus:border-black focus:ring-black"
                            />
                            {query && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute right-2 top-2 h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                                    onClick={() => setQuery('')}
                                >
                                    ×
                                </Button>
                            )}
                        </div>
                        <Button 
                            variant="default" 
                            onClick={startCreate} 
                            disabled={isSaving}
                            className="h-12 px-8 bg-black hover:bg-gray-800 text-white font-light"
                        >
                            New Customer
                        </Button>
                    </div>
                </div>
                {/* Table Section */}
                <div className="max-w-6xl mx-auto">
                    <CustomersTable
                        customers={filtered}
                        isLoading={isLoading}
                        onEdit={startEdit}
                        onDelete={setPendingDelete}
                    />
                </div>

                {/* Customer Form Modal */}
                <Dialog open={showForm} onOpenChange={(open) => !open && cancelForm()}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-light text-center">
                                {editing?.id ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                        Edit Customer
                                    </span>
                                ) : (
                                    'New Customer'
                                )}
                            </DialogTitle>
                            {editing?.id && editing.name && (
                                <p className="text-lg text-gray-600 text-center mt-1">{editing.name}</p>
                            )}
                        </DialogHeader>
                        <div className="mt-6">
                            <CustomerForm customer={editing || undefined} onCancel={cancelForm} onSave={saveCustomer} isSaving={isSaving} />
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={!!pendingDelete}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete customer</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the customer.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setPendingDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} disabled={isLoading}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}


