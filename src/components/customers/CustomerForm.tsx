"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomerData } from '@/domain/models';

export type CustomerFormProps = {
    customer?: Partial<CustomerData> | null;
    onCancel: () => void;
    onSave: (customer: Partial<CustomerData>) => Promise<void> | void;
    isSaving?: boolean;
};

export function CustomerForm({ customer, onCancel, onSave, isSaving = false }: CustomerFormProps) {
    // ===== LOCAL STATE =====
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [number, setNumber] = useState('');
    const [hourlyRate, setHourlyRate] = useState<string>('');

    // ===== EFFECTS =====
    useEffect(() => {
        setName(customer?.name || '');
        setAddress(customer?.address || '');
        setCity(customer?.city || '');
        setNumber(customer?.number || '');
        setHourlyRate(
            typeof customer?.hourlyRate === 'number' && !Number.isNaN(customer?.hourlyRate)
                ? String(customer?.hourlyRate)
                : ''
        );
    }, [customer]);

    // ===== ACTION HANDLERS =====
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        const payload: Partial<CustomerData> = {
            id: customer?.id,
            name: name.trim(),
            address: address.trim(),
            city: city.trim(),
            number: number.trim() || undefined,
            hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
            lastModified: new Date().toISOString(),
        };
        await onSave(payload);
    };

    // ===== RENDER =====
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Acme GmbH" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="number">Customer number</Label>
                            <Input id="number" value={number} onChange={e => setNumber(e.target.value)} placeholder="CUST-001" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="address">Address</Label>
                            <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street 1" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="Berlin" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hourlyRate">Hourly rate (EUR)</Label>
                            <Input id="hourlyRate" type="number" inputMode="decimal" step="0.01" min="0" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="100" />
                        </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                    Cancel
                </Button>
                <Button 
                    type="submit" 
                    variant="default" 
                    disabled={isSaving || !name.trim()}
                    className="min-w-[120px]"
                >
                    {isSaving ? (
                        <div className="flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                            Saving…
                        </div>
                    ) : customer?.id ? (
                        'Save changes'
                    ) : (
                        'Create customer'
                    )}
                </Button>
            </div>
        </form>
    );
}


