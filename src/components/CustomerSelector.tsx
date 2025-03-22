'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CustomerData } from '../interfaces';
import { SavedCustomer, loadCustomers, loadCustomersSync, saveCustomer, searchCustomers } from '../utils/customerUtils';
import { Button } from './ui/button';
import { Search, UserPlus, Check, X, Save, UserX } from 'lucide-react';
import { showSuccess } from '../utils/notifications';

interface CustomerSelectorProps {
    currentCustomer: CustomerData;
    onSelectCustomer: (customer: CustomerData) => void;
}

export function CustomerSelector({ currentCustomer, onSelectCustomer }: CustomerSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [customers, setCustomers] = useState<SavedCustomer[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [showSaveOption, setShowSaveOption] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    // Load initial customers
    useEffect(() => {
        // Start with sync loading for immediate response
        setCustomers(loadCustomersSync());

        // Then load async for complete data
        const loadAsync = async () => {
            const asyncCustomers = await loadCustomers();
            setCustomers(asyncCustomers);
        };

        loadAsync();
    }, []);

    // Search when query changes
    useEffect(() => {
        if (searchQuery) {
            setCustomers(searchCustomers(searchQuery));
        } else {
            // Start with sync loading for immediate response
            setCustomers(loadCustomersSync());

            // Then load async for complete data
            const loadAsync = async () => {
                const asyncCustomers = await loadCustomers();
                setCustomers(asyncCustomers);
            };

            loadAsync();
        }
    }, [searchQuery]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Handle customer selection
    const handleSelectCustomer = (customer: SavedCustomer) => {
        onSelectCustomer(customer);
        setShowResults(false);
        setSearchQuery('');
    };

    // Save current customer
    const handleSaveCustomer = async () => {
        if (!currentCustomer.name || !currentCustomer.address || !currentCustomer.city) {
            return; // Don't save incomplete customer data
        }

        try {
            await saveCustomer(currentCustomer);
            const refreshedCustomers = await loadCustomers();
            setCustomers(refreshedCustomers);
            setShowSaveOption(false);
            showSuccess('Customer saved successfully!');
        } catch (error) {
            console.error('Error saving customer:', error);
        }
    };

    // Show save option if customer info is filled
    useEffect(() => {
        if (currentCustomer.name && currentCustomer.address && currentCustomer.city) {
            // Check if this customer already exists
            const existingCustomer = customers.find(
                c =>
                    c.name === currentCustomer.name &&
                    c.address === currentCustomer.address &&
                    c.city === currentCustomer.city
            );

            // Also check for a partial match where just the customer name matches
            // but other fields are different
            const partialMatch = customers.find(
                c => c.name === currentCustomer.name &&
                    (c.address !== currentCustomer.address || c.city !== currentCustomer.city)
            );

            if (existingCustomer) {
                // Exact match - no need to save
                setShowSaveOption(false);
            } else if (partialMatch) {
                // Partial match - show update option
                setShowSaveOption(true);
            } else {
                // New customer - show save option
                setShowSaveOption(true);
            }
        } else {
            setShowSaveOption(false);
        }
    }, [currentCustomer, customers]);

    // Check if customer data is filled
    const hasCustomerData = Boolean(currentCustomer.name || currentCustomer.address || currentCustomer.city);

    // Get existing customer with the same name
    const existingCustomerWithSameName = currentCustomer.name ?
        customers.find(c => c.name === currentCustomer.name) : null;

    // Determine if this is an update to an existing customer
    const isCustomerUpdate = existingCustomerWithSameName &&
        (existingCustomerWithSameName.address !== currentCustomer.address ||
            existingCustomerWithSameName.city !== currentCustomer.city);

    // New customer status message
    const isNewCustomer = currentCustomer.name && currentCustomer.address && currentCustomer.city &&
        showSaveOption && !isCustomerUpdate;

    return (
        <div className="relative mb-4" ref={selectorRef}>
            <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search customers..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowResults(true);
                        }}
                        onFocus={() => setShowResults(true)}
                        className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>

                {showSaveOption ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSaveCustomer}
                        className="flex items-center gap-1 h-10"
                    >
                        <Save className="h-4 w-4" />
                        <span>Save Customer</span>
                    </Button>
                ) : hasCustomerData && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            onSelectCustomer({ name: '', address: '', city: '', number: '' });
                            setSearchQuery('');
                        }}
                        className="flex items-center gap-1 h-10"
                    >
                        <UserX className="h-4 w-4" />
                        <span>Clear</span>
                    </Button>
                )}
            </div>

            {isNewCustomer && (
                <div className="bg-yellow-50 p-3 rounded-md mb-3 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-yellow-800">New customer detected</p>
                        <p className="text-xs text-yellow-700">Save this customer to use again in future invoices</p>
                    </div>
                    <Button
                        type="button"
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                        size="sm"
                        onClick={handleSaveCustomer}
                    >
                        <Save className="h-4 w-4 mr-1" />
                        Save Customer
                    </Button>
                </div>
            )}

            {isCustomerUpdate && (
                <div className="bg-blue-50 p-3 rounded-md mb-3 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-blue-800">Customer data updated</p>
                        <p className="text-xs text-blue-700">Address or city information differs from saved customer</p>
                    </div>
                    <Button
                        type="button"
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                        size="sm"
                        onClick={handleSaveCustomer}
                    >
                        <Save className="h-4 w-4 mr-1" />
                        Update Customer
                    </Button>
                </div>
            )}

            {showResults && customers.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
                    {customers.map((customer) => (
                        <div
                            key={customer.id}
                            className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 flex justify-between items-start"
                            onClick={() => handleSelectCustomer(customer)}
                        >
                            <div>
                                <div className="font-medium">{customer.name}</div>
                                <div className="text-sm text-gray-600">{customer.address}</div>
                                <div className="text-sm text-gray-600">{customer.city}</div>
                                {customer.number && <div className="text-xs text-gray-500">ID: {customer.number}</div>}
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                                <Check className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {showResults && searchQuery && customers.length === 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg p-4 text-center">
                    <p className="text-gray-500">No customers found</p>
                    <p className="text-sm text-gray-400">Fill in customer details and click "Save Customer"</p>
                </div>
            )}
        </div>
    );
} 