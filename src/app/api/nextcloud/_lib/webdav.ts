'use server';

// ===== TYPES =====
export interface WebDavItem {
    name: string;
    isDir: boolean;
    lastModified: string | null;
    size: number | null;
}

// ===== INTERNAL UTILS =====
function getEnv() {
    const base = process.env.NEXTCLOUD_BASE_URL || '';
    const user = process.env.NEXTCLOUD_USERNAME || '';
    const pass = process.env.NEXTCLOUD_APP_PASSWORD || '';
    const root = process.env.NEXTCLOUD_ROOT_DIR || 'InvoiceManager';

    if (!base || !user || !pass) {
        throw new Error('Nextcloud env vars missing. Set NEXTCLOUD_BASE_URL, NEXTCLOUD_USERNAME, NEXTCLOUD_APP_PASSWORD.');
    }

    return { base: base.replace(/\/$/, ''), user, pass, root: root.replace(/^\/+|\/+$/g, '') };
}

function authHeader(user: string, pass: string): string {
    const token = Buffer.from(`${user}:${pass}`).toString('base64');
    return `Basic ${token}`;
}

function normalizePath(pathRelative: string): string {
    const clean = pathRelative.replace(/^\/+|\/+$/g, '');
    // Encode each segment to preserve slashes
    return clean.split('/').map(encodeURIComponent).join('/');
}

function buildUrl(pathRelative: string): string {
    const { base, user, root } = getEnv();
    const pathWithinRoot = normalizePath(`${root}/${pathRelative}`.replace(/^\/+/, ''));
    return `${base}/remote.php/dav/files/${encodeURIComponent(user)}/${pathWithinRoot}`;
}

async function webdavRequest(method: string, pathRelative: string, body?: BodyInit | null, extraHeaders?: HeadersInit): Promise<Response> {
    const { user, pass } = getEnv();
    const url = buildUrl(pathRelative);
    const headers: HeadersInit = {
        Authorization: authHeader(user, pass),
        ...extraHeaders,
    };
    const res = await fetch(url, {
        method,
        headers,
        body: body ?? undefined,
        cache: 'no-store',
    });
    return res;
}

// ===== API HELPERS =====
export async function propfind(pathRelative: string, depth: number = 1): Promise<string> {
    const res = await webdavRequest('PROPFIND', pathRelative.replace(/^\/+/, ''), null, {
        Depth: String(depth),
    });
    if (!res.ok && res.status !== 207) {
        throw new Error(`PROPFIND failed: ${res.status} ${res.statusText}`);
    }
    return await res.text();
}

export async function mkcol(pathRelative: string): Promise<void> {
    const res = await webdavRequest('MKCOL', pathRelative.replace(/^\/+/, ''));
    if (res.status === 201) return; // Created
    if (res.status === 405 || res.status === 409) return; // Already exists or missing parent
    if (!res.ok) {
        throw new Error(`MKCOL failed: ${res.status} ${res.statusText}`);
    }
}

export async function ensureDirectory(pathRelative: string): Promise<void> {
    const parts = pathRelative.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        try {
            await mkcol(current);
        } catch (e) {
            // Try to continue to create deeper levels even if a level errors due to existence
        }
    }
}

export async function getFile(pathRelative: string): Promise<Response> {
    return await webdavRequest('GET', pathRelative.replace(/^\/+/, ''));
}

export async function putFile(pathRelative: string, content: ArrayBuffer | Uint8Array | string, contentType?: string): Promise<void> {
    // Ensure parent directory exists
    const segments = pathRelative.replace(/^\/+|\/+$/g, '').split('/');
    if (segments.length > 1) {
        const parent = segments.slice(0, -1).join('/');
        await ensureDirectory(parent);
    }
    const headers: HeadersInit = {};
    if (contentType) headers['Content-Type'] = contentType;
    const body = typeof content === 'string' ? content : Buffer.from(content);
    const res = await webdavRequest('PUT', pathRelative.replace(/^\/+/, ''), body, headers);
    if (!(res.ok || res.status === 201 || res.status === 204)) {
        throw new Error(`PUT failed: ${res.status} ${res.statusText}`);
    }
}

export async function deleteFile(pathRelative: string): Promise<void> {
    const res = await webdavRequest('DELETE', pathRelative.replace(/^\/+/, ''));
    if (res.status === 404) return;
    if (!res.ok) {
        throw new Error(`DELETE failed: ${res.status} ${res.statusText}`);
    }
}

export async function pingRoot(): Promise<boolean> {
    try {
        await ensureDirectory(''); // no-op safeguard
        const xml = await propfind('', 0);
        return !!xml;
    } catch {
        return false;
    }
}

// ===== XML PARSER =====
export function parsePropfindXml(xml: string): WebDavItem[] {
    // Very small, defensive parser extracting name, directory flag, lastModified, and size
    const items: WebDavItem[] = [];
    const responseBlocks = xml.split('<d:response').slice(1); // skip preamble
    for (const block of responseBlocks) {
        const segment = '<d:response' + block;
        const hrefMatch = segment.match(/<d:href>(.*?)<\/d:href>/s) || segment.match(/<href>(.*?)<\/href>/s);
        if (!hrefMatch) continue;
        const href = decodeURIComponent(hrefMatch[1]);
        // Extract the last path segment as name
        const parts = href.replace(/\/+$/, '').split('/');
        const name = parts[parts.length - 1] || '';
        // Skip the folder itself (empty name)
        if (!name) continue;

        const isDir = /<d:collection\s*\/?>(?:<\/d:collection>)?/s.test(segment) || /<collection\s*\/?>(?:<\/collection>)?/s.test(segment);
        const lastModMatch = segment.match(/<d:getlastmodified>(.*?)<\/d:getlastmodified>/s) || segment.match(/<getlastmodified>(.*?)<\/getlastmodified>/s);
        const sizeMatch = segment.match(/<d:getcontentlength>(\d+)<\/d:getcontentlength>/s) || segment.match(/<getcontentlength>(\d+)<\/getcontentlength>/s);

        items.push({
            name,
            isDir,
            lastModified: lastModMatch ? lastModMatch[1] : null,
            size: sizeMatch ? Number(sizeMatch[1]) : null,
        });
    }
    return items;
}


