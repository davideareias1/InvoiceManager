/**
 * Simple toast notifications for the application
 */

// Success notification
export function showSuccess(message: string): void {
    console.log(`Success: ${message}`);
    // Implement with your preferred toast library
    // Example: toast.success(message);
}

// Error notification
export function showError(message: string): void {
    console.error(`Error: ${message}`);
    // Example: toast.error(message);
}

// Loading notification with promise-like interface
export function showLoading(message: string): {
    success: (completionMessage: string) => void;
    error: (errorMessage: string) => void;
} {
    console.log(`Loading: ${message}`);
    // Example: const toastId = toast.loading(message);

    return {
        success: (completionMessage: string) => {
            console.log(`Success: ${completionMessage}`);
            // Example: toast.update(toastId, { type: 'success', render: completionMessage, isLoading: false, autoClose: 3000 });
        },
        error: (errorMessage: string) => {
            console.error(`Error: ${errorMessage}`);
            // Example: toast.update(toastId, { type: 'error', render: errorMessage, isLoading: false, autoClose: 3000 });
        },
    };
}

// Confirmation dialog
export function showConfirmation(
    message: string,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
): Promise<boolean> {
    return new Promise(resolve => {
        const confirmed = window.confirm(message);
        resolve(confirmed);

        // For a more sophisticated UI, you could use a modal dialog from your UI library:
        // Example: 
        // dialog.show({
        //   message,
        //   confirmText,
        //   cancelText,
        //   onConfirm: () => resolve(true),
        //   onCancel: () => resolve(false)
        // });
    });
} 