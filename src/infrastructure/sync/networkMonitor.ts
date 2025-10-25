'use client';

import { NetworkStatus } from './types';

type NetworkStatusCallback = (status: NetworkStatus) => void;

let listeners: NetworkStatusCallback[] = [];
let currentStatus: NetworkStatus = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastChecked: new Date(),
};

/**
 * Initialize network monitoring
 */
export function initializeNetworkMonitor(): void {
    if (typeof window === 'undefined') return;

    // Listen to online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    updateStatus(navigator.onLine);
}

/**
 * Clean up network monitoring
 */
export function cleanupNetworkMonitor(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    listeners = [];
}

function handleOnline(): void {
    console.log('Network: Online');
    updateStatus(true);
}

function handleOffline(): void {
    console.log('Network: Offline');
    updateStatus(false);
}

function updateStatus(isOnline: boolean): void {
    currentStatus = {
        isOnline,
        lastChecked: new Date(),
    };

    // Notify all listeners
    listeners.forEach(callback => {
        try {
            callback(currentStatus);
        } catch (error) {
            console.error('Error in network status callback:', error);
        }
    });
}

/**
 * Subscribe to network status changes
 */
export function onNetworkStatusChange(callback: NetworkStatusCallback): () => void {
    listeners.push(callback);
    
    // Immediately call with current status
    callback(currentStatus);

    // Return unsubscribe function
    return () => {
        listeners = listeners.filter(cb => cb !== callback);
    };
}

/**
 * Get current network status
 */
export function getNetworkStatus(): NetworkStatus {
    return { ...currentStatus };
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
    return currentStatus.isOnline;
}

/**
 * Check if currently offline
 */
export function isOffline(): boolean {
    return !currentStatus.isOnline;
}

