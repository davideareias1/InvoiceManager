'use client';

import { v4 as uuidv4 } from 'uuid';
import { ProductData } from '../interfaces';
import { saveProductToFile, loadProductsFromFiles, deleteProductFile } from './fileSystemStorage';

export interface SavedProduct extends ProductData {
    id: string;
    createdAt: string;
    updatedAt: string;
}

// Global variable to cache directory handle and products
let directoryHandle: FileSystemDirectoryHandle | null = null;
let cachedProducts: SavedProduct[] = [];

/**
 * Set the directory handle for file system operations
 */
export const setDirectoryHandle = (handle: FileSystemDirectoryHandle) => {
    directoryHandle = handle;
    // Immediately load products when handle is set
    loadProducts().then(products => {
        cachedProducts = products;
    });
};

// Sync access to cached products
export function loadProductsSync(): SavedProduct[] {
    return cachedProducts;
}

// Async load products with file system integration
export async function loadProducts(): Promise<SavedProduct[]> {
    if (!directoryHandle) return [];

    try {
        const products = await loadProductsFromFiles();
        // Update cache
        cachedProducts = products as SavedProduct[];
        return cachedProducts;
    } catch (error) {
        console.error('Error loading products:', error);
        return [];
    }
}

// Save product to file system
export async function saveProduct(product: ProductData): Promise<SavedProduct> {
    if (!directoryHandle) {
        throw new Error('No directory handle available. Please grant file access permissions.');
    }

    try {
        const now = new Date().toISOString();

        // Check if this product already exists based on name
        const existingIndex = cachedProducts.findIndex(p => p.name === product.name);

        let updatedProduct: SavedProduct;

        if (existingIndex >= 0) {
            // Update existing product
            updatedProduct = {
                ...cachedProducts[existingIndex],
                ...product,
                updatedAt: now
            };
            cachedProducts[existingIndex] = updatedProduct;
        } else {
            // Create new product
            updatedProduct = {
                ...product,
                id: uuidv4(),
                createdAt: now,
                updatedAt: now
            };
            cachedProducts.push(updatedProduct);
        }

        // Save to file system
        await saveProductToFile(updatedProduct);

        return updatedProduct;
    } catch (error) {
        console.error('Error saving product:', error);
        throw error;
    }
}

// Delete product by ID
export async function deleteProduct(id: string): Promise<boolean> {
    try {
        const filteredProducts = cachedProducts.filter(product => product.id !== id);

        if (filteredProducts.length === cachedProducts.length) {
            return false; // No product was deleted
        }

        // Update cache
        cachedProducts = filteredProducts;

        // Try to delete from file system
        if (directoryHandle) {
            try {
                await deleteProductFile(id);
            } catch (error) {
                console.error('Error deleting product file:', error);
                // Continue anyway as we've already updated the cache
            }
        }

        return true;
    } catch (error) {
        console.error('Error deleting product:', error);
        return false;
    }
}

// Search products
export function searchProducts(query: string): SavedProduct[] {
    if (!query) return cachedProducts;

    const lowerQuery = query.toLowerCase();

    return cachedProducts.filter(product =>
        product.name.toLowerCase().includes(lowerQuery) ||
        (product.description && product.description.toLowerCase().includes(lowerQuery))
    );
} 