import { InvoiceStatus } from '@/domain/models';

export type StatusFilter = 'all' | InvoiceStatus.Unpaid | InvoiceStatus.Paid | InvoiceStatus.Overdue | InvoiceStatus.Rectified;


