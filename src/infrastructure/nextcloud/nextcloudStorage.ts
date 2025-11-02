'use client';

import { Invoice, CustomerData, ProductData, CompanyInfo } from '../../domain/models';

// ===== CONSTANTS =====
const CUSTOMERS_DIRECTORY = 'customers';
const PRODUCTS_DIRECTORY = 'products';
const INVOICES_DIRECTORY = 'invoices';
const TIMESHEETS_DIRECTORY = 'timesheets';
const COMPANY_INFO_FILENAME = 'company_info.json';
const TAX_SETTINGS_FILENAME = 'personal_tax_settings.json';

// ===== HELPERS (copied minimal logic from Drive storage) =====
function sanitizeFilename(name: string): string {
    return name
        .replace(/[\/\\:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200);
}

function generateFilename(item: any, itemType: 'invoice' | 'customer' | 'product' | 'company' | 'taxSettings'): string {
    switch (itemType) {
        case 'invoice':
            return `${String(item.invoice_number).padStart(3, '0')}.json`;
        case 'customer':
            return item.name && String(item.name).trim() ? `${sanitizeFilename(String(item.name).trim())}.json` : `customer_${item.id}.json`;
        case 'product':
            return item.name && String(item.name).trim() ? `${sanitizeFilename(String(item.name).trim())}.json` : `product_${item.id}.json`;
        case 'company':
            return COMPANY_INFO_FILENAME;
        case 'taxSettings':
            return TAX_SETTINGS_FILENAME;
        default:
            return `${item.id}.json`;
    }
}

// ===== BASIC API WRAPPERS =====
async function apiGet(path: string, list = false): Promise<any> {
    const url = list ? `/api/nextcloud/${encodePath(path)}?list=1` : `/api/nextcloud/${encodePath(path)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Nextcloud GET failed: ${res.status}`);
    return list ? await res.json() : await res.text();
}

async function apiPut(path: string, body: Blob | string, contentType?: string): Promise<void> {
    const res = await fetch(`/api/nextcloud/${encodePath(path)}`, {
        method: 'PUT',
        headers: contentType ? { 'Content-Type': contentType } : undefined,
        body,
    });
    if (!(res.ok || res.status === 201 || res.status === 204)) {
        throw new Error(`Nextcloud PUT failed: ${res.status}`);
    }
}

async function apiPostMkcol(path: string): Promise<void> {
    const res = await fetch(`/api/nextcloud/${encodePath(path)}`, {
        method: 'POST',
        headers: { 'x-webdav-method': 'MKCOL' },
    });
    if (!(res.ok || res.status === 201)) {
        throw new Error(`Nextcloud MKCOL failed: ${res.status}`);
    }
}

function encodePath(path: string): string {
    const clean = path.replace(/^\/+|\/+$/g, '');
    return clean.split('/').map(encodeURIComponent).join('/');
}

async function ensureDir(path: string): Promise<void> {
    const parts = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        try { await apiPostMkcol(current); } catch {}
    }
}

// ===== STRUCTURE =====
async function initializeDirectoryStructure(): Promise<void> {
    // Ensure root-level subfolders exist
    for (const dir of [CUSTOMERS_DIRECTORY, PRODUCTS_DIRECTORY, INVOICES_DIRECTORY, TIMESHEETS_DIRECTORY]) {
        await ensureDir(dir);
    }
}

export async function isNextcloudConfigured(): Promise<boolean> {
    try {
        await initializeDirectoryStructure();
        // Simple list of root to verify
        await apiGet('', true);
        return true;
    } catch (e) {
        console.error('Nextcloud configuration check failed:', e);
        return false;
    }
}

// ===== DOWNLOAD =====
async function listDir(path: string): Promise<Array<{ name: string; isDir: boolean }>> {
    const data = await apiGet(path, true);
    const items = (data?.items || []) as Array<{ name: string; isDir: boolean }>; 
    return items.filter(it => it.name && it.name !== '.');
}

async function readJsonFile(path: string): Promise<any | null> {
    try {
        const text = await apiGet(path);
        return text ? JSON.parse(text) : null;
    } catch (e) {
        return null;
    }
}

