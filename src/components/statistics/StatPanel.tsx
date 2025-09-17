"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function StatPanel({
    title,
    subtitle,
    className = '',
    children,
    headerRight,
    icon,
}: {
    title: string;
    subtitle?: string;
    className?: string;
    children: React.ReactNode;
    headerRight?: React.ReactNode;
    icon?: React.ReactNode;
}) {
    return (
        <Card className={["h-full w-full shadow-sm border-slate-200/70 bg-white hover:shadow-md transition-shadow duration-200", className].join(' ')}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {icon && <div className="text-slate-600">{icon}</div>}
                        <div>
                            <CardTitle className="text-base text-slate-900 font-semibold">{title}</CardTitle>
                            {subtitle ? (
                                <div className="text-xs text-slate-500 mt-1 leading-tight">{subtitle}</div>
                            ) : null}
                        </div>
                    </div>
                    {headerRight ? <div className="ml-4">{headerRight}</div> : null}
                </div>
            </CardHeader>
            <CardContent className="pt-0 h-[calc(100%-70px)]">
                <div className="h-full min-h-0">{children}</div>
            </CardContent>
        </Card>
    );
}


