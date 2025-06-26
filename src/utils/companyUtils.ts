'use client';

import { CompanyInfo } from '../interfaces';
import { loadCompanyInfoFromFile, saveCompanyInfoToFile } from './fileSystemStorage';
import { synchronizeData } from './googleDriveStorage';

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
 * Save company information to the local file and trigger a sync with Google Drive.
 * @param info The company information object.
 */
export async function saveCompanyInfo(info: Partial<CompanyInfo>): Promise<CompanyInfo> {
    const now = new Date().toISOString();
    
    // Create the updated object, ensuring we have the full object if it exists.
    const updatedInfo: CompanyInfo = {
        ...(cachedCompanyInfo || {}),
        ...info,
        lastModified: now,
    } as CompanyInfo;

    cachedCompanyInfo = updatedInfo;

    // Save locally and then trigger a sync.
    await saveCompanyInfoToFile(updatedInfo);
    await synchronizeData(); // This will handle the upload to Drive.

    return updatedInfo;
} 