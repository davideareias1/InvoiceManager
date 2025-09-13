import { Invoice, CompanyInfo } from '../domain/models';
import type { InvoiceRepository, CompanyRepository } from '../domain/models';

export class CreateInvoice {
    private readonly invoiceRepo: InvoiceRepository;

    constructor(invoiceRepo: InvoiceRepository) {
        this.invoiceRepo = invoiceRepo;
    }

    async execute(partial: Omit<Partial<Invoice>, 'invoice_number'>): Promise<Invoice> {
        const nextNumber = await this.invoiceRepo.generateNextInvoiceNumber();
        return this.invoiceRepo.saveInvoice({ ...partial, invoice_number: nextNumber });
    }
}

export class ListInvoices {
    private readonly invoiceRepo: InvoiceRepository;

    constructor(invoiceRepo: InvoiceRepository) {
        this.invoiceRepo = invoiceRepo;
    }

    async execute(): Promise<Invoice[]> {
        return this.invoiceRepo.loadInvoices();
    }
}

export class LoadCompanyInfo {
    private readonly companyRepo: CompanyRepository;

    constructor(companyRepo: CompanyRepository) {
        this.companyRepo = companyRepo;
    }

    async execute(): Promise<CompanyInfo | null> {
        return this.companyRepo.loadCompanyInfo();
    }
}
