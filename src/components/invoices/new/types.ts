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
    | { type: 'UPDATE_ITEM'; index: number; payload: Partial<ItemForm> };

export interface CustomerFormProps {
    formState: InvoiceFormState;
    dispatch: React.Dispatch<InvoiceFormAction>;
    allCustomers: CustomerData[];
    matchedCustomer: CustomerData | null;
    isEditingClient: boolean;
    setIsEditingClient: (isEditing: boolean) => void;
    onUpdateCustomer: () => Promise<void>;
    onRememberCustomer: () => Promise<void>;
    isVatEnabled: boolean;
    isBusy: boolean;
}

export interface InvoiceItemsProps {
    formState: InvoiceFormState;
    dispatch: React.Dispatch<InvoiceFormAction>;
    allProducts: ProductData[];
    onRememberProduct: (index: number) => Promise<void>;
    onInsertThisMonthHours: () => Promise<void>;
    canInsertHours: boolean;
    isBusy: boolean;
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
