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
import { UploadCloud, Building, FileText, CreditCard, X, AlertCircle, Info, Save, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function CompanyPage() {
    const { companyInfo, updateCompanyInfo, resetCompanyInfo, logoFile, setLogoFile } = useCompany();
    const [activeTab, setActiveTab] = useState('general');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
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

    // Handle save
    const handleSave = () => {
        try {
            setSaveStatus('saved');
            showSuccess('Company information saved successfully');
        } catch (error) {
            setSaveStatus('error');
            showError('Failed to save company information');
        }
    };

    // Handle reset
    const handleReset = () => {
        if (confirm('Are you sure you want to reset all company information to defaults?')) {
            resetCompanyInfo();
            setSaveStatus('idle');
            showSuccess('Company information reset to defaults');
        }
    };

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Company Settings</h1>
                    <p className="text-muted-foreground">Configure your business information for invoices and documents</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        className="flex items-center"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="flex items-center"
                        variant={saveStatus === 'saved' ? 'outline' : 'default'}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        {saveStatus === 'saved' ? 'Saved' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 w-full max-w-md mb-2">
                    <TabsTrigger value="general" className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        <span>General</span>
                    </TabsTrigger>
                    <TabsTrigger value="bank" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Banking</span>
                    </TabsTrigger>
                    <TabsTrigger value="branding" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Branding</span>
                    </TabsTrigger>
                </TabsList>

                {/* General Information Tab */}
                <TabsContent value="general">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle>Company Details</CardTitle>
                            <CardDescription>
                                This information will appear on all your invoices
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="bg-slate-50 p-4 rounded-lg mb-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="is_freelancer" className="text-base">I am a freelancer</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Enable if you're operating as a sole proprietor/freelancer rather than a registered company
                                        </p>
                                    </div>
                                    <Switch
                                        id="is_freelancer"
                                        checked={companyInfo.is_freelancer || false}
                                        onCheckedChange={(checked) => {
                                            // Update is_freelancer status
                                            updateCompanyInfo({ is_freelancer: checked });

                                            // If enabling freelancer mode and full name exists, set account_name to full_name
                                            if (checked && companyInfo.full_name) {
                                                updateCompanyInfo({ account_name: companyInfo.full_name });
                                            }
                                        }}
                                    />
                                </div>

                                {companyInfo.is_freelancer && (
                                    <div className="space-y-2 max-w-md">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="full_name" className="required">Full Name</Label>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Info className="h-4 w-4 text-muted-foreground" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Your full name is required and will appear on invoices</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <Input
                                            id="full_name"
                                            name="full_name"
                                            value={companyInfo.full_name || ''}
                                            onChange={(e) => {
                                                const newFullName = e.target.value;
                                                // Update the full_name field
                                                handleChange(e);

                                                // Also update account_name if in freelancer mode
                                                if (companyInfo.is_freelancer) {
                                                    updateCompanyInfo({ account_name: newFullName });
                                                }
                                            }}
                                            placeholder="Your full legal name"
                                            required
                                            className={!companyInfo.full_name ? 'border-red-500' : ''}
                                        />
                                        {!companyInfo.full_name && (
                                            <p className="text-sm text-red-500">
                                                Full name is required for freelancers
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Company Name</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        value={companyInfo.name}
                                        onChange={handleChange}
                                        placeholder="Your Company Name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={companyInfo.email}
                                        onChange={handleChange}
                                        placeholder="contact@yourcompany.com"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        name="phone"
                                        value={companyInfo.phone}
                                        onChange={handleChange}
                                        placeholder="+1 (123) 456-7890"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="website">Website</Label>
                                    <Input
                                        id="website"
                                        name="website"
                                        value={companyInfo.website}
                                        onChange={handleChange}
                                        placeholder="https://yourcompany.com"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="address">Address</Label>
                                    <Textarea
                                        id="address"
                                        name="address"
                                        value={companyInfo.address}
                                        onChange={handleChange}
                                        placeholder="Your company address"
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="tax_id">VAT ID / Tax Number</Label>
                                    <Input
                                        id="tax_id"
                                        name="tax_id"
                                        value={companyInfo.tax_id}
                                        onChange={handleChange}
                                        placeholder="Your tax ID or VAT number"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="tax_number">Steuernummer</Label>
                                    <Input
                                        id="tax_number"
                                        name="tax_number"
                                        value={companyInfo.tax_number}
                                        onChange={handleChange}
                                        placeholder="Your German tax number (Steuernummer)"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="trade_register">Trade Register</Label>
                                    <Input
                                        id="trade_register"
                                        name="trade_register"
                                        value={companyInfo.trade_register}
                                        onChange={handleChange}
                                        placeholder="e.g., HRB 12345, Amtsgericht Berlin"
                                    />
                                </div>
                            </div>

                            <Separator className="my-2" />

                            <div className="bg-slate-50 p-4 rounded-lg">
                                <h3 className="text-base font-medium mb-3">VAT Settings</h3>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="is_vat_enabled" className="text-base">Enable VAT</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Toggle this off if you operate under "Kleinunternehmerregelung" (§19 UStG)
                                        </p>
                                    </div>
                                    <Switch
                                        id="is_vat_enabled"
                                        checked={companyInfo.is_vat_enabled}
                                        onCheckedChange={(checked) =>
                                            updateCompanyInfo({ is_vat_enabled: checked })
                                        }
                                    />
                                </div>

                                {companyInfo.is_vat_enabled && (
                                    <div className="space-y-2 max-w-md">
                                        <Label htmlFor="default_tax_rate">Default Tax Rate (%)</Label>
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
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Standard German VAT rate is 19%, reduced rate is 7%
                                        </p>
                                    </div>
                                )}

                                {!companyInfo.is_vat_enabled && (
                                    <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>VAT Exemption Notice</AlertTitle>
                                        <AlertDescription>
                                            Your invoices will include the "Kleinunternehmerregelung" notice according to §19 UStG.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Banking Information Tab */}
                <TabsContent value="bank">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle>Banking Details</CardTitle>
                            <CardDescription>
                                Payment information that will appear on your invoices
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="bank_name">Bank Name</Label>
                                    <Input
                                        id="bank_name"
                                        name="bank_name"
                                        value={companyInfo.bank_name}
                                        onChange={handleChange}
                                        placeholder="Bank name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="account_name">Account Name</Label>
                                    <Input
                                        id="account_name"
                                        name="account_name"
                                        value={companyInfo.account_name}
                                        onChange={handleChange}
                                        placeholder="Account name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="account_number">Account Number</Label>
                                    <Input
                                        id="account_number"
                                        name="account_number"
                                        value={companyInfo.account_number}
                                        onChange={handleChange}
                                        placeholder="Account number"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="iban">IBAN</Label>
                                    <Input
                                        id="iban"
                                        name="iban"
                                        value={companyInfo.iban}
                                        onChange={handleChange}
                                        placeholder="IBAN"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="swift_bic">SWIFT / BIC Code</Label>
                                    <Input
                                        id="swift_bic"
                                        name="swift_bic"
                                        value={companyInfo.swift_bic}
                                        onChange={handleChange}
                                        placeholder="SWIFT/BIC code"
                                    />
                                </div>
                            </div>

                            <Alert variant="default" className="bg-gray-50 border-gray-200 mt-4">
                                <Info className="h-4 w-4" />
                                <AlertTitle>Note</AlertTitle>
                                <AlertDescription>
                                    Your bank information is stored locally and will only be included on invoices that you generate.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Branding Tab */}
                <TabsContent value="branding">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle>Branding</CardTitle>
                            <CardDescription>
                                Add your company logo and branding elements
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center space-y-4 py-4">
                                <div className="relative">
                                    <Avatar className="h-28 w-28 border shadow">
                                        <AvatarImage src={companyInfo.logo_url || ''} alt="Company Logo" />
                                        <AvatarFallback className="text-xl bg-primary/10 text-primary">
                                            {companyInfo.name ? companyInfo.name.charAt(0).toUpperCase() : 'C'}
                                        </AvatarFallback>
                                    </Avatar>
                                    {companyInfo.logo_url && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                            onClick={clearLogo}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>

                                <div className="flex flex-col items-center space-y-2">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        onClick={triggerFileInput}
                                        className="flex items-center gap-2"
                                    >
                                        <UploadCloud className="h-4 w-4" />
                                        {logoFile ? 'Change Logo' : 'Upload Logo'}
                                    </Button>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleLogoUpload}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                    />

                                    <p className="text-xs text-muted-foreground mt-1">
                                        Recommended: Square image, 200x200 pixels or larger
                                    </p>
                                </div>
                            </div>

                            <Separator className="my-6" />

                            <div className="space-y-4">
                                <h3 className="font-medium text-base">Logo Preview</h3>
                                <div className="border rounded-lg p-6 flex justify-center items-center bg-gray-50">
                                    <div className="flex items-center space-x-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={companyInfo.logo_url || ''} alt="Company Logo" />
                                            <AvatarFallback className="text-sm bg-primary/10 text-primary">
                                                {companyInfo.name ? companyInfo.name.charAt(0).toUpperCase() : 'C'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            {companyInfo.is_freelancer && companyInfo.full_name ? (
                                                <>
                                                    <p className="font-medium">{companyInfo.full_name}</p>
                                                    <p className="text-sm text-muted-foreground">{companyInfo.name || 'Your Company Name'}</p>
                                                </>
                                            ) : (
                                                <p className="font-medium">{companyInfo.name || 'Your Company Name'}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                {companyInfo.address ? companyInfo.address.split('\n')[0] : 'Your Address'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    This shows how your logo will appear on invoices and other documents.
                                </p>
                                
                                {companyInfo.is_freelancer && !companyInfo.full_name && (
                                    <Alert variant="destructive" className="mt-4">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Full Name Required</AlertTitle>
                                        <AlertDescription>
                                            As a freelancer, you must provide your full name in the General settings tab.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
} 