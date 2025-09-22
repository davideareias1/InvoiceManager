'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
} from '@/components/ui/chart'
import { 
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from '@/components/ui/select'
import { formatCurrencyNoCents } from '@/shared/formatters'
import { TimeChartPrepared, TimeViewMode } from '@/application/time/analytics'

// Fixed palette for time series lines
const SERIES_COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#a855f7', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#64748b', // slate
    '#0ea5e9', // sky
]

export function TimeChart({
    prepared,
    viewMode,
    selectedYear,
    selectedMonth,
    onViewModeChange,
    onYearChange,
    onMonthChange,
    availableYears,
    availableMonths,
}: {
    prepared: TimeChartPrepared
    viewMode: TimeViewMode
    selectedYear: number
    selectedMonth: number
    onViewModeChange: (mode: TimeViewMode) => void
    onYearChange: (year: number) => void
    onMonthChange: (month: number) => void
    availableYears: number[]
    availableMonths: number[]
}) {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle>Tracked Hours per Client</CardTitle>
                    <div className="flex items-center gap-2 text-sm">
                        <Select value={viewMode} onValueChange={(v) => onViewModeChange(v as TimeViewMode)}>
                            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">Year (monthly)</SelectItem>
                                <SelectItem value="daily">Month (daily)</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={String(selectedYear)} onValueChange={(v) => onYearChange(Number(v))}>
                            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {availableYears.map(y => (
                                    <SelectItem value={String(y)} key={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {viewMode === 'daily' && (
                            <Select value={String(selectedMonth)} onValueChange={(v) => onMonthChange(Number(v))}>
                                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableMonths.map(m => (
                                        <SelectItem value={String(m)} key={m}>{String(m).padStart(2, '0')}</SelectItem>
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
                        <ChartRoot data={prepared.rows} margin={{ left: 48, right: 16, top: 8, bottom: 8 }}>
                            <ChartGrid vertical={false} />
                            <ChartXAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={(value) => viewMode === 'monthly' ? String(value).slice(5) : String(value).slice(8)}
                            />
                            <ChartYAxis
                                width={48}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={(value) => `${value}h`}
                            />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <ChartLegend />
                            {prepared.customerNames.map((name, idx) => (
                                <ChartLine
                                    key={name}
                                    dataKey={name}
                                    type="monotone"
                                    stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                    name={name}
                                />
                            ))}
                        </ChartRoot>
                    </Chart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}


