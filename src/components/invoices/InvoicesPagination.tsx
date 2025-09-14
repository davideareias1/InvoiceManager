"use client";

import { Button } from '@/components/ui/button';

export type InvoicesPaginationProps = {
    page: number;
    totalPages: number;
    setPage: (updater: (prev: number) => number) => void;
};

export function InvoicesPagination({ page, totalPages, setPage }: InvoicesPaginationProps) {
    return (
        <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-neutral-500">Page {page} of {totalPages}</div>
            <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
        </div>
    );
}


