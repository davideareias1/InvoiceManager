import { Invoice, InvoiceStatus } from '@/domain/models';

export function getStatusLabel(invoice: Invoice): InvoiceStatus {
    if (invoice.status === InvoiceStatus.Rectified || invoice.isRectified) return InvoiceStatus.Rectified;
    if (invoice.is_paid) return InvoiceStatus.Paid;
    if (
        invoice.status === InvoiceStatus.Unpaid ||
        invoice.status === InvoiceStatus.Paid ||
        invoice.status === InvoiceStatus.Overdue
    ) {
        return invoice.status;
    }
    if (invoice.due_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(invoice.due_date);
        if (!isNaN(due.getTime())) {
            due.setHours(0, 0, 0, 0);
            if (due.getTime() < today.getTime()) return InvoiceStatus.Overdue;
        }
    }
    return InvoiceStatus.Unpaid;
}

export function isRectificationInvoice(invoice: Invoice): boolean {
    if (typeof invoice.total === 'number' && invoice.total < 0) return true;
    if (Array.isArray(invoice.items) && invoice.items.some(i => typeof i.price === 'number' && i.price < 0)) return true;
    const notes = (invoice.notes || '').toLowerCase();
    if (notes.includes('stornorechnung') || notes.includes('storno')) return true;
    const firstName = (invoice.items?.[0]?.name || '').toLowerCase();
    if (firstName.includes('stornorechnung')) return true;
    return false;
}

export function getDisplayStatus(invoice: Invoice): string {
    if (isRectificationInvoice(invoice)) return 'rectification';
    return getStatusLabel(invoice);
}


