"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '../../infrastructure/contexts/CompanyContext';
import { CompanyInfo } from '../../domain/models';
import { useTaxSettings } from '@/infrastructure/contexts/TaxSettingsContext';
import { PersonalTaxSettings } from '@/domain/models';
import CompanySettings from '@/components/settings/CompanySettings';
import BusinessSettings from '@/components/settings/BusinessSettings';
import BankingSettings from '@/components/settings/BankingSettings';
import TaxSettings from '@/components/settings/TaxSettings';
import SyncSettings from '@/components/settings/SyncSettings';

interface ValidationErrors {
    [key: string]: string;
}

export default function SettingsPage() {
    const { companyInfo, updateCompanyInfo, logoFile, setLogoFile } = useCompany();
    const [formData, setFormData] = useState<CompanyInfo>(companyInfo);
    const { taxSettings, updateTaxSettings } = useTaxSettings();
    const [taxForm, setTaxForm] = useState<PersonalTaxSettings>(taxSettings);
    const [isLoading, setIsLoading] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string>('');
    const [saveStatus, setSaveStatus] = useState<'success' | 'error' | ''>('');
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [activeTab, setActiveTab] = useState('company');

    // ===== EFFECTS =====
    // Update form data when company info changes
    useEffect(() => {
        setFormData(companyInfo);
    }, [companyInfo]);

    // Sync local tax form when context changes
    useEffect(() => {
        setTaxForm(taxSettings);
    }, [taxSettings]);

    // ===== VALIDATION =====
    const validateForm = (): boolean => {
        const errors: ValidationErrors = {};

        // Required fields validation
        if (!formData.name.trim()) {
            errors.name = 'Company name is required';
        }

        if (!formData.email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Please enter a valid email address';
        }

        if (!formData.address.trim()) {
            errors.address = 'Address is required';
        }

        // Freelancer specific validation
        if (formData.is_freelancer && !formData.full_name?.trim()) {
            errors.full_name = 'Full name is required for freelancers';
        }

        // Tax rate validation
        if (formData.is_vat_enabled) {
            if (formData.default_tax_rate < 0 || formData.default_tax_rate > 100) {
                errors.default_tax_rate = 'Tax rate must be between 0 and 100';
            }
        }

        // Website validation: allow bare domains or full URLs
        if (formData.website && formData.website.trim()) {
            const website = formData.website.trim();
            const domainOrUrlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
            if (!domainOrUrlRegex.test(website)) {
                errors.website = 'Please enter a valid website (e.g., example.com or https://example.com)';
            }
        }

        // IBAN basic validation (simplified)
        if (formData.iban && formData.iban.trim()) {
            const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/;
            const cleanIban = formData.iban.replace(/\s/g, '').toUpperCase();
            if (!ibanRegex.test(cleanIban)) {
                errors.iban = 'Please enter a valid IBAN format';
            }
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // ===== ACTION HANDLERS =====
    const handleInputChange = (field: keyof CompanyInfo, value: string | number | boolean) => {
        setFormData(prev => {
            // When VAT is toggled off, clear VAT-specific fields
            if (field === 'is_vat_enabled' && value === false) {
                return {
                    ...prev,
                    is_vat_enabled: false,
                    tax_id: '',
                    default_tax_rate: 0,
                };
            }
            return {
                ...prev,
                [field]: value
            };
        });

        // Clear validation error for this field when user starts typing
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleTaxInputChange = (field: keyof PersonalTaxSettings, value: string | number | boolean) => {
        setTaxForm(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSave = async () => {
        if (!validateForm()) {
            setSaveMessage('Please fix the validation errors before saving.');
            setSaveStatus('error');
            return;
        }

        setIsLoading(true);
        setSaveMessage('');
        setSaveStatus('');
        try {
            const websiteNormalized = formData.website && formData.website.trim() && !/^https?:\/\//i.test(formData.website)
                ? `https://${formData.website.trim()}`
                : formData.website;
            const normalizedForm: CompanyInfo = { ...formData, website: websiteNormalized };
            await updateCompanyInfo(normalizedForm);
            await updateTaxSettings(taxForm);
            setSaveMessage('Settings saved successfully!');
            setSaveStatus('success');
            setFormData(normalizedForm);
            setTimeout(() => { setSaveMessage(''); setSaveStatus(''); }, 3000);
        } catch (error) {
            setSaveMessage('Error saving settings. Please try again.');
            setSaveStatus('error');
            console.error('Error saving settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setLogoFile(file);
    };

    // ===== RENDER =====
    return (
        <div className="p-6 h-[calc(100vh-4rem)] max-w-6xl mx-auto">
            {/* ===== HEADER ===== */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-neutral-600">Manage your company information and preferences</p>
                </div>
                <Button 
                    onClick={handleSave}
                    disabled={isLoading}
                    size="sm"
                >
                    {isLoading ? 'Saving...' : 'Save'}
                </Button>
            </div>

            {/* ===== STATUS MESSAGE ===== */}
            {saveMessage && (
                <div className={`p-3 rounded-lg text-sm mb-4 ${
                    saveStatus === 'error'
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-green-50 text-green-800 border border-green-200'
                }`}>
                    {saveMessage}
                </div>
            )}

            {/* ===== TABS NAVIGATION ===== */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100%-120px)]">
                <TabsList className="grid w-full grid-cols-5 mb-4">
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="business">Business</TabsTrigger>
                    <TabsTrigger value="banking">Banking</TabsTrigger>
                    <TabsTrigger value="taxes">Taxes</TabsTrigger>
                    <TabsTrigger value="sync">Sync</TabsTrigger>
                </TabsList>

                {/* ===== COMPANY TAB ===== */}
                <TabsContent value="company" className="h-full overflow-auto">
                    <CompanySettings
                        formData={formData}
                        validationErrors={validationErrors}
                        logoFile={logoFile}
                        onInputChange={handleInputChange}
                        onLogoUpload={handleLogoUpload}
                    />
                </TabsContent>

                {/* ===== BUSINESS TAB ===== */}
                <TabsContent value="business" className="h-full overflow-auto">
                    <BusinessSettings
                        formData={formData}
                        validationErrors={validationErrors}
                        onInputChange={handleInputChange}
                    />
                </TabsContent>

                {/* ===== BANKING TAB ===== */}
                <TabsContent value="banking" className="h-full overflow-auto">
                    <BankingSettings
                        formData={formData}
                        validationErrors={validationErrors}
                        onInputChange={handleInputChange}
                    />
                </TabsContent>

                {/* ===== TAXES TAB ===== */}
                <TabsContent value="taxes" className="h-full overflow-auto">
                    <TaxSettings
                        formData={formData}
                        taxForm={taxForm}
                        validationErrors={validationErrors}
                        onInputChange={handleInputChange}
                        onTaxInputChange={handleTaxInputChange}
                    />
                </TabsContent>

                {/* ===== SYNC TAB ===== */}
                <TabsContent value="sync" className="h-full overflow-auto">
                    <SyncSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}