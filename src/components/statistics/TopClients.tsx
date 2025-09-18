"use client";

import { ClientTotalItem } from '@/application/statistics';
import { formatCurrency } from '@/shared/formatters';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];

function truncateLabel(label: string, max: number = 25): string {
    if (!label) return '';
    return label.length <= max ? label : label.slice(0, max - 1) + '…';
}

export function TopClients({ data }: { data: Array<ClientTotalItem & { share?: number }> }) {
    const filtered = data.filter(d => d.total > 0);
    const totalSum = filtered.reduce((s, d) => s + d.total, 0);
    return (
        <div className="w-full flex flex-col items-center select-none">
            <div className="w-full pointer-events-none" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
                        {/* Center title */}
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#0f172a" className="text-sm font-medium">
                            Top Clients
                        </text>
                        <Pie
                            data={filtered}
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={90}
                            paddingAngle={2}
                            cornerRadius={8}
                            stroke="#fff"
                            strokeWidth={2}
                            dataKey="total"
                            nameKey="client"
                            labelLine={false}
                            label={(props: any) => {
                                const { cx, cy, midAngle, outerRadius, name, value } = props;
                                const RAD = Math.PI / 180;
                                const radius = outerRadius + 12;
                                const x = cx + radius * Math.cos(-midAngle * RAD);
                                const y = cy + radius * Math.sin(-midAngle * RAD);
                                const pct = totalSum > 0 ? Math.round((value / totalSum) * 100) : 0;
                                const valueFormatted = new Intl.NumberFormat('de-DE', { 
                                    style: 'currency', 
                                    currency: 'EUR', 
                                    minimumFractionDigits: 0, 
                                    maximumFractionDigits: 0 
                                }).format(value);
                                const text = `${truncateLabel(name)} ${pct}%`;
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
                            {filtered.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}


