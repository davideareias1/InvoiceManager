"use client";

import { formatCurrency } from '@/shared/formatters';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];
const REMAINDER_COLOR = '#E5E7EB';

function truncateLabel(label: string, max: number = 18): string {
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
}: {
    baseYTD: number;
    incomeTax: number;
    churchTax: number;
    soli: number;
    prepayments: number;
    centerTotal?: number;
}) {
    const taxOnly = [
        { name: 'Income Tax', value: incomeTax },
        { name: 'Church Tax', value: churchTax },
        { name: 'Solidarity Surcharge', value: soli },
    ].filter(d => d.value > 0);

    const totalTax = taxOnly.reduce((s, d) => s + d.value, 0);
    const remainder = Math.max(0, baseYTD - totalTax);
    const data = remainder > 0 ? [...taxOnly, { name: 'Kept After Taxes', value: remainder, isRemainder: true }] : taxOnly;

    return (
        <div className="w-full flex flex-col items-center select-none">
            <div className="w-full pointer-events-none" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 8, right: 56, bottom: 8, left: 56 }}>
                        {/* Center labels: total projected revenue (or fallback) */}
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#0f172a" className="text-sm font-medium">
                            Total
                        </text>
                        <text x="50%" y="50%" dy={18} textAnchor="middle" dominantBaseline="central" fill="#64748b" className="text-[10px]">
                            {formatCurrency(typeof centerTotal === 'number' ? centerTotal : baseYTD)}
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
                                const radius = outerRadius + 22;
                                const x = cx + radius * Math.cos(-midAngle * RAD);
                                const y = cy + radius * Math.sin(-midAngle * RAD);
                                const pct = Math.round(((percent || 0) * 100));
                                const displayName = payload?.isRemainder ? 'Kept After Taxes' : name;
                                const text = `${truncateLabel(displayName)} ${pct}% (${formatCurrency(value)})`;
                                return (
                                    <text x={x} y={y} fill="#334155" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs">
                                        {text}
                                    </text>
                                );
                            }}
                        >
                            {data.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.isRemainder ? REMAINDER_COLOR : COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">Income Taxes (YTD)</div>
        </div>
    );
}


