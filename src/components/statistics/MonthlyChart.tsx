"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Chart,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartGrid,
    ChartXAxis,
    ChartYAxis,
    ChartLine,
    ChartLegend,
    ChartRoot,
} from "@/components/ui/chart"
import { formatCurrency, formatCurrencyNoCents } from '@/shared/formatters';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, TrendingUp, Wallet } from 'lucide-react';
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from '@/components/ui/select'

function MonthlyTooltipContent(props: any) {
    const { active, payload, label, className } = props || {};
    if (!active || !payload?.length) return null;

    const now = new Date();
    const currentLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const filtered = payload.filter((item: any) => !(item?.dataKey === 'projection' && label === currentLabel));
    if (!filtered.length) return null;

    return (
        <div
            className={cn(
                'rounded-lg border bg-background p-2 shadow-sm text-sm',
                className
            )}
        >
            {filtered.map((item: any, index: number) => {
                const valueFormatted = item?.dataKey === 'projection'
                    ? formatCurrencyNoCents(Number(item.value))
                    : formatCurrency(Number(item.value));
                return (
                    <div key={index} className="flex items-center gap-2">
                        <div
                            className="h-2 w-2 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: item.color }}
                        />
                        <div className="flex flex-1 items-center justify-between">
                            <span className="text-muted-foreground">{item.name}</span>
                            <span>{valueFormatted}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function MonthlyChart({
    series,
    title = 'Revenue (Year)',
    years,
    selectedYear,
    onYearChange,
    kpis,
}: {
    series: { month: string; actual: number | null; projection: number | null }[]
    title?: string
    years?: number[]
    selectedYear?: number
    onYearChange?: (year: number) => void
    kpis?: Array<{ label: string; value: string; sublabel?: string }>
}) {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle>{title}</CardTitle>
                    <div className="flex items-center gap-3">
                        {kpis && kpis.length > 0 && (
                            <div className="hidden md:flex items-stretch gap-2">
                                {kpis.map((k, idx) => {
                                    const icon = (() => {
                                        const key = k.label.toLowerCase();
                                        if (key.includes('ytd')) return <Wallet size={16} />;
                                        if (key.includes('project')) return <TrendingUp size={16} />;
                                        if (key.includes('month')) return <CalendarDays size={16} />;
                                        return null;
                                    })();
                                    const sub = (k.sublabel || '').trim();
                                    const isPositive = sub.startsWith('+');
                                    const isNegative = sub.startsWith('-');
                                    return (
                                        <div key={idx} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
                                            <div className="text-neutral-500">
                                                {icon}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="text-xs text-muted-foreground">{k.label}</div>
                                                <div className="text-base font-semibold tracking-tight leading-tight">{k.value}</div>
                                            </div>
                                            {sub && (
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'ml-2',
                                                        isPositive && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                                                        isNegative && 'border-red-200 bg-red-50 text-red-700'
                                                    )}
                                                >
                                                    {sub}
                                                </Badge>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {years && years.length > 0 && typeof selectedYear === 'number' && onYearChange && (
                            <Select value={String(selectedYear)} onValueChange={(v) => onYearChange(Number(v))}>
                                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {years.map(y => (
                                        <SelectItem value={String(y)} key={y}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1">
                <ChartContainer className="h-full">
                    <Chart width="100%" height="100%">
                        <ChartRoot data={series} margin={{ left: 64, right: 16, top: 8, bottom: 8 }}>
                            <ChartGrid vertical={false} />
                            <ChartXAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={(value) => String(value).slice(5)}
                            />
                            <ChartYAxis
                                width={64}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={(value) => formatCurrency(Number(value))}
                            />
                            <ChartTooltip cursor={false} content={<MonthlyTooltipContent />} />
                            <ChartLegend />
                            <ChartLine
                                dataKey="actual"
                                type="monotone"
                                stroke="var(--color-actual, #2563eb)"
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                                name="Actual"
                            />
                            <ChartLine
                                dataKey="projection"
                                type="monotone"
                                stroke="var(--color-projection, #9ca3af)"
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                dot={false}
                                connectNulls
                                name="Projection"
                            />
                        </ChartRoot>
                    </Chart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}


