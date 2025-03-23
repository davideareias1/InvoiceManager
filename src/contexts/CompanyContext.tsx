'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CompanyInfo } from '../interfaces';

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
    full_name: ''          // Empty by default
};

// Local storage key
const COMPANY_INFO_STORAGE_KEY = 'invoice-company-info';

interface CompanyContextType {
    companyInfo: CompanyInfo;
    updateCompanyInfo: (info: Partial<CompanyInfo>) => void;
    resetCompanyInfo: () => void;
    logoFile: File | null;
    setLogoFile: (file: File | null) => void;
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
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load company info from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const savedInfo = localStorage.getItem(COMPANY_INFO_STORAGE_KEY);
                if (savedInfo) {
                    const parsedInfo = JSON.parse(savedInfo) as CompanyInfo;
                    setCompanyInfo(parsedInfo);

                    // If there's a logo URL and it's a data URL, try to convert it to a File
                    if (parsedInfo.logo_url && parsedInfo.logo_url.startsWith('data:')) {
                        try {
                            const dataURLToFile = (dataUrl: string, filename: string): File => {
                                const arr = dataUrl.split(',');
                                const mime = arr[0].match(/:(.*?);/)![1];
                                const bstr = atob(arr[1]);
                                let n = bstr.length;
                                const u8arr = new Uint8Array(n);
                                while (n--) {
                                    u8arr[n] = bstr.charCodeAt(n);
                                }
                                return new File([u8arr], filename, { type: mime });
                            };

                            setLogoFile(dataURLToFile(parsedInfo.logo_url, 'company_logo.png'));
                        } catch (error) {
                            console.error('Error loading logo from data URL:', error);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading company info from localStorage:', error);
            } finally {
                setIsInitialized(true);
            }
        }
    }, []);

    // Save to localStorage whenever companyInfo changes
    useEffect(() => {
        if (isInitialized && typeof window !== 'undefined') {
            localStorage.setItem(COMPANY_INFO_STORAGE_KEY, JSON.stringify(companyInfo));
        }
    }, [companyInfo, isInitialized]);

    // Update company info
    const updateCompanyInfo = (info: Partial<CompanyInfo>) => {
        setCompanyInfo(prev => ({ ...prev, ...info }));
    };

    // Reset company info to defaults
    const resetCompanyInfo = () => {
        setCompanyInfo(DEFAULT_COMPANY_INFO);
        setLogoFile(null);
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
        setLogoFile: handleLogoFileChange
    };

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    );
} 