import { Invoice, CustomerData, ProductData, CompanyInfo } from '../../domain/models';
import { SyncConflict, SyncableData } from './types';

// ===== NORMALIZATION =====
export function normalizeEntity<T extends Record<string, any>>(entity: T): T {
    const normalized: any = { ...entity };

    if (!normalized.lastModified || normalized.lastModified === '') {
        normalized.lastModified = normalized.updatedAt || new Date().toISOString();
    }
    if (normalized.isDeleted === undefined) {
        normalized.isDeleted = false;
    }
    if (normalized.isRectified === undefined && normalized.invoice_number) {
        normalized.isRectified = false;
    }

    for (const key in normalized) {
        const value = normalized[key];
        if (value === null || value === undefined || typeof value !== 'object') continue;
        if (Array.isArray(value)) {
            normalized[key] = value.map(item => (typeof item === 'object' && item !== null ? normalizeNestedObject(item) : item));
        } else {
            normalized[key] = normalizeNestedObject(value);
        }
    }

    return normalized;
}

export function normalizeNestedObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const normalized = { ...obj };
    if ((!normalized.lastModified || normalized.lastModified === '') && normalized.updatedAt) {
        normalized.lastModified = normalized.updatedAt;
    }
    if (normalized.isDeleted === undefined && normalized.id) {
        normalized.isDeleted = false;
    }
    return normalized;
}

// ===== MERGE =====
export function mergeData(
    local: SyncableData,
    remote: SyncableData,
    conflicts: SyncConflict[]
): { data: SyncableData; merged: number } {
    let mergedCount = 0;

    const invoices = mergeEntities<Invoice>(local.invoices, remote.invoices, 'invoice', conflicts);
    mergedCount += invoices.filter(inv => remote.invoices.some(r => r.id === inv.id)).length;

    const customers = mergeEntities<CustomerData>(local.customers, remote.customers, 'customer', conflicts);
    mergedCount += customers.filter(c => remote.customers.some(r => r.id === c.id)).length;

    const products = mergeEntities<ProductData>(local.products, remote.products, 'product', conflicts);
    mergedCount += products.filter(p => remote.products.some(r => r.id === p.id)).length;

    const companyInfo = mergeCompanyInfo(local.companyInfo, remote.companyInfo, conflicts);
    if (companyInfo && remote.companyInfo) mergedCount += 1;

    const taxSettings = mergeTaxSettings(local.taxSettings, remote.taxSettings, conflicts);
    if (taxSettings && remote.taxSettings) mergedCount += 1;

    return {
        data: {
            invoices,
            customers,
            products,
            companyInfo,
            timesheets: local.timesheets,
            taxSettings,
        },
        merged: mergedCount,
    };
}

export function mergeEntities<T extends { id: string; lastModified: string; isDeleted?: boolean }>(
    localEntities: T[],
    remoteEntities: T[],
    entityType: 'invoice' | 'customer' | 'product',
    conflicts: SyncConflict[]
): T[] {
    const merged = new Map<string, T>();
    localEntities.forEach(entity => {
        merged.set(entity.id, { ...entity, syncStatus: 'synced' as const } as any);
    });
    remoteEntities.forEach(remoteEntity => {
        const localEntity = merged.get(remoteEntity.id);
        if (!localEntity) {
            merged.set(remoteEntity.id, { ...remoteEntity, syncStatus: 'synced' as const } as any);
        } else {
            const localTime = new Date(localEntity.lastModified).getTime();
            const remoteTime = new Date(remoteEntity.lastModified).getTime();
            if (remoteTime > localTime) {
                conflicts.push({
                    entityType,
                    entityId: remoteEntity.id,
                    localTimestamp: localEntity.lastModified,
                    remoteTimestamp: remoteEntity.lastModified,
                    resolution: 'remote',
                });
                merged.set(remoteEntity.id, { ...remoteEntity, syncStatus: 'synced' as const } as any);
            } else if (localTime > remoteTime) {
                conflicts.push({
                    entityType,
                    entityId: localEntity.id,
                    localTimestamp: localEntity.lastModified,
                    remoteTimestamp: remoteEntity.lastModified,
                    resolution: 'local',
                });
            }
        }
    });
    return Array.from(merged.values()).filter(e => !e.isDeleted);
}

export function mergeCompanyInfo(
    local: CompanyInfo | null,
    remote: CompanyInfo | null,
    conflicts: SyncConflict[]
): CompanyInfo | null {
    if (!local && !remote) return null;
    if (!local) return { ...(remote as any), syncStatus: 'synced' as const };
    if (!remote) return { ...local, syncStatus: 'synced' as const };
    const localTime = new Date(local.lastModified).getTime();
    const remoteTime = new Date(remote.lastModified).getTime();
    if (remoteTime > localTime) {
        conflicts.push({ entityType: 'company', entityId: 'company_info', localTimestamp: local.lastModified, remoteTimestamp: remote.lastModified, resolution: 'remote' });
        return { ...remote, syncStatus: 'synced' as const } as any;
    } else if (localTime > remoteTime) {
        conflicts.push({ entityType: 'company', entityId: 'company_info', localTimestamp: local.lastModified, remoteTimestamp: remote.lastModified, resolution: 'local' });
    }
    return { ...local, syncStatus: 'synced' as const } as any;
}

export function mergeTaxSettings(
    local: any | null,
    remote: any | null,
    conflicts: SyncConflict[]
): any | null {
    if (!local && !remote) return null;
    if (!local) return { ...(remote as any), syncStatus: 'synced' as const };
    if (!remote) return { ...local, syncStatus: 'synced' as const };
    const localTime = new Date(local.lastModified).getTime();
    const remoteTime = new Date(remote.lastModified).getTime();
    if (remoteTime > localTime) {
        conflicts.push({ entityType: 'taxSettings', entityId: 'personal_tax_settings', localTimestamp: local.lastModified, remoteTimestamp: remote.lastModified, resolution: 'remote' });
        return { ...remote, syncStatus: 'synced' as const } as any;
    } else if (localTime > remoteTime) {
        conflicts.push({ entityType: 'taxSettings', entityId: 'personal_tax_settings', localTimestamp: local.lastModified, remoteTimestamp: remote.lastModified, resolution: 'local' });
    }
    return { ...local, syncStatus: 'synced' as const } as any;
}

// ===== SAVE CLEANUP =====
export function cleanEntityForSave<T extends Record<string, any>>(entity: T): Omit<T, 'syncStatus'> {
    const { syncStatus, ...clean } = entity as any;
    return clean as Omit<T, 'syncStatus'>;
}


