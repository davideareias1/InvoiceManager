'use client';

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { TimeEntry, TimeSheetMonth, TimeStats } from '@/domain/models';
import { timeTrackingRepositoryAdapter as repo } from '@/infrastructure/repositories/timeTrackingRepository';
import { calculateDurationMinutes, computeStats } from '@/application/time/presentation';

interface TimeTrackingContextType {
    isSaving: boolean;
    isLoading: boolean;
    timesheet: TimeSheetMonth | null;
    stats: TimeStats | null;
    loadMonth: (customerId: string, customerName: string, year: number, month: number, hourlyRate?: number) => Promise<void>;
    upsertEntry: (entry: Omit<TimeEntry, 'durationMinutes' | 'id'> & { id?: string }) => Promise<void>;
    deleteEntry: (dateISO: string) => Promise<void>;
    listAvailableMonths: (customerId: string, customerName: string) => Promise<Array<{ year: number; month: number }>>;
    createMonth: (customerId: string, customerName: string, year: number, month: number, hourlyRate?: number) => Promise<void>;
}

const TimeTrackingContext = createContext<TimeTrackingContextType | undefined>(undefined);

export function useTimeTracking() {
    const ctx = useContext(TimeTrackingContext);
    if (!ctx) throw new Error('useTimeTracking must be used within a TimeTrackingProvider');
    return ctx;
}

interface ProviderProps { children: React.ReactNode; }

export function TimeTrackingProvider({ children }: ProviderProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [timesheet, setTimesheet] = useState<TimeSheetMonth | null>(null);
    const [stats, setStats] = useState<TimeStats | null>(null);
    const [hourlyRate, setHourlyRate] = useState<number | undefined>(undefined);

    const loadMonth = useCallback(async (customerId: string, customerName: string, year: number, month: number, rate?: number) => {
        setIsLoading(true);
        try {
            setHourlyRate(rate);
            const ts = await repo.loadMonth(customerId, customerName, year, month);
            setTimesheet(ts);
            setStats(computeStats(ts, rate));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const upsert = useCallback(async (entry: Omit<TimeEntry, 'durationMinutes' | 'id'> & { id?: string }) => {
        if (!timesheet) return;
        setIsSaving(true);
        try {
            const isEffectivelyEmpty = (
                (!entry.start || entry.start.trim() === '') &&
                (!entry.end || entry.end.trim() === '') &&
                (typeof entry.pauseMinutes !== 'number' || Number.isNaN(entry.pauseMinutes)) &&
                (!entry.notes || entry.notes.trim() === '')
            );

            if (isEffectivelyEmpty) {
                const ts = await repo.deleteEntry(timesheet.customerId, timesheet.customerName, timesheet.year, timesheet.month, entry.date);
                setTimesheet(ts);
                setStats(computeStats(ts, hourlyRate));
                return;
            }

            const newEntry: TimeEntry = {
                id: entry.id || crypto.randomUUID(),
                date: entry.date,
                start: entry.start,
                pauseMinutes: entry.pauseMinutes,
                end: entry.end,
                durationMinutes: calculateDurationMinutes(entry.start, entry.end, entry.pauseMinutes),
                notes: entry.notes,
            };
            const ts = await repo.upsertEntry(timesheet.customerId, timesheet.customerName, timesheet.year, timesheet.month, newEntry);
            setTimesheet(ts);
            setStats(computeStats(ts, hourlyRate));
        } finally {
            setIsSaving(false);
        }
    }, [timesheet, hourlyRate]);

    const remove = useCallback(async (dateISO: string) => {
        if (!timesheet) return;
        setIsSaving(true);
        try {
            const ts = await repo.deleteEntry(timesheet.customerId, timesheet.customerName, timesheet.year, timesheet.month, dateISO);
            setTimesheet(ts);
            setStats(computeStats(ts, hourlyRate));
        } finally {
            setIsSaving(false);
        }
    }, [timesheet, hourlyRate]);

    const listAvailableMonths = useCallback(async (customerId: string, customerName: string) => {
        return repo.listAvailableMonths(customerId, customerName);
    }, []);

    const createMonth = useCallback(async (customerId: string, customerName: string, year: number, month: number, rate?: number) => {
        setIsSaving(true);
        try {
            setHourlyRate(rate);
            // Load current state (creates empty in-memory if not present), then save to ensure file exists
            const ts = await repo.loadMonth(customerId, customerName, year, month);
            const saved = await repo.saveMonth(ts);
            setTimesheet(saved);
            setStats(computeStats(saved, rate));
        } finally {
            setIsSaving(false);
        }
    }, []);

    const value = useMemo(() => ({
        isSaving,
        isLoading,
        timesheet,
        stats,
        loadMonth,
        upsertEntry: upsert,
        deleteEntry: remove,
        listAvailableMonths,
        createMonth,
    }), [isSaving, isLoading, timesheet, stats, loadMonth, upsert, remove, listAvailableMonths, createMonth]);

    return (
        <TimeTrackingContext.Provider value={value}>
            {children}
        </TimeTrackingContext.Provider>
    );
}



