'use client';

import { CompanyInfo } from '../../domain/models';
import { loadCompanyInfoFromFile, saveCompanyInfoToFile } from '../filesystem/fileSystemStorage';
import { DEFAULT_COMPANY_INFO } from '../contexts/CompanyContext';
import type { CompanyRepository } from '../../domain/models';
import { markDataDirty } from '../sync/syncState';
import { saveCompanyInfoToGoogleDrive } from '../google/googleDriveStorage';

let cachedCompanyInfo: CompanyInfo | null = null;

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

export async function saveCompanyInfo(info: Partial<CompanyInfo>): Promise<CompanyInfo> {
    const now = new Date().toISOString();
    const baseInfo = cachedCompanyInfo || DEFAULT_COMPANY_INFO;

    const updatedInfo: CompanyInfo = {
        ...baseInfo,
        ...info,
        lastModified: now,
    };

    cachedCompanyInfo = updatedInfo;
    await saveCompanyInfoToFile(updatedInfo);
    await saveCompanyInfoToGoogleDrive(updatedInfo);
    markDataDirty();
    return updatedInfo;
}

export const companyRepositoryAdapter: CompanyRepository = {
    loadCompanyInfo,
    saveCompanyInfo,
}; 