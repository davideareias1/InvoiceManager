/**
 * Format a number as currency (€)
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format a quantity number (removes unnecessary decimal places)
 */
export function formatQuantity(quantity: number): string {
    // Remove trailing zeros and unnecessary decimal points
    return quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Format a date string as DD.MM.YYYY
 */
export function formatDate(dateString: string): string {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);

        if (isNaN(date.getTime())) {
            return dateString; // Return original if not a valid date
        }

        return new Intl.DateTimeFormat('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    } catch {
        return dateString; // Return original on error
    }
}

/**
 * Format a date for input fields (YYYY-MM-DD)
 */
export function formatDateForInput(dateString: string): string {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);

        if (isNaN(date.getTime())) {
            return '';
        }

        return date.toISOString().split('T')[0];
    } catch {
        return '';
    }
}

/**
 * Generate a unique invoice number based on date and time
 * @deprecated Use generateNextInvoiceNumber from invoiceUtils instead
 */
export function generateInvoiceNumber(): string {
    console.warn('generateInvoiceNumber from formatters is deprecated. Use generateNextInvoiceNumber from invoiceUtils instead.');
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    return `INV-${year}${month}${day}-${random}`;
}

/**
 * Calculate invoice due date (e.g., 30 days from invoice date)
 */
export function calculateDueDate(invoiceDate: string, paymentTermDays: number = 30): string {
    try {
        const date = new Date(invoiceDate);
        date.setDate(date.getDate() + paymentTermDays);
        return date.toISOString().split('T')[0];
    } catch {
        return '';
    }
}

/**
 * Format a string as a file name (remove special characters, replace spaces with underscores)
 */
export function formatFileName(str: string): string {
    if (!str) return '';

    // Replace spaces with underscores and remove special characters
    return str
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .toLowerCase();
}

/**
 * Truncate text to a certain length with ellipsis
 */
export function truncateText(text: string, maxLength: number = 50): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;

    return text.substring(0, maxLength) + '...';
} 