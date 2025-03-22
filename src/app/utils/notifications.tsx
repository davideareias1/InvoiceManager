'use client';

import { toast } from '@/hooks/use-toast';
import React from 'react';

// Define the type for the toast object returned by the toast function
interface ToastResult {
    id: string;
    dismiss: () => void;
    update: (props: any) => void;
}

/**
 * Show a success notification
 */
export function showSuccess(message: string, duration: number = 3000): void {
    toast({
        title: "Success",
        description: message,
        variant: "default",
        duration
    });
}

/**
 * Show an error notification
 */
export function showError(message: string, duration: number = 5000): void {
    toast({
        title: "Error",
        description: message,
        variant: "destructive",
        duration
    });
}

/**
 * Show an info notification
 */
export function showInfo(message: string, duration: number = 3000): void {
    toast({
        title: "Info",
        description: message,
        variant: "default",
        duration
    });
}

/**
 * Show a warning notification
 */
export function showWarning(message: string, duration: number = 4000): void {
    toast({
        variant: "default",
        title: "Warning",
        description: message,
        duration
    });
}

/**
 * Show a loading notification and return a function to dismiss or update it
 */
export function showLoading(message: string): {
    dismiss: () => void;
    update: (newMessage: string) => void;
    success: (newMessage: string) => void;
    error: (newMessage: string) => void;
} {
    const result = toast.loading(message) as ToastResult;

    return {
        dismiss: () => toast.dismiss(result.id),
        update: (newMessage: string) => toast({
            ...result,
            title: "Loading",
            description: newMessage,
            variant: "default"
        }),
        success: (newMessage: string) => toast({
            ...result,
            title: "Success",
            description: newMessage,
            variant: "default"
        }),
        error: (newMessage: string) => toast({
            ...result,
            title: "Error",
            description: newMessage,
            variant: "destructive"
        })
    };
}

/**
 * Show a confirmation dialog with promise-based response
 */
export function showConfirmation(
    message: string,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
): Promise<boolean> {
    return new Promise((resolve) => {
        const result = toast({
            title: "Confirmation",
            description: message,
            variant: "default",
            action: (
                <div className="flex space-x-2">
                    <button
                        className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                        onClick={() => {
                            toast.dismiss(result.id);
                            resolve(true);
                        }}
                    >
                        {confirmText}
                    </button>
                    <button
                        className="rounded border px-3 py-2 text-sm font-medium"
                        onClick={() => {
                            toast.dismiss(result.id);
                            resolve(false);
                        }}
                    >
                        {cancelText}
                    </button>
                </div>
            ),
            duration: 10000,
        }) as ToastResult;

        // Auto-dismiss handler (in case toast times out)
        setTimeout(() => {
            resolve(false);
        }, 10000);
    });
} 