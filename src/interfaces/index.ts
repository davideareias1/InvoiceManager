export interface IssuerData {
    name: string;
    address: string;
    city: string;
}

export interface BankDetails {
    name: string;
    iban: string;
    bic: string;
}

export interface InvoiceItem {
    name: string;
    quantity: number;
    price: number;
    description?: string;
    item_name?: string;
}

export interface CustomerData {
    id: string;
    name: string;
    address: string;
    city: string;
    number?: string;
    lastModified: string;
    isDeleted?: boolean;
}

export interface ProductData {
    id: string;
    name: string;
    price: number;
    unit?: string;
    description?: string;
    lastModified: string;
    isDeleted?: boolean;
}

export interface Invoice {
    id: string;
    invoice_number: string;
    invoice_date: string;
    due_date?: string;
    issuer: IssuerData;
    customer: CustomerData;
    items: InvoiceItem[];
    total: number;
    bank_details: BankDetails;
    tax_rate?: number;
    notes?: string;
    is_paid?: boolean;
    client_name?: string;
    client_address?: string;
    client_email?: string;
    client_phone?: string;
    client_vat_id?: string;
    client_vat_exempt?: boolean;
    client_electronic_address?: string;
    buyer_reference?: string;
    tax_exemption_reason?: string;
    status?: InvoiceStatus;
    payment_status?: PaymentStatus;
    created_at?: Date;
    updated_at?: Date;
    lastModified: string;
    isDeleted?: boolean;
    isRectified?: boolean; // Tracks if this invoice has been rectified (cancelled)
    rectifiedBy?: string; // Invoice number of the rectification invoice
}

export interface CompanyInfo {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    tax_id: string;
    tax_number: string;
    registration_number: string;
    trade_register: string;
    electronic_address: string;
    bank_name: string;
    account_name: string;
    account_number: string;
    iban: string;
    swift_bic: string;
    logo_url: string;
    is_vat_enabled: boolean;
    default_tax_rate: number;
    is_freelancer?: boolean;
    full_name?: string;
    lastModified: string;
}

export enum InvoiceStatus {
    Draft = 'draft',
    Sent = 'sent',
    Paid = 'paid',
    Overdue = 'overdue',
    Cancelled = 'cancelled'
}

export enum PaymentStatus {
    Unpaid = 'unpaid',
    PartiallyPaid = 'partially_paid',
    Paid = 'paid',
    Refunded = 'refunded'
} 