'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { PersonalTaxSettings } from '@/domain/models';
import { loadPersonalTaxSettings, savePersonalTaxSettings, DEFAULT_TAX_SETTINGS } from '@/infrastructure/repositories/taxSettingsRepository';
import { useFileSystem } from './FileSystemContext';

interface TaxSettingsContextType {
    taxSettings: PersonalTaxSettings;
    updateTaxSettings: (settings: Partial<PersonalTaxSettings>) => Promise<void>;
    resetTaxSettings: () => Promise<void>;
    reload: () => Promise<void>;
}

const TaxSettingsContext = createContext<TaxSettingsContextType | undefined>(undefined);

export function useTaxSettings() {
    const ctx = useContext(TaxSettingsContext);
    if (!ctx) throw new Error('useTaxSettings must be used within a TaxSettingsProvider');
    return ctx;
}

export function TaxSettingsProvider({ children }: { children: ReactNode }) {
    const { isInitialized, hasPermission } = useFileSystem();
    const [taxSettings, setTaxSettings] = useState<PersonalTaxSettings>(DEFAULT_TAX_SETTINGS);

    const reload = useCallback(async () => {
        if (!isInitialized || !hasPermission) return;
        const loaded = await loadPersonalTaxSettings();
        if (loaded) setTaxSettings(loaded);
    }, [isInitialized, hasPermission]);

    useEffect(() => {
        reload();
    }, [reload]);

    const updateTaxSettings = async (settings: Partial<PersonalTaxSettings>) => {
        const updated = await savePersonalTaxSettings(settings);
        setTaxSettings(updated);
    };

    const resetTaxSettings = async () => {
        const updated = await savePersonalTaxSettings({ ...DEFAULT_TAX_SETTINGS });
        setTaxSettings(updated);
    };

    return (
        <TaxSettingsContext.Provider value={{ taxSettings, updateTaxSettings, resetTaxSettings, reload }}>
            {children}
        </TaxSettingsContext.Provider>
    );
}


