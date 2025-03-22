'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ProductData } from '../interfaces';
import { Search, Plus, Check, X, Save, PackageX } from 'lucide-react';
import { Button } from './ui/button';
import { SavedProduct, loadProducts, loadProductsSync, saveProduct, searchProducts } from '../utils/productUtils';
import { formatAmount } from '../utils/moneyUtils';
import { showSuccess } from '../utils/notifications';

interface ProductSelectorProps {
    selectedProduct: ProductData;
    onSelectProduct: (product: ProductData) => void;
}

export default function ProductSelector({ selectedProduct, onSelectProduct }: ProductSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<SavedProduct[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [showSaveOption, setShowSaveOption] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    // Load products on component mount
    useEffect(() => {
        // Start with sync loading for immediate response
        setProducts(loadProductsSync());

        // Then load async for complete data
        const loadAsync = async () => {
            const asyncProducts = await loadProducts();
            setProducts(asyncProducts);
        };

        loadAsync();
    }, []);

    // Update search results when query changes
    useEffect(() => {
        if (searchQuery) {
            setProducts(searchProducts(searchQuery));
        } else {
            // Start with sync loading for immediate response
            setProducts(loadProductsSync());

            // Then load async for complete data
            const loadAsync = async () => {
                const asyncProducts = await loadProducts();
                setProducts(asyncProducts);
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

    // Handle product selection
    const handleSelectProduct = (product: SavedProduct) => {
        onSelectProduct(product);
        setShowResults(false);
        setSearchQuery('');
    };

    // Save current product
    const handleSaveProduct = async () => {
        if (!selectedProduct.name || !selectedProduct.price) {
            return; // Don't save incomplete product data
        }

        try {
            await saveProduct(selectedProduct);
            const refreshedProducts = await loadProducts();
            setProducts(refreshedProducts);
            setShowSaveOption(false);
            showSuccess('Product saved successfully!');
        } catch (error) {
            console.error('Error saving product:', error);
        }
    };

    // Show save option if product info is filled
    useEffect(() => {
        if (selectedProduct.name && selectedProduct.price) {
            // Check if this product already exists
            const existingProduct = products.find(
                p =>
                    p.name === selectedProduct.name &&
                    p.price === selectedProduct.price
            );

            // Also check for a partial match where just the product name matches
            // but other fields (price, description, unit) are different
            const partialMatch = products.find(
                p => p.name === selectedProduct.name &&
                    (p.price !== selectedProduct.price ||
                        p.description !== selectedProduct.description ||
                        p.unit !== selectedProduct.unit)
            );

            if (existingProduct) {
                // Exact match - no need to save
                setShowSaveOption(false);
            } else if (partialMatch) {
                // Partial match - show update option
                setShowSaveOption(true);
            } else {
                // New product - show save option
                setShowSaveOption(true);
            }
        } else {
            setShowSaveOption(false);
        }
    }, [selectedProduct, products]);

    // Check if product data is filled
    const hasProductData = Boolean(selectedProduct.name || selectedProduct.price);

    // Get existing product with the same name
    const existingProductWithSameName = selectedProduct.name ?
        products.find(p => p.name === selectedProduct.name) : null;

    // Determine if this is an update to an existing product
    const isProductUpdate = existingProductWithSameName &&
        (existingProductWithSameName.price !== selectedProduct.price ||
            existingProductWithSameName.description !== selectedProduct.description ||
            existingProductWithSameName.unit !== selectedProduct.unit);

    // New product status message
    const isNewProduct = selectedProduct.name && selectedProduct.price &&
        showSaveOption && !isProductUpdate;

    return (
        <div className="relative mb-4" ref={selectorRef}>
            <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search products..."
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
                        onClick={handleSaveProduct}
                        className="flex items-center gap-1 h-10"
                    >
                        <Save className="h-4 w-4" />
                        <span>Save Product</span>
                    </Button>
                ) : hasProductData && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            onSelectProduct({ name: '', price: 0, unit: '', description: '' });
                            setSearchQuery('');
                        }}
                        className="flex items-center gap-1 h-10"
                    >
                        <PackageX className="h-4 w-4" />
                        <span>Clear</span>
                    </Button>
                )}
            </div>

            {isNewProduct && (
                <div className="bg-yellow-50 p-3 rounded-md mb-3 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-yellow-800">New product detected</p>
                        <p className="text-xs text-yellow-700">Save this product to use again in future invoices</p>
                    </div>
                    <Button
                        type="button"
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                        size="sm"
                        onClick={handleSaveProduct}
                    >
                        <Save className="h-4 w-4 mr-1" />
                        Save Product
                    </Button>
                </div>
            )}

            {isProductUpdate && (
                <div className="bg-blue-50 p-3 rounded-md mb-3 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-blue-800">Product data updated</p>
                        <p className="text-xs text-blue-700">Price, description or unit information differs from saved product</p>
                    </div>
                    <Button
                        type="button"
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                        size="sm"
                        onClick={handleSaveProduct}
                    >
                        <Save className="h-4 w-4 mr-1" />
                        Update Product
                    </Button>
                </div>
            )}

            {showResults && products.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 flex justify-between items-start"
                            onClick={() => handleSelectProduct(product)}
                        >
                            <div>
                                <div className="font-medium">{product.name}</div>
                                {product.description && (
                                    <div className="text-sm text-gray-600">{product.description}</div>
                                )}
                                <div className="text-sm font-semibold mt-1">
                                    {formatAmount(product.price)} {product.unit ? `/ ${product.unit}` : ''}
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                                <Check className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {showResults && searchQuery && products.length === 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg p-4 text-center">
                    <p className="text-gray-500">No products found</p>
                    <p className="text-sm text-gray-400">Fill in product details and click "Save Product"</p>
                </div>
            )}
        </div>
    );
} 