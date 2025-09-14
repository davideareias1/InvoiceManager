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
}: {
    series: { month: string; actual: number | null; projection: number | null }[]
}) {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle>Revenue (Year)</CardTitle>
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


