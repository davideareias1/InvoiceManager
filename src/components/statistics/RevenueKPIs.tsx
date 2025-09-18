"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/shared/formatters';
import { RevenueMetrics } from '@/application/statistics';
import { CalendarDays, TrendingUp, Wallet } from 'lucide-react';

function StatCard({
    title,
    value,
    icon,
    subtitle,
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
    subtitle?: string;
}) {
    return (
        <Card>
            <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-neutral-600 font-medium">{title}</CardTitle>
                    <div className="text-neutral-400">{icon}</div>
                </div>
            </CardHeader>
            <CardContent className="py-3">
                <div className="text-2xl font-semibold tracking-tight">{value}</div>
                {subtitle ? (
                    <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
                ) : null}
            </CardContent>
        </Card>
    );
}

export function RevenueKPIs({ data }: { data: RevenueMetrics }) {
    const projectedDelta = Math.max(0, data.projectedAnnual - data.totalYTD);
    const projectedSubtitle = projectedDelta > 0
        ? `+ ${formatCurrency(projectedDelta)} remaining to hit projection`
        : 'Projection reached';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <StatCard
                title="Revenue YTD"
                value={formatCurrency(data.totalYTD)}
                subtitle="Year to Date"
                icon={<Wallet size={18} />}
            />
            <StatCard
                title="Projected"
                value={formatCurrency(data.projectedAnnual)}
                subtitle={projectedSubtitle}
                icon={<TrendingUp size={18} />}
            />
            <StatCard
                title="Average Monthly"
                value={formatCurrency(data.averageMonthly)}
                subtitle="Run rate"
                icon={<CalendarDays size={18} />}
            />
        </div>
    );
}
