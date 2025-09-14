"use client"
import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Chart components
const ChartContainer = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "relative w-full h-[300px] [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50",
            className
        )}
        {...props}
    />
))
ChartContainer.displayName = "ChartContainer"

// Responsive container (100% x 100%)
const Chart = RechartsPrimitive.ResponsiveContainer

// Root chart (LineChart)
const ChartRoot = RechartsPrimitive.LineChart

const ChartLegend = RechartsPrimitive.Legend

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartGrid = RechartsPrimitive.CartesianGrid

const ChartXAxis = RechartsPrimitive.XAxis

const ChartYAxis = RechartsPrimitive.YAxis

const ChartArea = RechartsPrimitive.Area

const ChartBar = RechartsPrimitive.Bar

const ChartLine = RechartsPrimitive.Line

const ChartTooltipContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof RechartsPrimitive.Tooltip> & {
        className?: string
    }
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "rounded-lg border bg-background p-2 shadow-sm text-sm",
            className
        )}
    >
        {props.payload?.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
                <div
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: item.color }}
                />
                <div className="flex flex-1 items-center justify-between">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span>{item.value}</span>
                </div>
            </div>
        ))}
    </div>
))
ChartTooltipContent.displayName = "ChartTooltipContent"

export {
    ChartContainer,
    Chart,
    ChartRoot,
    ChartLegend,
    ChartTooltip,
    ChartGrid,
    ChartXAxis,
    ChartYAxis,
    ChartArea,
    ChartBar,
    ChartLine,
    ChartTooltipContent,
}
