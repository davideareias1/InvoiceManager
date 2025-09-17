"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '../../infrastructure/contexts/CompanyContext';
import { CompanyInfo } from '../../domain/models';
import { useTaxSettings } from '@/infrastructure/contexts/TaxSettingsContext';
import { PersonalTaxSettings } from '@/domain/models';

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

    // Update form data when company info changes
    useEffect(() => {
        setFormData(companyInfo);
    }, [companyInfo]);

    // Sync local tax form when context changes
    useEffect(() => {
        setTaxForm(taxSettings);
    }, [taxSettings]);

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


    const handleTaxInputChange = (field: keyof PersonalTaxSettings, value: string | number | boolean) => {
        setTaxForm(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSaveTax = async () => {
        await updateTaxSettings(taxForm);
        setSaveMessage('Tax settings saved.');
        setSaveStatus('success');
        setTimeout(() => { setSaveMessage(''); setSaveStatus(''); }, 3000);
    };

    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setLogoFile(file);
    };

    const FieldError = ({ error }: { error?: string }) => {
        if (!error) return null;
        return <p className="text-sm text-red-600 mt-1">{error}</p>;
    };

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
                <TabsList className="grid w-full grid-cols-4 mb-4">
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="business">Business</TabsTrigger>
                    <TabsTrigger value="banking">Banking</TabsTrigger>
                    <TabsTrigger value="taxes">Taxes</TabsTrigger>
                </TabsList>

                {/* ===== COMPANY TAB ===== */}
                <TabsContent value="company" className="h-full overflow-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                        <Card className="h-fit">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Basic Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company-name" className="text-sm font-medium">Company Name *</Label>
                                    <Input
                                        id="company-name"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        placeholder="Enter company name"
                                        className={validationErrors.name ? 'border-red-500' : ''}
                                    />
                                    <FieldError error={validationErrors.name} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company-email" className="text-sm font-medium">Email *</Label>
                                    <Input
                                        id="company-email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        placeholder="company@example.com"
                                        className={validationErrors.email ? 'border-red-500' : ''}
                                    />
                                    <FieldError error={validationErrors.email} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company-address" className="text-sm font-medium">Address *</Label>
                                    <Textarea
                                        id="company-address"
                                        value={formData.address}
                                        onChange={(e) => handleInputChange('address', e.target.value)}
                                        placeholder="Street, City, Country"
                                        rows={2}
                                        className={validationErrors.address ? 'border-red-500' : ''}
                                    />
                                    <FieldError error={validationErrors.address} />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="company-phone" className="text-sm font-medium">Phone</Label>
                                        <Input
                                            id="company-phone"
                                            value={formData.phone}
                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                            placeholder="+1 (555) 123-4567"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="company-website" className="text-sm font-medium">Website</Label>
                                        <Input
                                            id="company-website"
                                            value={formData.website}
                                            onChange={(e) => handleInputChange('website', e.target.value)}
                                            placeholder="https://example.com"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="h-fit">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Logo & Branding</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company-logo" className="text-sm font-medium">Company Logo</Label>
                                    <Input
                                        id="company-logo"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                    />
                                    {logoFile && (
                                        <p className="text-sm text-neutral-600">{logoFile.name}</p>
                                    )}
                                </div>
                                {formData.logo_url && (
                                    <div className="mt-4 p-4 bg-neutral-50 rounded-lg">
                                        <img 
                                            src={formData.logo_url} 
                                            alt="Company logo" 
                                            className="h-20 w-auto object-contain"
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ===== BUSINESS TAB ===== */}
                <TabsContent value="business" className="h-full overflow-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                        <Card className="h-fit">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Business Type</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg">
                                    <Switch
                                        id="is-freelancer"
                                        checked={formData.is_freelancer || false}
                                        onCheckedChange={(checked) => handleInputChange('is_freelancer', checked)}
                                    />
                                    <Label htmlFor="is-freelancer" className="font-medium">Operating as Freelancer</Label>
                                </div>
                                
                                {formData.is_freelancer && (
                                    <div className="space-y-2">
                                        <Label htmlFor="full-name" className="text-sm font-medium">Full Name *</Label>
                                        <Input
                                            id="full-name"
                                            value={formData.full_name || ''}
                                            onChange={(e) => handleInputChange('full_name', e.target.value)}
                                            placeholder="Enter your full name"
                                            className={validationErrors.full_name ? 'border-red-500' : ''}
                                        />
                                        <FieldError error={validationErrors.full_name} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

{!formData.is_freelancer && (
                            <Card className="h-fit">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Registration Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="registration-number" className="text-sm font-medium">Registration Number</Label>
                                            <Input
                                                id="registration-number"
                                                value={formData.registration_number}
                                                onChange={(e) => handleInputChange('registration_number', e.target.value)}
                                                placeholder="Company reg. number"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="trade-register" className="text-sm font-medium">Trade Register</Label>
                                            <Input
                                                id="trade-register"
                                                value={formData.trade_register}
                                                onChange={(e) => handleInputChange('trade_register', e.target.value)}
                                                placeholder="Trade register info"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="electronic-address" className="text-sm font-medium">Electronic Address</Label>
                                        <Input
                                            id="electronic-address"
                                            value={formData.electronic_address}
                                            onChange={(e) => handleInputChange('electronic_address', e.target.value)}
                                            placeholder="Electronic invoicing address"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                {/* ===== BANKING TAB ===== */}
                <TabsContent value="banking" className="h-full overflow-auto">
                    <Card className="max-w-2xl mx-auto h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Banking Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="bank-name" className="text-sm font-medium">Bank Name</Label>
                                    <Input
                                        id="bank-name"
                                        value={formData.bank_name}
                                        onChange={(e) => handleInputChange('bank_name', e.target.value)}
                                        placeholder="Bank name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="account-name" className="text-sm font-medium">Account Name</Label>
                                    <Input
                                        id="account-name"
                                        value={formData.account_name}
                                        onChange={(e) => handleInputChange('account_name', e.target.value)}
                                        placeholder="Account holder name"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="iban" className="text-sm font-medium">IBAN</Label>
                                    <Input
                                        id="iban"
                                        value={formData.iban}
                                        onChange={(e) => handleInputChange('iban', e.target.value)}
                                        placeholder="International Bank Account Number"
                                        className={validationErrors.iban ? 'border-red-500' : ''}
                                    />
                                    <FieldError error={validationErrors.iban} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="swift-bic" className="text-sm font-medium">SWIFT/BIC</Label>
                                    <Input
                                        id="swift-bic"
                                        value={formData.swift_bic}
                                        onChange={(e) => handleInputChange('swift_bic', e.target.value)}
                                        placeholder="Bank Identifier Code"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="account-number" className="text-sm font-medium">Account Number</Label>
                                <Input
                                    id="account-number"
                                    value={formData.account_number}
                                    onChange={(e) => handleInputChange('account_number', e.target.value)}
                                    placeholder="Bank account number"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ===== TAXES TAB ===== */}
                <TabsContent value="taxes" className="h-full overflow-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                        <Card className="h-fit">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">VAT Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg">
                                    <Switch
                                        id="vat-enabled"
                                        checked={formData.is_vat_enabled}
                                        onCheckedChange={(checked) => handleInputChange('is_vat_enabled', checked)}
                                    />
                                    <Label htmlFor="vat-enabled" className="font-medium">VAT Enabled</Label>
                                </div>

                                {formData.is_vat_enabled && (
                                    <div className="space-y-2">
                                        <Label htmlFor="default-tax-rate" className="text-sm font-medium">Default Tax Rate (%)</Label>
                                        <Input
                                            id="default-tax-rate"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={formData.default_tax_rate}
                                            onChange={(e) => handleInputChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                                            placeholder="19.00"
                                            className={validationErrors.default_tax_rate ? 'border-red-500' : ''}
                                        />
                                        <FieldError error={validationErrors.default_tax_rate} />
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    {formData.is_vat_enabled && (
                                        <div className="space-y-2">
                                            <Label htmlFor="tax-id" className="text-sm font-medium">VAT ID (USt-IdNr.)</Label>
                                            <Input
                                                id="tax-id"
                                                value={formData.tax_id}
                                                onChange={(e) => handleInputChange('tax_id', e.target.value)}
                                                placeholder="DE123456789"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="tax-number" className="text-sm font-medium">Tax Number (Steuernummer)</Label>
                                        <Input
                                            id="tax-number"
                                            value={formData.tax_number}
                                            onChange={(e) => handleInputChange('tax_number', e.target.value)}
                                            placeholder="e.g. 12/345/67890"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="h-fit">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Personal Taxes (Germany)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="church-tax-rate" className="text-sm font-medium">Church Tax Rate (%)</Label>
                                        <Input
                                            id="church-tax-rate"
                                            type="number"
                                            min="0"
                                            max="20"
                                            step="1"
                                            value={taxForm.churchTaxRatePercent}
                                            onChange={e => handleTaxInputChange('churchTaxRatePercent', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="deductible-expenses" className="text-sm font-medium">Deductible Expenses (€)</Label>
                                        <Input
                                            id="deductible-expenses"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={taxForm.annualDeductibleExpenses}
                                            onChange={e => handleTaxInputChange('annualDeductibleExpenses', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="prepayments" className="text-sm font-medium">Prepayments YTD (€)</Label>
                                    <Input
                                        id="prepayments"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={taxForm.prepaymentsYearToDate}
                                        onChange={e => handleTaxInputChange('prepaymentsYearToDate', parseFloat(e.target.value) || 0)}
                                    />
                                </div>

                                <div className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg">
                                    <Switch
                                        id="joint-assessment"
                                        checked={taxForm.jointAssessment}
                                        onCheckedChange={checked => handleTaxInputChange('jointAssessment', checked)}
                                    />
                                    <Label htmlFor="joint-assessment" className="font-medium">Joint Assessment (married)</Label>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
