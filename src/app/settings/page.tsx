"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCompany } from '../../infrastructure/contexts/CompanyContext';
import { CompanyInfo } from '../../domain/models';

interface ValidationErrors {
    [key: string]: string;
}

export default function SettingsPage() {
    const { companyInfo, updateCompanyInfo, resetCompanyInfo, logoFile, setLogoFile } = useCompany();
    const [formData, setFormData] = useState<CompanyInfo>(companyInfo);
    const [isLoading, setIsLoading] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string>('');
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

    // Update form data when company info changes
    useEffect(() => {
        setFormData(companyInfo);
    }, [companyInfo]);

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

        // Email validation for website
        if (formData.website && formData.website.trim()) {
            if (!/^https?:\/\/.+\..+/.test(formData.website)) {
                errors.website = 'Please enter a valid website URL (e.g., https://example.com)';
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
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

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
            return;
        }

        setIsLoading(true);
        setSaveMessage('');
        try {
            await updateCompanyInfo(formData);
            setSaveMessage('Settings saved successfully!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            setSaveMessage('Error saving settings. Please try again.');
            console.error('Error saving settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async () => {
        if (window.confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
            setIsLoading(true);
            try {
                await resetCompanyInfo();
                setSaveMessage('Settings reset to defaults.');
                setTimeout(() => setSaveMessage(''), 3000);
            } catch (error) {
                setSaveMessage('Error resetting settings.');
                console.error('Error resetting settings:', error);
            } finally {
                setIsLoading(false);
            }
        }
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
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-neutral-600">Manage your company information and preferences</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        variant="outline" 
                        onClick={handleReset}
                        disabled={isLoading}
                    >
                        Reset to Defaults
                    </Button>
                    <Button 
                        onClick={handleSave}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            {saveMessage && (
                <div className={`p-3 rounded-md text-sm ${
                    saveMessage.includes('Error') 
                        ? 'bg-red-50 text-red-800 border border-red-200' 
                        : 'bg-green-50 text-green-800 border border-green-200'
                }`}>
                    {saveMessage}
                </div>
            )}

            {/* Company Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                    <CardDescription>Basic information about your company</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="company-name">Company Name *</Label>
                            <Input
                                id="company-name"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Enter company name"
                                className={validationErrors.name ? 'border-red-500 focus:border-red-500' : ''}
                            />
                            <FieldError error={validationErrors.name} />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="company-email">Email *</Label>
                            <Input
                                id="company-email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                placeholder="company@example.com"
                                className={validationErrors.email ? 'border-red-500 focus:border-red-500' : ''}
                            />
                            <FieldError error={validationErrors.email} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="company-address">Address *</Label>
                        <Textarea
                            id="company-address"
                            value={formData.address}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            placeholder="Street, City, Country"
                            rows={3}
                            className={validationErrors.address ? 'border-red-500 focus:border-red-500' : ''}
                        />
                        <FieldError error={validationErrors.address} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="company-phone">Phone</Label>
                            <Input
                                id="company-phone"
                                value={formData.phone}
                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company-website">Website</Label>
                            <Input
                                id="company-website"
                                value={formData.website}
                                onChange={(e) => handleInputChange('website', e.target.value)}
                                placeholder="https://www.example.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="company-logo">Company Logo</Label>
                        <div className="flex items-center gap-4">
                            <Input
                                id="company-logo"
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="flex-1"
                            />
                            {logoFile && (
                                <span className="text-sm text-neutral-600">
                                    {logoFile.name}
                                </span>
                            )}
                        </div>
                        {formData.logo_url && (
                            <div className="mt-2">
                                <img 
                                    src={formData.logo_url} 
                                    alt="Company logo" 
                                    className="h-16 w-auto object-contain border rounded"
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Business Type and Personal Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Business Type</CardTitle>
                    <CardDescription>Configure whether you're operating as a freelancer or company</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center space-x-3">
                        <Switch
                            id="is-freelancer"
                            checked={formData.is_freelancer || false}
                            onCheckedChange={(checked) => handleInputChange('is_freelancer', checked)}
                        />
                        <Label htmlFor="is-freelancer">Operating as Freelancer</Label>
                    </div>
                    
                    {formData.is_freelancer && (
                        <div className="space-y-2">
                            <Label htmlFor="full-name">Full Name *</Label>
                            <Input
                                id="full-name"
                                value={formData.full_name || ''}
                                onChange={(e) => handleInputChange('full_name', e.target.value)}
                                placeholder="Enter your full name"
                                className={validationErrors.full_name ? 'border-red-500 focus:border-red-500' : ''}
                            />
                            <FieldError error={validationErrors.full_name} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tax Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Tax Information</CardTitle>
                    <CardDescription>Tax and registration details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center space-x-3">
                        <Switch
                            id="vat-enabled"
                            checked={formData.is_vat_enabled}
                            onCheckedChange={(checked) => handleInputChange('is_vat_enabled', checked)}
                        />
                        <Label htmlFor="vat-enabled">VAT Enabled</Label>
                    </div>

                    {formData.is_vat_enabled && (
                        <div className="space-y-2">
                            <Label htmlFor="default-tax-rate">Default Tax Rate (%)</Label>
                            <Input
                                id="default-tax-rate"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={formData.default_tax_rate}
                                onChange={(e) => handleInputChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                                placeholder="19.00"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="tax-id">Tax ID</Label>
                            <Input
                                id="tax-id"
                                value={formData.tax_id}
                                onChange={(e) => handleInputChange('tax_id', e.target.value)}
                                placeholder="Tax identification number"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="tax-number">Tax Number</Label>
                            <Input
                                id="tax-number"
                                value={formData.tax_number}
                                onChange={(e) => handleInputChange('tax_number', e.target.value)}
                                placeholder="Tax number"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="registration-number">Registration Number</Label>
                            <Input
                                id="registration-number"
                                value={formData.registration_number}
                                onChange={(e) => handleInputChange('registration_number', e.target.value)}
                                placeholder="Company registration number"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="trade-register">Trade Register</Label>
                            <Input
                                id="trade-register"
                                value={formData.trade_register}
                                onChange={(e) => handleInputChange('trade_register', e.target.value)}
                                placeholder="Trade register information"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="electronic-address">Electronic Address</Label>
                        <Input
                            id="electronic-address"
                            value={formData.electronic_address}
                            onChange={(e) => handleInputChange('electronic_address', e.target.value)}
                            placeholder="Electronic invoicing address"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Banking Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Banking Information</CardTitle>
                    <CardDescription>Bank details for invoice payments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="bank-name">Bank Name</Label>
                        <Input
                            id="bank-name"
                            value={formData.bank_name}
                            onChange={(e) => handleInputChange('bank_name', e.target.value)}
                            placeholder="Bank name"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="account-name">Account Name</Label>
                        <Input
                            id="account-name"
                            value={formData.account_name}
                            onChange={(e) => handleInputChange('account_name', e.target.value)}
                            placeholder="Account holder name"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="iban">IBAN</Label>
                            <Input
                                id="iban"
                                value={formData.iban}
                                onChange={(e) => handleInputChange('iban', e.target.value)}
                                placeholder="International Bank Account Number"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="swift-bic">SWIFT/BIC</Label>
                            <Input
                                id="swift-bic"
                                value={formData.swift_bic}
                                onChange={(e) => handleInputChange('swift_bic', e.target.value)}
                                placeholder="Bank Identifier Code"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="account-number">Account Number</Label>
                        <Input
                            id="account-number"
                            value={formData.account_number}
                            onChange={(e) => handleInputChange('account_number', e.target.value)}
                            placeholder="Bank account number"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