export async function downloadAllDataFromNextcloud(): Promise<{
    invoices: Invoice[];
    customers: CustomerData[];
    products: ProductData[];
    companyInfo: CompanyInfo | null;
    timesheets: Array<{ customerName: string; year: number; month: number; blob: Blob; lastModified: string }>;
    taxSettings: any | null;
}> {
    await initializeDirectoryStructure();

    // Parallel fetch top-level JSON collections
    const [customersItems, productsItems, invoicesYears, companyInfo, taxSettings] = await Promise.all([
        listDir(CUSTOMERS_DIRECTORY),
        listDir(PRODUCTS_DIRECTORY),
        listDir(INVOICES_DIRECTORY),
        readJsonFile(COMPANY_INFO_FILENAME),
        readJsonFile(TAX_SETTINGS_FILENAME),
    ]);

    const customersPromise = Promise.all(
        customersItems
            .filter(i => !i.isDir && i.name.endsWith('.json'))
            .map(i => readJsonFile(`${CUSTOMERS_DIRECTORY}/${i.name}`))
    );

    const productsPromise = Promise.all(
        productsItems
            .filter(i => !i.isDir && i.name.endsWith('.json'))
            .map(i => readJsonFile(`${PRODUCTS_DIRECTORY}/${i.name}`))
    );

    // Invoices grouped by years: invoices/<year>/*.json
    const invoicesPromise = (async () => {
        const yearDirs = invoicesYears.filter(i => i.isDir).map(i => i.name);
        const all: any[] = [];
        for (const year of yearDirs) {
            const items = await listDir(`${INVOICES_DIRECTORY}/${year}`);
            const jsons = await Promise.all(
                items
                    .filter(i => !i.isDir && i.name.endsWith('.json'))
                    .map(i => readJsonFile(`${INVOICES_DIRECTORY}/${year}/${i.name}`))
            );
            all.push(...jsons.filter(Boolean));
        }
        return all;
    })();

    // Timesheets: timesheets/<customer>/<year>/*.xlsx (download metadata only)
    const timesheetsPromise = (async () => {
        const result: Array<{ customerName: string; year: number; month: number; blob: Blob; lastModified: string }> = [];
        const customers = (await listDir(TIMESHEETS_DIRECTORY)).filter(i => i.isDir);
        for (const cust of customers) {
            const years = (await listDir(`${TIMESHEETS_DIRECTORY}/${cust.name}`)).filter(i => i.isDir);
            for (const yr of years) {
                const files = await listDir(`${TIMESHEETS_DIRECTORY}/${cust.name}/${yr.name}`);
                for (const f of files) {
                    if (f.isDir || !f.name.endsWith('.xlsx')) continue;
                    // We won't download binary here to save bandwidth
                    const parts = f.name.replace('.xlsx', '').split('_');
                    const month = Number(parts[parts.length - 1]);
                    const blob = new Blob(); // placeholder; binary download deferred
                    result.push({ customerName: cust.name, year: Number(yr.name), month, blob, lastModified: new Date().toISOString() });
                }
            }
        }
        return result;
    })();

    const [customers, products, invoices, timesheets] = await Promise.all([
        customersPromise, productsPromise, invoicesPromise, timesheetsPromise,
    ]);

    return {
        invoices: (invoices as any[]).filter(Boolean),
        customers: (customers as any[]).filter(c => c && !c.isDeleted),
        products: (products as any[]).filter(p => p && !p.isDeleted),
        companyInfo: companyInfo || null,
        timesheets,
        taxSettings: taxSettings || null,
    };
}

// ===== UPLOAD =====
async function writeJson(path: string, data: any): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await apiPut(path, content, 'application/json');
}

export async function uploadAllDataToNextcloud(data: {
    invoices: Invoice[];
    customers: CustomerData[];
    products: ProductData[];
    companyInfo: CompanyInfo | null;
    taxSettings?: any | null;
    timesheets?: Array<{ customerName: string; year: number; month: number; fileHandle: FileSystemFileHandle }>;
}): Promise<number> {
    await initializeDirectoryStructure();
    let uploaded = 0;

    // Company info
    if (data.companyInfo) {
        await writeJson(COMPANY_INFO_FILENAME, data.companyInfo);
        uploaded++;
    }

    if (data.taxSettings) {
        await writeJson(TAX_SETTINGS_FILENAME, data.taxSettings);
        uploaded++;
    }

    for (const c of data.customers) {
        await writeJson(`${CUSTOMERS_DIRECTORY}/${generateFilename(c, 'customer')}`, c);
        uploaded++;
    }

    for (const p of data.products) {
        await writeJson(`${PRODUCTS_DIRECTORY}/${generateFilename(p, 'product')}`, p);
        uploaded++;
    }

    // Group invoices by year
    const byYear = new Map<string, Invoice[]>();
    for (const inv of data.invoices) {
        const year = new Date(inv.invoice_date).getFullYear().toString();
        const list = byYear.get(year) || [];
        list.push(inv);
        byYear.set(year, list);
    }
    for (const [year, list] of byYear) {
        await ensureDir(`${INVOICES_DIRECTORY}/${year}`);
        for (const inv of list) {
            await writeJson(`${INVOICES_DIRECTORY}/${year}/${generateFilename(inv, 'invoice')}`, inv);
            uploaded++;
        }
    }

    // Timesheets (binary uploads)
    if (data.timesheets && data.timesheets.length > 0) {
        for (const t of data.timesheets) {
            const filename = `${t.customerName}_${t.year}_${String(t.month).padStart(2, '0')}.xlsx`;
            await ensureDir(`${TIMESHEETS_DIRECTORY}/${t.customerName}/${t.year}`);
            const file = await t.fileHandle.getFile();
            const arrayBuffer = await file.arrayBuffer();
            await apiPut(`${TIMESHEETS_DIRECTORY}/${t.customerName}/${t.year}/${filename}`, new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            uploaded++;
        }
    }

    return uploaded;
}

// Immediate save helpers (no-ops if not wired up by repositories)
export async function saveCustomerToNextcloud(customer: CustomerData): Promise<void> {
    await writeJson(`${CUSTOMERS_DIRECTORY}/${generateFilename(customer, 'customer')}`, customer);
}

export async function saveProductToNextcloud(product: ProductData): Promise<void> {
    await writeJson(`${PRODUCTS_DIRECTORY}/${generateFilename(product, 'product')}`, product);
}

export async function saveInvoiceToNextcloud(invoice: Invoice): Promise<void> {
    const year = new Date(invoice.invoice_date).getFullYear().toString();
    await ensureDir(`${INVOICES_DIRECTORY}/${year}`);
    await writeJson(`${INVOICES_DIRECTORY}/${year}/${generateFilename(invoice, 'invoice')}`, invoice);
}

export async function uploadTimesheetToNextcloud(
    customerName: string,
    year: number,
    month: number,
    fileHandle: FileSystemFileHandle
): Promise<boolean> {
    await ensureDir(`${TIMESHEETS_DIRECTORY}/${customerName}/${year}`);
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const filename = `${customerName}_${year}_${String(month).padStart(2, '0')}.xlsx`;
    await apiPut(`${TIMESHEETS_DIRECTORY}/${customerName}/${year}/${filename}`, new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return true;
}


