"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CompanyInfo } from '@/domain/models';

interface ValidationErrors {
    [key: string]: string;
}

interface BusinessSettingsProps {
    formData: CompanyInfo;
    validationErrors: ValidationErrors;
    onInputChange: (field: keyof CompanyInfo, value: string | number | boolean) => void;
}

const FieldError = ({ error }: { error?: string }) => {
    if (!error) return null;
    return <p className="text-sm text-red-600 mt-1">{error}</p>;
};

export default function BusinessSettings({
    formData,
    validationErrors,
    onInputChange
}: BusinessSettingsProps) {
    return (
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
                            onCheckedChange={(checked) => onInputChange('is_freelancer', checked)}
                        />
                        <Label htmlFor="is-freelancer" className="font-medium">Operating as Freelancer</Label>
                    </div>
                    
                    {formData.is_freelancer && (
                        <div className="space-y-2">
                            <Label htmlFor="full-name" className="text-sm font-medium">Full Name *</Label>
                            <Input
                                id="full-name"
                                value={formData.full_name || ''}
                                onChange={(e) => onInputChange('full_name', e.target.value)}
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
                                    onChange={(e) => onInputChange('registration_number', e.target.value)}
                                    placeholder="Company reg. number"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="trade-register" className="text-sm font-medium">Trade Register</Label>
                                <Input
                                    id="trade-register"
                                    value={formData.trade_register}
                                    onChange={(e) => onInputChange('trade_register', e.target.value)}
                                    placeholder="Trade register info"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="electronic-address" className="text-sm font-medium">Electronic Address</Label>
                            <Input
                                id="electronic-address"
                                value={formData.electronic_address}
                                onChange={(e) => onInputChange('electronic_address', e.target.value)}
                                placeholder="Electronic invoicing address"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
