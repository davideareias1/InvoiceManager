"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { useCompany } from '@/infrastructure/contexts/CompanyContext';
import { useTaxSettings } from '@/infrastructure/contexts/TaxSettingsContext';
import { Invoice } from '@/domain/models';
// removed KPIs and table per user request
import { TopClients } from '@/components/statistics/TopClients';
import { VatSimulation } from '@/components/statistics/VatSimulation';
import { computeBasicMetrics, computeRevenueMetrics, computeVatSimulation, estimateIncomeTaxes } from '@/application/statistics/metrics';
import { IncomeTaxes } from '@/components/statistics/IncomeTaxes';
import { MonthlyChart } from '@/components/statistics/MonthlyChart';
import { RevenueKPIs } from '@/components/statistics/RevenueKPIs';

export default function StatisticsPage() {
    const { isInitialized, hasPermission, loadInvoices } = useFileSystem();
    const { companyInfo } = useCompany();
    const { taxSettings } = useTaxSettings();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(false);

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
    const vat = useMemo(() => computeVatSimulation(invoices, companyInfo), [invoices, companyInfo]);
    const incomeTaxes = useMemo(() => estimateIncomeTaxes(invoices, taxSettings), [invoices, taxSettings]);

    return (
        <div className="p-6 h-[calc(100vh-4rem)] box-border overflow-auto space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Statistics</h1>
            </div>

            {(!isInitialized || !hasPermission) ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-neutral-600">Grant folder access in Invoices page to load data.</div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {/* Monthly chart with projection overlay */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                        <div className="lg:col-span-2 h-full">
                            <MonthlyChart
                                series={(function() {
                                    const now = new Date();
                                    const year = now.getFullYear();
                                    const currentMonth = now.getMonth();
                                    const labels = Array.from({length: 12}, (_, i) => `${year}-${String(i+1).padStart(2, '0')}`);
                                    const actuals: Record<string, number> = {};
                                    basics.monthlyTotalsCurrentYear.forEach(m => { actuals[m.month] = m.total; });
                                    
                                    const monthlyRunRate = revenue.averageMonthly || 0;

                                    return labels.map((month, index) => {
                                        const isPast = index < currentMonth;
                                        const isCurrent = index === currentMonth;
                                        const actualValue = actuals[month] || 0;
                                        return {
                                            month,
                                            // show actuals up to current month only
                                            actual: index <= currentMonth ? actualValue : null,
                                            // projection anchored at current month (equal to actual) and continues into the future
                                            projection: isPast ? null : (isCurrent ? actualValue : Math.round(monthlyRunRate)),
                                        };
                                    });
                                })()}
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <RevenueKPIs data={revenue} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IncomeTaxes
                            baseYTD={incomeTaxes.taxableBaseYTD}
                            incomeTax={incomeTaxes.incomeTax}
                            churchTax={incomeTaxes.churchTax}
                            soli={incomeTaxes.solidaritySurcharge}
                            prepayments={incomeTaxes.prepaymentsYearToDate}
                            centerTotal={revenue.projectedAnnual}
                        />

                        {/* Top Clients at the end */}
                        <TopClients data={basics.topClientsYTD} />
                    </div>
                    
                    {companyInfo.is_vat_enabled && (
                        <VatSimulation
                            initial={vat}
                            onRateChange={() => { /* reactivity handled by parent recompute if we extend later */ }}
                        />
                    )}
                    
                </div>
            )}
        </div>
    );
}


