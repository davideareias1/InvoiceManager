'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CompanyInfo } from '../interfaces';
import { loadCompanyInfo, saveCompanyInfo } from '../utils/companyUtils';
import { useFileSystem } from './FileSystemContext';

// Default company info
const DEFAULT_COMPANY_INFO: CompanyInfo = {
    name: 'Your Company Name',
    address: 'Your Company Address\nCity, Country',
    phone: '',
    email: '',
    website: '',
    tax_id: '',
    tax_number: '',
    registration_number: '',
    trade_register: '',
    electronic_address: '',
    bank_name: '',
    account_name: '',
    account_number: '',
    iban: '',
    swift_bic: '',
    logo_url: '',
    is_vat_enabled: true,  // VAT is enabled by default
    default_tax_rate: 19,   // Default to standard German VAT rate
    is_freelancer: false,  // Default to company mode
    full_name: '',         // Empty by default
    lastModified: new Date().toISOString(),
};

interface CompanyContextType {
    companyInfo: CompanyInfo;
    updateCompanyInfo: (info: Partial<CompanyInfo>) => void;
    resetCompanyInfo: () => void;
    logoFile: File | null;
    setLogoFile: (file: File | null) => void;
    loadAndSetCompanyInfo: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function useCompany() {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error('useCompany must be used within a CompanyProvider');
    }
    return context;
}

interface CompanyProviderProps {
    children: ReactNode;
}

export function CompanyProvider({ children }: CompanyProviderProps) {
    const { isInitialized: isFileSystemInitialized, hasPermission } = useFileSystem();
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const loadAndSetCompanyInfo = async () => {
        if (!isFileSystemInitialized || !hasPermission) return;
        try {
            const savedInfo = await loadCompanyInfo();
            if (savedInfo) {
                setCompanyInfo(savedInfo);
                if (savedInfo.logo_url && savedInfo.logo_url.startsWith('data:')) {
                    // Logic to convert data URL to File
                    const dataURLToFile = (dataUrl: string, filename: string): File => {
                        const arr = dataUrl.split(',');
                        const mimeMatch = arr[0].match(/:(.*?);/);
                        if (!mimeMatch) throw new Error("Invalid data URL");
                        const mime = mimeMatch[1];
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while (n--) {
                            u8arr[n] = bstr.charCodeAt(n);
                        }
                        return new File([u8arr], filename, { type: mime });
                    };
                    setLogoFile(dataURLToFile(savedInfo.logo_url, 'company_logo.png'));
                }
            }
        } catch (error) {
            console.error('Error explicitly loading company info:', error);
        }
    };

    // Load company info from file on mount, but only after file system is ready
    useEffect(() => {
        const fetchCompanyInfo = async () => {
            if (isInitialized || !isFileSystemInitialized || !hasPermission) return;
            
            await loadAndSetCompanyInfo();
            setIsInitialized(true);
        };
        fetchCompanyInfo();
    }, [isInitialized, isFileSystemInitialized, hasPermission]);


    // Update company info and save to file
    const updateCompanyInfo = async (info: Partial<CompanyInfo>) => {
        const newInfo = { ...companyInfo, ...info };
        setCompanyInfo(newInfo);
        await saveCompanyInfo(newInfo);
    };

    // Reset company info to defaults and save
    const resetCompanyInfo = async () => {
        setCompanyInfo(DEFAULT_COMPANY_INFO);
        setLogoFile(null);
        await saveCompanyInfo(DEFAULT_COMPANY_INFO);
    };

    // Handle logo file upload
    const handleLogoFileChange = (file: File | null) => {
        setLogoFile(file);

        if (file) {
            // Convert file to data URL and store in company info
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                updateCompanyInfo({ logo_url: dataUrl });
            };
            reader.readAsDataURL(file);
        } else {
            // Clear logo URL if file is null
            updateCompanyInfo({ logo_url: '' });
        }
    };

    const value = {
        companyInfo,
        updateCompanyInfo,
        resetCompanyInfo,
        logoFile,
        setLogoFile: handleLogoFileChange,
        loadAndSetCompanyInfo
    };

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    );
} 