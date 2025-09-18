"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CompanyInfo } from '@/domain/models';

interface ValidationErrors {
    [key: string]: string;
}

interface CompanySettingsProps {
    formData: CompanyInfo;
    validationErrors: ValidationErrors;
    logoFile: File | null;
    onInputChange: (field: keyof CompanyInfo, value: string | number | boolean) => void;
    onLogoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const FieldError = ({ error }: { error?: string }) => {
    if (!error) return null;
    return <p className="text-sm text-red-600 mt-1">{error}</p>;
};

export default function CompanySettings({
    formData,
    validationErrors,
    logoFile,
    onInputChange,
    onLogoUpload
}: CompanySettingsProps) {
    return (
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
                            onChange={(e) => onInputChange('name', e.target.value)}
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
                            onChange={(e) => onInputChange('email', e.target.value)}
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
                            onChange={(e) => onInputChange('address', e.target.value)}
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
                                onChange={(e) => onInputChange('phone', e.target.value)}
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="company-website" className="text-sm font-medium">Website</Label>
                            <Input
                                id="company-website"
                                value={formData.website}
                                onChange={(e) => onInputChange('website', e.target.value)}
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
                            onChange={onLogoUpload}
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
    );
}
