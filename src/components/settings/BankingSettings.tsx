"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CompanyInfo } from '@/domain/models';

interface ValidationErrors {
    [key: string]: string;
}

interface BankingSettingsProps {
    formData: CompanyInfo;
    validationErrors: ValidationErrors;
    onInputChange: (field: keyof CompanyInfo, value: string | number | boolean) => void;
}

const FieldError = ({ error }: { error?: string }) => {
    if (!error) return null;
    return <p className="text-sm text-red-600 mt-1">{error}</p>;
};

export default function BankingSettings({
    formData,
    validationErrors,
    onInputChange
}: BankingSettingsProps) {
    return (
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
                            onChange={(e) => onInputChange('bank_name', e.target.value)}
                            placeholder="Bank name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="account-name" className="text-sm font-medium">Account Name</Label>
                        <Input
                            id="account-name"
                            value={formData.account_name}
                            onChange={(e) => onInputChange('account_name', e.target.value)}
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
                            onChange={(e) => onInputChange('iban', e.target.value)}
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
                            onChange={(e) => onInputChange('swift_bic', e.target.value)}
                            placeholder="Bank Identifier Code"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="account-number" className="text-sm font-medium">Account Number</Label>
                    <Input
                        id="account-number"
                        value={formData.account_number}
                        onChange={(e) => onInputChange('account_number', e.target.value)}
                        placeholder="Bank account number"
                    />
                </div>
            </CardContent>
        </Card>
    );
}
