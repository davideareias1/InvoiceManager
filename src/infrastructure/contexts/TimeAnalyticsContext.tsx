'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CustomerData } from '@/domain/models';
import { customerRepositoryAdapter } from '@/infrastructure/repositories/customerRepository';
import { timeTrackingRepositoryAdapter } from '@/infrastructure/repositories/timeTrackingRepository';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';

export interface CustomerTimeIndex {
    customerId: string;
    customerName: string;
    hourlyRate?: number;
    perDayMinutes: Record<string, number>; // key: YYYY-MM-DD -> minutes
    perMonthMinutes: Record<string, number>; // key: YYYY-MM -> minutes
}

interface TimeAnalyticsContextType {
    isLoading: boolean;
    customers: Pick<CustomerData, 'id' | 'name' | 'hourlyRate'>[];
    index: CustomerTimeIndex[];
    availableYears: number[];
    reload: () => Promise<void>;
}

const TimeAnalyticsContext = createContext<TimeAnalyticsContextType | null>(null);

export function useTimeAnalytics(): TimeAnalyticsContextType {
    const ctx = useContext(TimeAnalyticsContext);
    if (!ctx) throw new Error('useTimeAnalytics must be used within TimeAnalyticsProvider');
    return ctx;
}

export function TimeAnalyticsProvider({ children }: { children: React.ReactNode }) {
    const { isInitialized, hasPermission } = useFileSystem();
    const [isLoading, setIsLoading] = useState(false);
    const [customers, setCustomers] = useState<Pick<CustomerData, 'id' | 'name' | 'hourlyRate'>[]>([]);
    const [index, setIndex] = useState<CustomerTimeIndex[]>([]);

    const buildIndex = useCallback(async () => {
        if (!isInitialized || !hasPermission) return;
        setIsLoading(true);
        try {
            const customerList = await customerRepositoryAdapter.loadCustomers();
            const activeCustomers = (customerList || []).filter(c => !c.isDeleted);
            setCustomers(activeCustomers.map(c => ({ id: c.id, name: c.name, hourlyRate: c.hourlyRate })));

            const results: CustomerTimeIndex[] = [];

            // For each customer, list available months and load monthly sheets
            for (const c of activeCustomers) {
                const months = await timeTrackingRepositoryAdapter.listAvailableMonths(c.id, c.name);
                const perDay: Record<string, number> = {};
                const perMonth: Record<string, number> = {};
                for (const m of months) {
                    const ts = await timeTrackingRepositoryAdapter.loadMonth(c.id, c.name, m.year, m.month);
                    let monthMinutes = 0;
                    for (const e of ts.entries) {
                        const minutes = Math.max(0, e.durationMinutes || 0);
                        monthMinutes += minutes;
                        if (minutes > 0) {
                            perDay[e.date] = (perDay[e.date] || 0) + minutes;
                        }
                    }
                    const monthKey = `${ts.year}-${String(ts.month).padStart(2, '0')}`;
                    perMonth[monthKey] = (perMonth[monthKey] || 0) + monthMinutes;
                }
                results.push({
                    customerId: c.id,
                    customerName: c.name,
                    hourlyRate: c.hourlyRate,
                    perDayMinutes: perDay,
                    perMonthMinutes: perMonth,
                });
            }

            setIndex(results);
        } finally {
            setIsLoading(false);
        }
    }, [isInitialized, hasPermission]);

    useEffect(() => {
        buildIndex();
    }, [buildIndex]);

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        index.forEach(ci => {
            Object.keys(ci.perMonthMinutes).forEach(key => {
                const y = Number(key.split('-')[0]);
                if (!Number.isNaN(y)) years.add(y);
            });
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [index]);

    const value = useMemo(() => ({
        isLoading,
        customers,
        index,
        availableYears,
        reload: buildIndex,
    }), [isLoading, customers, index, availableYears, buildIndex]);

    return (
        <TimeAnalyticsContext.Provider value={value}>
            {children}
        </TimeAnalyticsContext.Provider>
    );
}


