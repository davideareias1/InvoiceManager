"use client";

import { formatCurrency } from '@/shared/formatters';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];
const PROJECTED_COLORS = ['#93c5fd', '#86efac', '#fbbf24']; // Lighter versions for projected
const REMAINDER_COLOR = '#E5E7EB';
const PREPAYMENT_COLOR = '#8b5cf6';

function truncateLabel(label: string, max: number = 25): string {
    if (!label) return '';
    return label.length <= max ? label : label.slice(0, max - 1) + '…';
}

export function IncomeTaxes({
    baseYTD,
    incomeTax,
    churchTax,
    soli,
    prepayments,
    centerTotal,
    incomeTaxCurrent,
    incomeTaxProjected,
    churchTaxCurrent,
    churchTaxProjected,
    solidaritySurchargeCurrent,
    solidaritySurchargeProjected,
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
    const taxItems: Array<{ name: string; value: number; isPrepayment?: boolean; isProjected?: boolean }> = [];
    
    // Add current taxes (based on YTD)
    if (incomeTaxCurrent > 0) taxItems.push({ name: 'Tax Current', value: incomeTaxCurrent });
    if (churchTaxCurrent > 0) taxItems.push({ name: 'Church Current', value: churchTaxCurrent });
    if (solidaritySurchargeCurrent > 0) taxItems.push({ name: 'Solidarity Current', value: solidaritySurchargeCurrent });
    
    // Add projected taxes (remaining for the year)
    if (incomeTaxProjected > 0) taxItems.push({ name: 'Tax Projected', value: incomeTaxProjected, isProjected: true });
    if (churchTaxProjected > 0) taxItems.push({ name: 'Church Projected', value: churchTaxProjected, isProjected: true });
    if (solidaritySurchargeProjected > 0) taxItems.push({ name: 'Solidarity Projected', value: solidaritySurchargeProjected, isProjected: true });

    // Add prepayments if they exist
    if (prepayments > 0) {
        taxItems.push({ name: 'Prepaid', value: prepayments, isPrepayment: true });
    }

    const totalTax = incomeTax + churchTax + soli;
    // Use centerTotal (gross projected revenue) as the base for calculating remainder
    const grossRevenue = typeof centerTotal === 'number' ? centerTotal : baseYTD;
    const remainder = Math.max(0, grossRevenue - totalTax);
    const data: Array<{ name: string; value: number; isRemainder?: boolean; isPrepayment?: boolean; isProjected?: boolean }> = remainder > 0 ? [...taxItems, { name: 'Kept', value: remainder, isRemainder: true }] : taxItems;

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
                                                   name; // Keep full names like "Tax Current", "Tax Projected"
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
                                let color: string;
                                if (entry.isRemainder) {
                                    color = REMAINDER_COLOR;
                                } else if (entry.isPrepayment) {
                                    color = PREPAYMENT_COLOR;
                                } else if (entry.isProjected) {
                                    // Use lighter colors for projected items
                                    const colorIndex = Math.floor(index / 2); // Group current/projected pairs
                                    color = PROJECTED_COLORS[colorIndex % PROJECTED_COLORS.length];
                                } else {
                                    // Use regular colors for current items
                                    const colorIndex = Math.floor(index / 2); // Group current/projected pairs
                                    color = COLORS[colorIndex % COLORS.length];
                                }
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


