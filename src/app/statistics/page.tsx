"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { useCompany } from '@/infrastructure/contexts/CompanyContext';
import { useTaxSettings } from '@/infrastructure/contexts/TaxSettingsContext';
import { Invoice } from '@/domain/models';
// removed KPIs and table per user request
import { TopClients } from '@/components/statistics/TopClients';
import { VatSimulation } from '@/components/statistics/VatSimulation';
import { computeBasicMetrics, computeRevenueMetrics, computeVatSimulation, estimateIncomeTaxes, extractInvoiceYears, computeMonthlyTotalsForYear, computeRevenueMetricsForYear } from '@/application/statistics';
import { IncomeTaxes } from '@/components/statistics/IncomeTaxes';
import { MonthlyChart } from '@/components/statistics/MonthlyChart';
// removed side RevenueKPIs; KPIs are now inline in the chart header
import { useTimeAnalytics } from '@/infrastructure/contexts/TimeAnalyticsContext';
import { computeAvailablePeriods, computeInvoiceBasedROI, prepareTimeChartData, computeTimeBasedMonthlyProjections } from '@/application/time/analytics';
import { TimeChart } from '@/components/statistics/TimeChart';
import { ROIAnalysis } from '@/components/statistics/ROIAnalysis';

export default function StatisticsPage() {
    const { isInitialized, hasPermission, loadInvoices } = useFileSystem();
    const { companyInfo } = useCompany();
    const { taxSettings } = useTaxSettings();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('revenue');
    const { index: timeIndex } = useTimeAnalytics();
    const periods = useMemo(() => computeAvailablePeriods(timeIndex), [timeIndex]);
    const [timeViewMode, setTimeViewMode] = useState<'daily' | 'monthly'>('monthly');
    const [selectedYear, setSelectedYear] = useState<number>(() => periods.years[0] || new Date().getFullYear());
    // Revenue chart year selection
    const availableRevenueYears = useMemo(() => extractInvoiceYears(invoices), [invoices]);
    const [revenueYear, setRevenueYear] = useState<number>(() => new Date().getFullYear());
    useEffect(() => {
        if (availableRevenueYears.length > 0 && !availableRevenueYears.includes(revenueYear)) {
            setRevenueYear(availableRevenueYears[0]);
        }
    }, [availableRevenueYears, revenueYear]);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

    useEffect(() => {
        const run = async () => {
            if (!isInitialized || !hasPermission) return;
            setIsLoading(true);
            try {
                const list = await loadInvoices();
                setInvoices(list);
            } finally {
                setIsLoading(false);
            }
        };
        run();
    }, [isInitialized, hasPermission, loadInvoices]);

    const basics = useMemo(() => computeBasicMetrics(invoices), [invoices]);
    const revenue = useMemo(() => computeRevenueMetrics(invoices), [invoices]);
    const revenueForSelectedYear = useMemo(() => computeRevenueMetricsForYear(invoices, revenueYear), [invoices, revenueYear]);
    const vat = useMemo(() => computeVatSimulation(invoices, companyInfo), [invoices, companyInfo]);
    const incomeTaxes = useMemo(() => estimateIncomeTaxes(invoices, taxSettings), [invoices, taxSettings]);

    const timePrepared = useMemo(() => prepareTimeChartData(timeIndex, timeViewMode, selectedYear, timeViewMode === 'daily' ? selectedMonth : undefined), [timeIndex, timeViewMode, selectedYear, selectedMonth]);
    const roiData = useMemo(() => computeInvoiceBasedROI(basics.perClientTotalsYTD, timeIndex, new Date().getFullYear()), [basics.perClientTotalsYTD, timeIndex]);

    // Time-based monthly projections from tracked minutes * hourlyRate
    const timeProjectionsByMonth = useMemo(() => computeTimeBasedMonthlyProjections(timeIndex, revenueYear), [timeIndex, revenueYear]);

    const timeBasedProjectedAnnual = useMemo(() => {
        const now = new Date();
        const isCurrentYear = revenueYear === now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11
        const actualsMap: Record<string, number> = {};
        computeMonthlyTotalsForYear(invoices, revenueYear).forEach(m => { actualsMap[m.month] = m.total; });

        let total = 0;
        for (let i = 0; i < 12; i++) {
            const key = `${revenueYear}-${String(i + 1).padStart(2, '0')}`;
            if (!isCurrentYear) {
                total += actualsMap[key] || 0;
                continue;
            }
            if (i < currentMonth) {
                // Past months: use actual invoices
                total += actualsMap[key] || 0;
            } else if (i === currentMonth) {
                // Current month: prefer time-based projection; fallback to actuals
                const proj = timeProjectionsByMonth[key];
                total += typeof proj === 'number' && proj > 0 ? proj : (actualsMap[key] || 0);
            } else {
                // Future months: use time-based baseline when available
                const proj = timeProjectionsByMonth[key];
                total += typeof proj === 'number' && proj > 0 ? proj : 0;
            }
        }
        return total > 0 ? total : revenueForSelectedYear.projectedAnnual;
    }, [invoices, revenueYear, timeProjectionsByMonth, revenueForSelectedYear.projectedAnnual]);

    return (
        <div className="p-6 h-[calc(100vh-4rem)] box-border overflow-auto space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Statistics</h1>
            </div>

            {isInitialized && hasPermission && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="revenue">Revenue Overview</TabsTrigger>
                        {/* Removed Tax Analysis tab; moved its chart next to Revenue */}
                        {/* Removed Client Analytics tab; moved chart under taxes in Revenue tab */}
                        <TabsTrigger value="time">Time Analytics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="revenue" className="space-y-4">
                        {/* Yearly revenue chart with year selector and inline KPIs; taxes chart placed alongside */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[300px]">
                            <div className="lg:col-span-2 h-full">
                                <MonthlyChart
                                    title="Revenue (Year)"
                                    years={availableRevenueYears}
                                    selectedYear={revenueYear}
                                    onYearChange={setRevenueYear}
                                    kpis={(function() {
                                        const projectedAnnualDisplay = revenueYear === new Date().getFullYear() ? timeBasedProjectedAnnual : revenueForSelectedYear.projectedAnnual;
                                        const projectedDelta = Math.max(0, projectedAnnualDisplay - revenueForSelectedYear.totalYTD);
                                        const projectedSubtitle = projectedDelta > 0
                                            ? `+${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(projectedDelta)}`
                                            : 'Target met';
                                        return [
                                            { label: 'YTD', value: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(revenueForSelectedYear.totalYTD) },
                                            { label: 'Projected', value: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(projectedAnnualDisplay), sublabel: projectedSubtitle },
                                            { label: 'Monthly Avg', value: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(revenueForSelectedYear.averageMonthly) },
                                        ];
                                    })()}
                                    series={(function() {
                                        const now = new Date();
                                        const currentYear = now.getFullYear();
                                        const currentMonth = now.getMonth();
                                        const labels = Array.from({length: 12}, (_, i) => `${revenueYear}-${String(i+1).padStart(2, '0')}`);
                                        const actuals: Record<string, number> = {};
                                        computeMonthlyTotalsForYear(invoices, revenueYear).forEach(m => { actuals[m.month] = m.total; });
                                        const monthlyRunRate = revenueForSelectedYear.averageMonthly || 0;
                                        return labels.map((month, index) => {
                                            const isCurrentYear = revenueYear === currentYear;
                                            const isPast = isCurrentYear ? index < currentMonth : true;
                                            const isCurrent = isCurrentYear ? index === currentMonth : false;
                                            const actualValue = typeof actuals[month] === 'number' ? actuals[month] : null;
                                            const timeProj = timeProjectionsByMonth[month];
                                            const projection = isCurrentYear
                                                ? (isPast ? null : (
                                                    typeof timeProj === 'number' && timeProj > 0
                                                        ? timeProj
                                                        : (isCurrent ? (actualValue ?? 0) : Math.round(monthlyRunRate))
                                                  ))
                                                : null;
                                            return {
                                                month,
                                                actual: isCurrentYear ? (index <= currentMonth ? (actualValue ?? 0) : null) : (actualValue ?? 0),
                                                projection,
                                            };
                                        });
                                    })()}
                                />
                            </div>
                            <div className="lg:col-span-1 flex flex-col gap-4">
                                <IncomeTaxes
                                    baseYTD={incomeTaxes.taxableBaseYTD}
                                    incomeTax={incomeTaxes.incomeTax}
                                    churchTax={incomeTaxes.churchTax}
                                    soli={incomeTaxes.solidaritySurcharge}
                                    prepayments={incomeTaxes.prepaymentsYearToDate}
                                    centerTotal={revenueYear === new Date().getFullYear() ? timeBasedProjectedAnnual : revenueForSelectedYear.projectedAnnual}
                                    incomeTaxCurrent={incomeTaxes.incomeTaxCurrent}
                                    incomeTaxProjected={incomeTaxes.incomeTaxProjected}
                                    churchTaxCurrent={incomeTaxes.churchTaxCurrent}
                                    churchTaxProjected={incomeTaxes.churchTaxProjected}
                                    solidaritySurchargeCurrent={incomeTaxes.solidaritySurchargeCurrent}
                                    solidaritySurchargeProjected={incomeTaxes.solidaritySurchargeProjected}
                                />
                                {/* Client Analytics moved from separate tab - placed under taxes chart */}
                                <TopClients data={basics.topClientsYTD} />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Removed taxes tab content; VAT simulation is omitted per request */}
                    {/* Removed clients tab content; moved to revenue tab */}

                    <TabsContent value="time" className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[400px] items-stretch">
                            <div className="lg:col-span-2 h-full">
                                <TimeChart
                                    prepared={timePrepared}
                                    viewMode={timeViewMode}
                                    selectedYear={selectedYear}
                                    selectedMonth={selectedMonth}
                                    onViewModeChange={setTimeViewMode}
                                    onYearChange={(y) => { setSelectedYear(y); if (!(periods.monthsByYear[y] || []).includes(selectedMonth)) setSelectedMonth((periods.monthsByYear[y] || [new Date().getMonth()+1])[0] || 1); }}
                                    onMonthChange={setSelectedMonth}
                                    availableYears={periods.years}
                                    availableMonths={periods.monthsByYear[selectedYear] || []}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <ROIAnalysis data={roiData.slice(0, 8)} />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}


