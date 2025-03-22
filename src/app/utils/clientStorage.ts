'use client';

// Safe localStorage management to handle server-side rendering
const isBrowser = typeof window !== 'undefined';

export const getItem = (key: string): string | null => {
    if (!isBrowser) return null;
    return localStorage.getItem(key);
};

export const setItem = (key: string, value: string): void => {
    if (!isBrowser) return;
    localStorage.setItem(key, value);
};

export const removeItem = (key: string): void => {
    if (!isBrowser) return;
    localStorage.removeItem(key);
}; 