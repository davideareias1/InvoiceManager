"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const TAX_COLOR = '#f59e0b';
const REMAINDER_COLOR = '#E5E7EB';
const PREPAYMENT_COLOR = '#8b5cf6';

export function IncomeTaxes({
    baseYTD,
    incomeTax,
    churchTax,
    soli,
    prepayments,
    centerTotal,
    incomeTaxCurrent: _incomeTaxCurrent,
    incomeTaxProjected: _incomeTaxProjected,
    churchTaxCurrent: _churchTaxCurrent,
    churchTaxProjected: _churchTaxProjected,
    solidaritySurchargeCurrent: _solidaritySurchargeCurrent,
    solidaritySurchargeProjected: _solidaritySurchargeProjected,
}: {
    baseYTD: number;
    incomeTax: number;
    churchTax: number;
    soli: number;
    prepayments: number;
    centerTotal?: number;
    incomeTaxCurrent: number;
    incomeTaxProjected: number;
    churchTaxCurrent: number;
    churchTaxProjected: number;
    solidaritySurchargeCurrent: number;
    solidaritySurchargeProjected: number;
}) {
    // Build simplified donut: Prepaid + Taxes Remaining + Kept
    const totalTax = Math.max(0, incomeTax + churchTax + soli);
    const grossRevenue = typeof centerTotal === 'number' ? centerTotal : baseYTD;
    const prepaid = Math.max(0, prepayments);
    const taxesRemaining = Math.max(0, totalTax - prepaid);
    const kept = Math.max(0, grossRevenue - totalTax);

    const data: Array<{ name: string; value: number; isRemainder?: boolean; isPrepayment?: boolean; isTaxes?: boolean }> = [];
    if (prepaid > 0) data.push({ name: 'Prepaid', value: prepaid, isPrepayment: true });
    if (taxesRemaining > 0) data.push({ name: 'Taxes Remaining', value: taxesRemaining, isTaxes: true });
    if (kept > 0) data.push({ name: 'Kept', value: kept, isRemainder: true });

    return (
        <div className="w-full flex flex-col items-center select-none">
            <div className="w-full pointer-events-none" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
                        {/* Center title */}
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#0f172a" className="text-sm font-medium">
                            Income Taxes
                        </text>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={90}
                            paddingAngle={2}
                            cornerRadius={8}
                            stroke="#fff"
                            strokeWidth={2}
                            dataKey="value"
                            nameKey="name"
                            labelLine={false}
                            label={(props: any) => {
                                const { cx, cy, midAngle, outerRadius, name, value, payload, percent } = props;
                                // Show label for remainder as well ("Kept After Taxes")
                                const RAD = Math.PI / 180;
                                const radius = outerRadius + 12;
                                const x = cx + radius * Math.cos(-midAngle * RAD);
                                const y = cy + radius * Math.sin(-midAngle * RAD);
                                const pct = Math.round(((percent || 0) * 100));
                                const displayName = payload?.isRemainder ? 'Kept' : 
                                                   payload?.isPrepayment ? 'Prepaid' : 
                                                   payload?.isTaxes ? 'Taxes Remaining' : name;
                                const valueFormatted = new Intl.NumberFormat('de-DE', { 
                                    style: 'currency', 
                                    currency: 'EUR', 
                                    minimumFractionDigits: 0, 
                                    maximumFractionDigits: 0 
                                }).format(value);
                                const text = `${displayName} ${pct}%`;
                                const subtext = valueFormatted;
                                return (
                                    <g>
                                        <text x={x} y={y-6} fill="#334155" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-medium">
                                            {text}
                                        </text>
                                        <text x={x} y={y+8} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px]">
                                            {subtext}
                                        </text>
                                    </g>
                                );
                            }}
                        >
                            {data.map((entry: any, index: number) => {
                                const color = entry.isRemainder
                                    ? REMAINDER_COLOR
                                    : entry.isPrepayment
                                        ? PREPAYMENT_COLOR
                                        : TAX_COLOR;
                                return (
                                    <Cell key={`cell-${index}`} fill={color} />
                                );
                            })}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}


