'use client';

import { CompanyInfo } from '../interfaces';
import { loadCompanyInfoFromFile, saveCompanyInfoToFile } from './fileSystemStorage';
import { DEFAULT_COMPANY_INFO } from '../contexts/CompanyContext';

let cachedCompanyInfo: CompanyInfo | null = null;

/**
 * Load company information, first from cache, then from file.
 * @returns The company information object or null.
 */
export async function loadCompanyInfo(): Promise<CompanyInfo | null> {
    if (cachedCompanyInfo) {
        return cachedCompanyInfo;
    }

    const fileInfo = await loadCompanyInfoFromFile();
    if (fileInfo) {
        cachedCompanyInfo = fileInfo;
        return fileInfo;
    }

    return null;
}

/**
 * Save company information to the local file. The manual backup process will handle uploading to Drive.
 * @param info The company information object.
 */
export async function saveCompanyInfo(info: Partial<CompanyInfo>): Promise<CompanyInfo> {
    const now = new Date().toISOString();
    
    // Ensure we're updating a complete object, using defaults as a base.
    const baseInfo = cachedCompanyInfo || DEFAULT_COMPANY_INFO;

    const updatedInfo: CompanyInfo = {
        ...baseInfo,
        ...info,
        lastModified: now,
    };

    cachedCompanyInfo = updatedInfo;

    // Save locally.
    await saveCompanyInfoToFile(updatedInfo);

    return updatedInfo;
} 