import { format, parseISO } from 'date-fns';

/**
 * Format a date string to a short readable format
 * @param dateString ISO date string to format
 * @returns Formatted date string
 */
export function formatDateStringShort(dateString: string): string {
    try {
        const date = parseISO(dateString);
        return format(date, 'dd.MM.yyyy');
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
} 