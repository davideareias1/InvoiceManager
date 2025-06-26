'use client';

import { v4 as uuidv4 } from 'uuid';
import { ProductData } from '../interfaces';
import { saveProductToFile, loadProductsFromFiles, deleteProductFile } from './fileSystemStorage';
import { saveProductToGoogleDrive } from './googleDriveStorage';

// Global variable to cache directory handle and products
let directoryHandle: FileSystemDirectoryHandle | null = null;
let cachedProducts: ProductData[] = [];

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
export function loadProductsSync(): ProductData[] {
    return cachedProducts.filter(p => !p.isDeleted);
}

// Async load products with file system integration
export async function loadProducts(): Promise<ProductData[]> {
    if (!directoryHandle) return [];

    try {
        const products = await loadProductsFromFiles();
        // Update cache, filtering out deleted products
        cachedProducts = products.filter(p => !p.isDeleted);
        return cachedProducts;
    } catch (error) {
        console.error('Error loading products:', error);
        return [];
    }
}

// Save product to file system
export async function saveProduct(product: Partial<ProductData>): Promise<ProductData> {
    if (!directoryHandle) {
        throw new Error('No directory handle available. Please grant file access permissions.');
    }

    try {
        const now = new Date().toISOString();
        let updatedProduct: ProductData;

        if (product.id) {
            // Update existing product
            const existingIndex = cachedProducts.findIndex(p => p.id === product.id);
            if (existingIndex !== -1) {
                updatedProduct = {
                    ...cachedProducts[existingIndex],
                    ...product,
                    lastModified: now,
                };
                cachedProducts[existingIndex] = updatedProduct;
            } else {
                throw new Error(`Product with id ${product.id} not found.`);
            }
        } else {
            // Create new product
            updatedProduct = {
                ...product,
                id: uuidv4(),
                lastModified: now,
                isDeleted: false,
            } as ProductData;
            cachedProducts.push(updatedProduct);
        }

        // Save to local file system and Google Drive
        await saveProductToFile(updatedProduct);
        await saveProductToGoogleDrive(updatedProduct);

        return updatedProduct;
    } catch (error) {
        console.error('Error saving product:', error);
        throw error;
    }
}

// Delete product by ID (soft delete)
export async function deleteProduct(id: string): Promise<boolean> {
    try {
        const productIndex = cachedProducts.findIndex(product => product.id === id);

        if (productIndex === -1) {
            console.warn(`Product with id ${id} not found for deletion.`);
            return false;
        }
        
        // Mark as deleted and update timestamp
        const productToDelete = {
            ...cachedProducts[productIndex],
            isDeleted: true,
            lastModified: new Date().toISOString(),
        };

        cachedProducts[productIndex] = productToDelete;

        // Save the updated product (with isDeleted flag) to propagate the change
        await saveProductToFile(productToDelete);
        await saveProductToGoogleDrive(productToDelete);

        // Filter out from active cache
        cachedProducts = cachedProducts.filter(p => p.id !== id);

        return true;
    } catch (error) {
        console.error('Error deleting product:', error);
        return false;
    }
}

// Search products
export function searchProducts(query: string): ProductData[] {
    const activeProducts = cachedProducts.filter(p => !p.isDeleted);
    if (!query) return activeProducts;

    const lowerQuery = query.toLowerCase();

    return activeProducts.filter(product =>
        product.name.toLowerCase().includes(lowerQuery) ||
        (product.description && product.description.toLowerCase().includes(lowerQuery))
    );
} 