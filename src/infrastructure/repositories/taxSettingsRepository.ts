'use client';

import { PersonalTaxSettings, TaxSettingsRepository } from '@/domain/models';
import { loadPersonalTaxSettingsFromFile, savePersonalTaxSettingsToFile } from '@/infrastructure/filesystem/fileSystemStorage';

let cachedSettings: PersonalTaxSettings | null = null;

export const DEFAULT_TAX_SETTINGS: PersonalTaxSettings = {
    id: 'personal_tax_settings',
    churchTaxRatePercent: 0,
    isChurchMember: false,
    federalState: undefined,
    annualDeductibleExpenses: 0,
    prepaymentsYearToDate: 0,
    jointAssessment: false,
    partnerTaxableAnnualProjection: 0,
    lastModified: new Date().toISOString(),
};

export async function loadPersonalTaxSettings(): Promise<PersonalTaxSettings | null> {
    if (cachedSettings) return cachedSettings;
    const file = await loadPersonalTaxSettingsFromFile();
    if (!file) return null;
    // Merge with defaults to ensure new fields exist
    cachedSettings = { ...DEFAULT_TAX_SETTINGS, ...(file as PersonalTaxSettings) };
    return cachedSettings;
}

export async function savePersonalTaxSettings(settings: Partial<PersonalTaxSettings>): Promise<PersonalTaxSettings> {
    const now = new Date().toISOString();
    const base = cachedSettings || DEFAULT_TAX_SETTINGS;
    const updated: PersonalTaxSettings = { ...base, ...settings, lastModified: now };
    cachedSettings = updated;
    await savePersonalTaxSettingsToFile(updated);
    return updated;
}

export const taxSettingsRepositoryAdapter: TaxSettingsRepository = {
    loadPersonalTaxSettings,
    savePersonalTaxSettings,
};


