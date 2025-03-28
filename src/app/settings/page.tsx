'use client';

import { useRef, useState } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '../../utils/notifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
    UploadCloud, Building, FileText, CreditCard, X, AlertCircle, Info,
    Save, RefreshCw, User, Briefcase, Euro, Building2, Image, Check, AlertTriangle
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function SettingsPage() {
    const { companyInfo, updateCompanyInfo, resetCompanyInfo, logoFile, setLogoFile } = useCompany();
    const [activeTab, setActiveTab] = useState('general');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Convert form field changes to company info updates
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        updateCompanyInfo({ [name]: value });
        setSaveStatus('idle');
    };

    // Handle logo upload
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            setSaveStatus('idle');
        }
    };

    // Trigger file input click
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    // Clear logo
    const clearLogo = () => {
        setLogoFile(null);
        setSaveStatus('idle');
    };

    // Handle save with animation
    const handleSave = () => {
        setIsSaving(true);
        try {
            // Simulated save process
            setTimeout(() => {
                setSaveStatus('saved');
                setIsSaving(false);
                showSuccess('Company information saved successfully');
            }, 600);
        } catch (error) {
            setSaveStatus('error');
            setIsSaving(false);
            showError('Failed to save company information');
        }
    };

    // Handle reset with confirmation
    const handleReset = () => {
        const confirmed = window.confirm('Are you sure you want to reset all company information to defaults? This cannot be undone.');
        if (confirmed) {
            resetCompanyInfo();
            setSaveStatus('idle');
            showSuccess('Company information reset to defaults');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Company Settings</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Configure your business information for invoices and documents
                        </p>
                    </div>
                    <div className="flex items-center gap-3 self-stretch md:self-auto">
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            className="h-9 text-sm border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700"
                        >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Reset
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="h-9 text-sm bg-primary hover:bg-primary/90"
                            disabled={isSaving || saveStatus === 'saved'}
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Saving...
                                </>
                            ) : saveStatus === 'saved' ? (
                                <>
                                    <Check className="mr-1.5 h-3.5 w-3.5" />
                                    Saved
                                </>
                            ) : (
                                <>
                                    <Save className="mr-1.5 h-3.5 w-3.5" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Status indicator */}
                {saveStatus === 'error' && (
                    <Alert variant="destructive" className="max-w-3xl">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            There was a problem saving your company information. Please try again.
                        </AlertDescription>
                    </Alert>
                )}

                {/* New, modern tabs design */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="border-b border-gray-200">
                        <div className="px-6 pt-4">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="h-12 p-1 bg-gray-100/70 rounded-lg grid grid-cols-3 w-full max-w-xl">
                                    <TabsTrigger 
                                        value="general" 
                                        className={`font-medium rounded-md ${activeTab === 'general' ? 'bg-white shadow-sm' : 'hover:bg-gray-50 data-[state=active]:bg-white data-[state=active]:shadow-sm'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="h-4 w-4" />
                                            <span>Business Info</span>
                                        </div>
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="bank" 
                                        className={`font-medium rounded-md ${activeTab === 'bank' ? 'bg-white shadow-sm' : 'hover:bg-gray-50 data-[state=active]:bg-white data-[state=active]:shadow-sm'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4" />
                                            <span>Banking</span>
                                        </div>
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="branding" 
                                        className={`font-medium rounded-md ${activeTab === 'branding' ? 'bg-white shadow-sm' : 'hover:bg-gray-50 data-[state=active]:bg-white data-[state=active]:shadow-sm'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Image className="h-4 w-4" />
                                            <span>Branding</span>
                                        </div>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>

                    <div className="px-6 py-6">
                        <Tabs value={activeTab} className="w-full">
                            {/* General/Business Info Tab Content */}
                            <TabsContent value="general" className="mt-0 pt-2">
                                <div className="max-w-4xl space-y-8">
                                    {/* Freelancer or Company toggle section */}
                                    <div className="bg-gray-50 rounded-lg p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <label className="text-base font-medium text-gray-900 flex items-center gap-1.5">
                                                    <User className="h-4 w-4 text-blue-600" />
                                                    I am a freelancer or sole proprietor
                                                </label>
                                                <p className="text-sm text-gray-600">
                                                    Enable if you're operating as an individual rather than a registered company
                                                </p>
                                            </div>
                                            <div>
                                                <Switch
                                                    id="is_freelancer"
                                                    checked={companyInfo.is_freelancer || false}
                                                    onCheckedChange={(checked) => {
                                                        updateCompanyInfo({ is_freelancer: checked });
                                                        if (checked && companyInfo.full_name) {
                                                            updateCompanyInfo({ account_name: companyInfo.full_name });
                                                        }
                                                    }}
                                                    className="data-[state=checked]:bg-blue-600"
                                                />
                                            </div>
                                        </div>

                                        {companyInfo.is_freelancer && (
                                            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md">
                                                <div className="space-y-3 max-w-xl">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <Label htmlFor="full_name" className="font-medium text-gray-900 flex items-center gap-1.5">
                                                            Full Legal Name
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger>
                                                                        <Info className="h-3.5 w-3.5 text-gray-500" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p className="text-xs">Your full name is required for invoices as a freelancer</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </Label>
                                                        {!companyInfo.full_name && (
                                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs font-normal">
                                                                Required
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <Input
                                                        id="full_name"
                                                        name="full_name"
                                                        value={companyInfo.full_name || ''}
                                                        onChange={(e) => {
                                                            const newFullName = e.target.value;
                                                            handleChange(e);
                                                            if (companyInfo.is_freelancer) {
                                                                updateCompanyInfo({ account_name: newFullName });
                                                            }
                                                        }}
                                                        placeholder="Your full legal name"
                                                        className={`border ${!companyInfo.full_name ? 'border-red-300 focus:ring-red-500' : 'border-blue-200 focus:ring-blue-500'} bg-white h-10`}
                                                    />
                                                    {!companyInfo.full_name && (
                                                        <p className="text-xs text-red-600">
                                                            Full name is required for freelancers and will appear on invoices
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Company Info Section */}
                                    <div>
                                        <h2 className="text-lg font-medium text-gray-900 mb-5 flex items-center gap-2">
                                            <Building className="h-5 w-5 text-gray-700" />
                                            Company Details
                                        </h2>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                            <div className="space-y-2.5">
                                                <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                                                    Company Name
                                                </Label>
                                                <Input
                                                    id="name"
                                                    name="name"
                                                    value={companyInfo.name}
                                                    onChange={handleChange}
                                                    placeholder="Your Company Name"
                                                    className="border-gray-300 focus:ring-primary/30 h-10"
                                                />
                                            </div>

                                            <div className="space-y-2.5">
                                                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                                                    Email Address
                                                </Label>
                                                <Input
                                                    id="email"
                                                    name="email"
                                                    type="email"
                                                    value={companyInfo.email}
                                                    onChange={handleChange}
                                                    placeholder="contact@yourcompany.com"
                                                    className="border-gray-300 focus:ring-primary/30 h-10"
                                                />
                                            </div>

                                            <div className="space-y-2.5">
                                                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                                                    Phone Number
                                                </Label>
                                                <Input
                                                    id="phone"
                                                    name="phone"
                                                    value={companyInfo.phone}
                                                    onChange={handleChange}
                                                    placeholder="+49 123 4567890"
                                                    className="border-gray-300 focus:ring-primary/30 h-10"
                                                />
                                            </div>

                                            <div className="space-y-2.5">
                                                <Label htmlFor="website" className="text-sm font-medium text-gray-700">
                                                    Website
                                                </Label>
                                                <Input
                                                    id="website"
                                                    name="website"
                                                    value={companyInfo.website}
                                                    onChange={handleChange}
                                                    placeholder="https://yourcompany.com"
                                                    className="border-gray-300 focus:ring-primary/30 h-10"
                                                />
                                            </div>

                                            <div className="space-y-2.5 md:col-span-2">
                                                <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                                                    Business Address
                                                </Label>
                                                <Textarea
                                                    id="address"
                                                    name="address"
                                                    value={companyInfo.address}
                                                    onChange={handleChange}
                                                    placeholder="Your complete business address"
                                                    rows={3}
                                                    className="border-gray-300 focus:ring-primary/30 resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="bg-gray-200" />

                                    {/* Legal Information Section */}
                                    <div>
                                        <h2 className="text-lg font-medium text-gray-900 mb-5 flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-gray-700" />
                                            Legal Information
                                        </h2>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                            <div className="space-y-2.5">
                                                <Label htmlFor="tax_id" className="text-sm font-medium text-gray-700 flex items-center">
                                                    <span>VAT ID / Tax Number</span>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger className="ml-1.5">
                                                                <Info className="h-3.5 w-3.5 text-gray-400" />
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                <p className="text-xs">For German businesses: your Umsatzsteuer-Identifikationsnummer (USt-IdNr.)</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </Label>
                                                <Input
                                                    id="tax_id"
                                                    name="tax_id"
                                                    value={companyInfo.tax_id}
                                                    onChange={handleChange}
                                                    placeholder="DE123456789"
                                                    className="border-gray-300 focus:ring-primary/30 h-10"
                                                />
                                            </div>

                                            <div className="space-y-2.5">
                                                <Label htmlFor="tax_number" className="text-sm font-medium text-gray-700 flex items-center">
                                                    <span>Steuernummer</span>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger className="ml-1.5">
                                                                <Info className="h-3.5 w-3.5 text-gray-400" />
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                <p className="text-xs">Your German tax number format: 12/345/67890</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </Label>
                                                <Input
                                                    id="tax_number"
                                                    name="tax_number"
                                                    value={companyInfo.tax_number}
                                                    onChange={handleChange}
                                                    placeholder="12/345/67890"
                                                    className="border-gray-300 focus:ring-primary/30 h-10"
                                                />
                                            </div>

                                            <div className="space-y-2.5">
                                                <Label htmlFor="trade_register" className="text-sm font-medium text-gray-700">
                                                    Trade Register Entry
                                                </Label>
                                                <Input
                                                    id="trade_register"
                                                    name="trade_register"
                                                    value={companyInfo.trade_register}
                                                    onChange={handleChange}
                                                    placeholder="e.g., HRB 12345, Amtsgericht Berlin"
                                                    className="border-gray-300 focus:ring-primary/30 h-10"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* VAT Settings Section */}
                                    <div className="bg-gray-50 rounded-lg p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                                            <div className="space-y-1">
                                                <label className="text-base font-medium text-gray-900 flex items-center gap-1.5">
                                                    <Euro className="h-4 w-4 text-emerald-600" />
                                                    Enable VAT
                                                </label>
                                                <p className="text-sm text-gray-600">
                                                    Turn off if you operate under "Kleinunternehmerregelung" (§19 UStG)
                                                </p>
                                            </div>
                                            <div>
                                                <Switch
                                                    id="is_vat_enabled"
                                                    checked={companyInfo.is_vat_enabled}
                                                    onCheckedChange={(checked) =>
                                                        updateCompanyInfo({ is_vat_enabled: checked })
                                                    }
                                                    className="data-[state=checked]:bg-emerald-600"
                                                />
                                            </div>
                                        </div>

                                        {companyInfo.is_vat_enabled ? (
                                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-md">
                                                <div className="space-y-3 max-w-xl">
                                                    <Label htmlFor="default_tax_rate" className="font-medium text-gray-900">
                                                        Default Tax Rate (%)
                                                    </Label>
                                                    <div className="flex gap-2 items-center">
                                                        <Input
                                                            id="default_tax_rate"
                                                            name="default_tax_rate"
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={companyInfo.default_tax_rate}
                                                            onChange={(e) =>
                                                                updateCompanyInfo({
                                                                    default_tax_rate: parseFloat(e.target.value) || 0
                                                                })
                                                            }
                                                            placeholder="19"
                                                            className="border-emerald-200 focus:ring-emerald-500 h-10 w-28 text-center"
                                                        />
                                                        <span className="text-gray-700">%</span>
                                                    </div>
                                                    <div className="flex gap-3 mt-3 text-xs text-gray-600">
                                                        <button 
                                                            type="button" 
                                                            className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 rounded text-emerald-700"
                                                            onClick={() => updateCompanyInfo({ default_tax_rate: 19 })}
                                                        >
                                                            Standard: 19%
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 rounded text-emerald-700"
                                                            onClick={() => updateCompanyInfo({ default_tax_rate: 7 })}
                                                        >
                                                            Reduced: 7%
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                                                <Info className="h-4 w-4" />
                                                <AlertTitle>VAT Exemption Notice</AlertTitle>
                                                <AlertDescription>
                                                    Your invoices will include the "Kleinunternehmerregelung" notice according to §19 UStG.
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Banking Tab */}
                            <TabsContent value="bank" className="mt-0 pt-2">
                                <div className="max-w-4xl space-y-8">
                                    <div>
                                        <h2 className="text-lg font-medium text-gray-900 mb-5 flex items-center gap-2">
                                            <Building2 className="h-5 w-5 text-gray-700" />
                                            Banking Information
                                        </h2>
                                        
                                        <div className="space-y-5">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                                <div className="space-y-2.5">
                                                    <Label htmlFor="bank_name" className="text-sm font-medium text-gray-700">
                                                        Bank Name
                                                    </Label>
                                                    <Input
                                                        id="bank_name"
                                                        name="bank_name"
                                                        value={companyInfo.bank_name}
                                                        onChange={handleChange}
                                                        placeholder="e.g., Deutsche Bank"
                                                        className="border-gray-300 focus:ring-primary/30 h-10"
                                                    />
                                                </div>

                                                <div className="space-y-2.5">
                                                    <Label htmlFor="account_name" className="text-sm font-medium text-gray-700">
                                                        Account Holder Name
                                                    </Label>
                                                    <Input
                                                        id="account_name"
                                                        name="account_name"
                                                        value={companyInfo.account_name}
                                                        onChange={handleChange}
                                                        placeholder={
                                                            companyInfo.is_freelancer 
                                                                ? (companyInfo.full_name || "Your Full Name") 
                                                                : (companyInfo.name || "Your Company Name")
                                                        }
                                                        className="border-gray-300 focus:ring-primary/30 h-10"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                                                <h3 className="text-base font-medium text-gray-800 mb-4">Account Details</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                                    <div className="space-y-2.5">
                                                        <Label htmlFor="iban" className="text-sm font-medium text-gray-700 flex items-center">
                                                            <span>IBAN</span>
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="ml-1.5">
                                                                        <Info className="h-3.5 w-3.5 text-gray-400" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-xs">International Bank Account Number</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </Label>
                                                        <Input
                                                            id="iban"
                                                            name="iban"
                                                            value={companyInfo.iban}
                                                            onChange={handleChange}
                                                            placeholder="DE89 3704 0044 0532 0130 00"
                                                            className="border-gray-300 focus:ring-primary/30 h-10 bg-white"
                                                        />
                                                    </div>

                                                    <div className="space-y-2.5">
                                                        <Label htmlFor="swift_bic" className="text-sm font-medium text-gray-700 flex items-center">
                                                            <span>SWIFT / BIC</span>
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="ml-1.5">
                                                                        <Info className="h-3.5 w-3.5 text-gray-400" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top">
                                                                        <p className="text-xs">Bank Identifier Code for international transfers</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </Label>
                                                        <Input
                                                            id="swift_bic"
                                                            name="swift_bic"
                                                            value={companyInfo.swift_bic}
                                                            onChange={handleChange}
                                                            placeholder="DEUTDEBBXXX"
                                                            className="border-gray-300 focus:ring-primary/30 h-10 bg-white"
                                                        />
                                                    </div>

                                                    <div className="space-y-2.5">
                                                        <Label htmlFor="account_number" className="text-sm font-medium text-gray-700">
                                                            Account Number (optional)
                                                        </Label>
                                                        <Input
                                                            id="account_number"
                                                            name="account_number"
                                                            value={companyInfo.account_number}
                                                            onChange={handleChange}
                                                            placeholder="Account number"
                                                            className="border-gray-300 focus:ring-primary/30 h-10 bg-white"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    <Info className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-medium text-blue-800 mb-1">Security Note</h4>
                                                    <p className="text-xs text-blue-700">
                                                        Your banking information is stored locally on your device and will only be included on invoices that you generate. 
                                                        This app does not transmit your banking details over the internet.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 max-w-lg">
                                        <h3 className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                            Privacy Tip
                                        </h3>
                                        <p className="text-xs text-yellow-700">
                                            Consider including only the minimum payment information necessary in your invoices.
                                            For regular clients, you might want to communicate your full banking details separately.
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Branding Tab */}
                            <TabsContent value="branding" className="mt-0 pt-2">
                                <div className="max-w-4xl">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {/* Logo Upload Section */}
                                        <div className="md:col-span-1 space-y-6">
                                            <div>
                                                <h2 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                                                    <Image className="h-5 w-5 text-gray-700" />
                                                    Company Logo
                                                </h2>
                                                <p className="text-sm text-gray-600">
                                                    Upload your logo to display on invoices and documents
                                                </p>
                                            </div>
                                            
                                            <div className="flex flex-col items-center bg-gray-50 border border-gray-200 rounded-lg p-6">
                                                <div className="relative mb-4">
                                                    <Avatar className="h-32 w-32 shadow-sm border-2 border-white">
                                                        <AvatarImage 
                                                            src={companyInfo.logo_url || ''} 
                                                            alt="Company Logo" 
                                                            className="object-contain"
                                                        />
                                                        <AvatarFallback className="text-2xl bg-primary/5 text-primary font-medium">
                                                            {companyInfo.name ? companyInfo.name.charAt(0).toUpperCase() : 'C'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {companyInfo.logo_url && (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white shadow-sm hover:bg-gray-100"
                                                            onClick={clearLogo}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>

                                                <div className="space-y-3 text-center">
                                                    <Button
                                                        variant="outline"
                                                        type="button"
                                                        onClick={triggerFileInput}
                                                        className="bg-white border-gray-300"
                                                    >
                                                        <UploadCloud className="mr-2 h-4 w-4" />
                                                        {logoFile ? 'Change Logo' : 'Upload Logo'}
                                                    </Button>

                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        onChange={handleLogoUpload}
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                    />

                                                    <p className="text-xs text-gray-500">
                                                        Recommended: 200×200px or larger, PNG or JPG
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                                <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                                                    <Info className="h-4 w-4 text-blue-600" />
                                                    Image Guidelines
                                                </h3>
                                                <ul className="text-xs text-blue-700 space-y-1.5 list-disc pl-4">
                                                    <li>Use a square or circular logo when possible</li>
                                                    <li>For best results, upload a transparent PNG</li>
                                                    <li>Maximum file size: 2MB</li>
                                                </ul>
                                            </div>
                                        </div>
                                        
                                        {/* Preview Section */}
                                        <div className="md:col-span-2 space-y-6">
                                            <div>
                                                <h2 className="text-lg font-medium text-gray-900 mb-2">
                                                    Brand Preview
                                                </h2>
                                                <p className="text-sm text-gray-600">
                                                    See how your brand will appear on invoices and documents
                                                </p>
                                            </div>
                                            
                                            {/* Invoice Header Preview */}
                                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                                                    <h3 className="text-sm font-medium text-gray-700">Invoice Header Preview</h3>
                                                </div>
                                                <div className="p-6 bg-white">
                                                    <div className="flex flex-col items-start md:flex-row md:items-center gap-4 p-4 border-b border-gray-100 pb-6">
                                                        <Avatar className="h-16 w-16 bg-gray-100">
                                                            <AvatarImage src={companyInfo.logo_url || ''} alt="Company Logo" className="object-contain" />
                                                            <AvatarFallback className="text-xl bg-primary/5 text-primary">
                                                                {companyInfo.name ? companyInfo.name.charAt(0).toUpperCase() : 'C'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            {companyInfo.is_freelancer && companyInfo.full_name ? (
                                                                <>
                                                                    <p className="font-bold text-lg text-gray-900">{companyInfo.full_name}</p>
                                                                    {companyInfo.name && companyInfo.name !== 'Your Company Name' && (
                                                                        <p className="text-sm text-gray-600">{companyInfo.name}</p>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <p className="font-bold text-lg text-gray-900">
                                                                    {companyInfo.name || 'Your Company Name'}
                                                                </p>
                                                            )}
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                {companyInfo.address 
                                                                    ? companyInfo.address.split('\n')[0] 
                                                                    : 'Your Address Line 1'
                                                                }
                                                            </p>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                                                                {companyInfo.email && (
                                                                    <span>{companyInfo.email}</span>
                                                                )}
                                                                {companyInfo.phone && (
                                                                    <span>{companyInfo.phone}</span>
                                                                )}
                                                                {companyInfo.website && (
                                                                    <span>{companyInfo.website}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex justify-between pt-5">
                                                        <div className="space-y-1">
                                                            <h4 className="text-xs font-medium uppercase text-gray-500">Invoice To:</h4>
                                                            <p className="text-sm font-medium">Client Name</p>
                                                            <p className="text-xs text-gray-600">Client Address</p>
                                                        </div>
                                                        <div className="space-y-1 text-right">
                                                            <h4 className="text-xs font-medium uppercase text-gray-500">Invoice Details:</h4>
                                                            <p className="text-sm font-medium"># INV-2023-001</p>
                                                            <p className="text-xs text-gray-600">Date: 01.06.2023</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Company Info Validation */}
                                            {companyInfo.is_freelancer && !companyInfo.full_name && (
                                                <Alert variant="destructive" className="mt-4">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertTitle>Full Name Required</AlertTitle>
                                                    <AlertDescription>
                                                        As a freelancer, you must provide your full name in the Business Info tab.
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                            
                                            {/* Typography Preview */}
                                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                                                    <h3 className="text-sm font-medium text-gray-700">Typography & Colors</h3>
                                                </div>
                                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-gray-500">Primary Heading</p>
                                                        <p className="text-lg font-bold text-gray-900">Invoice #INV-2023-001</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-gray-500">Secondary Heading</p>
                                                        <p className="text-base font-medium text-gray-800">Payment Details</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-gray-500">Regular Text</p>
                                                        <p className="text-sm text-gray-600">Invoice for services rendered</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-gray-500">Status Indicators</p>
                                                        <div className="flex gap-2">
                                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Paid</span>
                                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">Pending</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    );
} 