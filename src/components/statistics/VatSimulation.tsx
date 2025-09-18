"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/shared/formatters';
import { VatSimulationMetrics } from '@/application/statistics';

export function VatSimulation({ initial, onRateChange }: { initial: VatSimulationMetrics; onRateChange: (rate: number) => void }) {
    const [rate, setRate] = useState<number>(initial.rate);

    const handleChange = (v: number) => {
        setRate(v);
        onRateChange(v);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>VAT Simulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <div className="text-sm text-neutral-600">Taxable Net (YTD)</div>
                        <div className="text-lg font-semibold">{formatCurrency(initial.taxableNetYTD)}</div>
                    </div>
                    <div>
                        <div className="text-sm text-neutral-600">Reverse Charge (YTD)</div>
                        <div className="text-lg font-semibold">{formatCurrency(initial.reverseChargeNetYTD)}</div>
                    </div>
                    <div>
                        <div className="text-sm text-neutral-600">Non-Taxable (YTD)</div>
                        <div className="text-lg font-semibold">{formatCurrency(initial.nonTaxableNetYTD)}</div>
                    </div>
                    <div>
                        <div className="text-sm text-neutral-600">VAT Rate (%)</div>
                        <Input type="number" min="0" max="100" step="0.1" value={rate}
                               onChange={e => handleChange(parseFloat(e.target.value) || 0)} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 border rounded">
                        <div className="font-medium mb-2">Scenario A: Add VAT on top (net invariant)</div>
                        <div className="flex justify-between"><span>VAT Due</span><span>{formatCurrency(initial.scenarioNetInvariant.vatDue)}</span></div>
                        <div className="flex justify-between"><span>Gross Increase</span><span>{formatCurrency(initial.scenarioNetInvariant.grossIncrease)}</span></div>
                    </div>
                    <div className="p-3 border rounded">
                        <div className="font-medium mb-2">Scenario B: Keep gross fixed (net reduced)</div>
                        <div className="flex justify-between"><span>VAT Due</span><span>{formatCurrency(initial.scenarioGrossInvariant.vatDue)}</span></div>
                        <div className="flex justify-between"><span>Net After VAT</span><span>{formatCurrency(initial.scenarioGrossInvariant.netAfterVat)}</span></div>
                        <div className="flex justify-between"><span>Revenue Delta</span><span>{formatCurrency(initial.scenarioGrossInvariant.revenueDelta)}</span></div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


