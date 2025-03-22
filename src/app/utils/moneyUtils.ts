/**
 * Format an amount as a currency string
 * @param amount The amount to format
 * @param currency The currency symbol (default: €)
 * @returns Formatted currency string
 */
export function formatAmount(amount: number, currency: string = '€'): string {
    return `${currency}${amount.toFixed(2)}`;
} 