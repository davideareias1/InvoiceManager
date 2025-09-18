"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CompanyInfo } from '@/domain/models';
import { PersonalTaxSettings } from '@/domain/models';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ValidationErrors {
    [key: string]: string;
}

interface TaxSettingsProps {
    formData: CompanyInfo;
    taxForm: PersonalTaxSettings;
    validationErrors: ValidationErrors;
    onInputChange: (field: keyof CompanyInfo, value: string | number | boolean) => void;
    onTaxInputChange: (field: keyof PersonalTaxSettings, value: string | number | boolean) => void;
}

const FieldError = ({ error }: { error?: string }) => {
    if (!error) return null;
    return <p className="text-sm text-red-600 mt-1">{error}</p>;
};

export default function TaxSettings({
    formData,
    taxForm,
    validationErrors,
    onInputChange,
    onTaxInputChange
}: TaxSettingsProps) {
    return (
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
                            onCheckedChange={(checked) => onInputChange('is_vat_enabled', checked)}
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
                                onChange={(e) => onInputChange('default_tax_rate', parseFloat(e.target.value) || 0)}
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
                                    onChange={(e) => onInputChange('tax_id', e.target.value)}
                                    placeholder="DE123456789"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="tax-number" className="text-sm font-medium">Tax Number (Steuernummer)</Label>
                            <Input
                                id="tax-number"
                                value={formData.tax_number}
                                onChange={(e) => onInputChange('tax_number', e.target.value)}
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
                    <div className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg">
                        <Switch
                            id="church-member"
                            checked={!!taxForm.isChurchMember}
                            onCheckedChange={checked => onTaxInputChange('isChurchMember', checked)}
                        />
                        <Label htmlFor="church-member" className="font-medium">Church Member (Kirchensteuer)</Label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="federal-state" className="text-sm font-medium">Bundesland</Label>
                            <Select
                                value={taxForm.federalState || ''}
                                onValueChange={(v) => {
                                    onTaxInputChange('federalState', v as any);
                                    // Auto-set church tax rate if member
                                    const lowRate = v === 'BW' || v === 'BY' ? 8 : 9;
                                    if (taxForm.isChurchMember) onTaxInputChange('churchTaxRatePercent', lowRate);
                                }}
                            >
                                <SelectTrigger id="federal-state">
                                    <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="BW">Baden-Württemberg</SelectItem>
                                    <SelectItem value="BY">Bayern</SelectItem>
                                    <SelectItem value="BE">Berlin</SelectItem>
                                    <SelectItem value="BB">Brandenburg</SelectItem>
                                    <SelectItem value="HB">Bremen</SelectItem>
                                    <SelectItem value="HH">Hamburg</SelectItem>
                                    <SelectItem value="HE">Hessen</SelectItem>
                                    <SelectItem value="MV">Mecklenburg-Vorpommern</SelectItem>
                                    <SelectItem value="NI">Niedersachsen</SelectItem>
                                    <SelectItem value="NW">Nordrhein-Westfalen</SelectItem>
                                    <SelectItem value="RP">Rheinland-Pfalz</SelectItem>
                                    <SelectItem value="SL">Saarland</SelectItem>
                                    <SelectItem value="SN">Sachsen</SelectItem>
                                    <SelectItem value="ST">Sachsen-Anhalt</SelectItem>
                                    <SelectItem value="SH">Schleswig-Holstein</SelectItem>
                                    <SelectItem value="TH">Thüringen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="church-tax-rate" className="text-sm font-medium">Church Tax Rate (%)</Label>
                            <Input
                                id="church-tax-rate"
                                type="number"
                                min="0"
                                max="20"
                                step="1"
                                value={taxForm.churchTaxRatePercent}
                                onChange={e => onTaxInputChange('churchTaxRatePercent', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="deductible-expenses" className="text-sm font-medium">Deductible Expenses (€)</Label>
                            <Input
                                id="deductible-expenses"
                                type="number"
                                min="0"
                                step="0.01"
                                value={taxForm.annualDeductibleExpenses}
                                onChange={e => onTaxInputChange('annualDeductibleExpenses', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="prepayments" className="text-sm font-medium">Prepayments YTD (€)</Label>
                            <Input
                                id="prepayments"
                                type="number"
                                min="0"
                                step="0.01"
                                value={taxForm.prepaymentsYearToDate}
                                onChange={e => onTaxInputChange('prepaymentsYearToDate', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg">
                        <Switch
                            id="joint-assessment"
                            checked={taxForm.jointAssessment}
                            onCheckedChange={checked => onTaxInputChange('jointAssessment', checked)}
                        />
                        <Label htmlFor="joint-assessment" className="font-medium">Joint Assessment (married)</Label>
                    </div>

                    {taxForm.jointAssessment && (
                        <div className="space-y-2">
                            <Label htmlFor="partner-taxable" className="text-sm font-medium">Partner taxable income (annual, €)</Label>
                            <Input
                                id="partner-taxable"
                                type="number"
                                min="0"
                                step="0.01"
                                value={taxForm.partnerTaxableAnnualProjection || 0}
                                onChange={e => onTaxInputChange('partnerTaxableAnnualProjection', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
