'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoiItem } from '@/application/time/analytics';
import { formatCurrency } from '@/shared/formatters';

export function ROIAnalysis({ data }: { data: RoiItem[] }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle>ROI by Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {data.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No time data available.</div>
                ) : (
                    <div className="space-y-2">
                        {data.map((item, idx) => (
                            <div key={item.customerName} className="flex items-center justify-between border rounded p-2">
                                <div>
                                    <div className="font-medium">{item.customerName}</div>
                                    <div className="text-xs text-muted-foreground">{item.totalHours} h</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm">{formatCurrency(item.revenue)}</div>
                                    <div className="text-xs text-muted-foreground">{item.roiPerHour > 0 ? `ROI: ${formatCurrency(item.roiPerHour)}/h` : 'ROI: n/a'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


