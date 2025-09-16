import type { CustomerData, ProductData } from '@/domain/models';

export interface ItemForm {
    id?: string;
    name: string;
    quantity: number;
    price: number;
    description?: string;
}

export interface InvoiceFormState {
    invoiceDate: string;
    dueDate: string;
    customerName: string;
    customerAddress: string;
    customerCity: string;
    clientVatId: string;
    hourlyRate: string;
    notes: string;
    items: ItemForm[];
}

export interface Totals {
    subtotal: number;
    taxAmount: number;
    total: number;
}

export type InvoiceFormAction =
    | { type: 'SET_FIELD'; field: keyof InvoiceFormState; value: any }
    | { type: 'SET_ALL_FIELDS'; payload: Partial<InvoiceFormState> }
    | { type: 'ADD_ITEM' }
    | { type: 'REMOVE_ITEM'; index: number }
    | { type: 'UPDATE_ITEM'; index: number; payload: Partial<ItemForm> }
    | { type: 'ADD_ITEM_WITH_PAYLOAD'; payload: ItemForm };

export interface CustomerFormProps {
    formState: InvoiceFormState;
    dispatch: React.Dispatch<InvoiceFormAction>;
    allCustomers: CustomerData[];
}

export interface InvoiceItemsProps {
    formState: InvoiceFormState;
    dispatch: React.Dispatch<InvoiceFormAction>;
    allProducts: ProductData[];
    onApplyMonthlyHoursToItem: (index: number) => Promise<void>;
}

export interface InvoiceSidebarProps {
    plannedNumber: string;
    formState: InvoiceFormState;
    dispatch: React.Dispatch<InvoiceFormAction>;
    totals: Totals;
    taxRate: number;
    onPreview: () => void;
    isBusy: boolean;
    isValid: boolean;
}
