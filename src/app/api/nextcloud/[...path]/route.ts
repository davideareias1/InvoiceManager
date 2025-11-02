import { NextResponse } from 'next/server';
import { deleteFile, getFile, parsePropfindXml, propfind, putFile, ensureDirectory } from '../_lib/webdav';

type RouteParams = { params: { path?: string[] } };

function getPath(params: RouteParams['params']): string {
    const segments = params.path || [];
    return segments.join('/');
}

export async function GET(req: Request, ctx: RouteParams) {
    const url = new URL(req.url);
    const list = url.searchParams.get('list');
    const path = getPath(ctx.params);
    try {
        if (list === '1') {
            const xml = await propfind(path, 1);
            const items = parsePropfindXml(xml);
            return NextResponse.json({ items });
        }
        const upstream = await getFile(path);
        const data = await upstream.arrayBuffer();
        // Pass through with same content-type if provided
        const headers: Record<string, string> = {};
        const ct = upstream.headers.get('content-type');
        if (ct) headers['content-type'] = ct;
        return new NextResponse(data, { status: upstream.status, headers });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Nextcloud GET error' }, { status: 500 });
    }
}

export async function PUT(req: Request, ctx: RouteParams) {
    const path = getPath(ctx.params);
    try {
        const contentType = req.headers.get('content-type') || undefined;
        const body = await req.arrayBuffer();
        // Ensure parent dirs exist
        const segments = path.split('/');
        if (segments.length > 1) {
            await ensureDirectory(segments.slice(0, -1).join('/'));
        }
        await putFile(path, body, contentType);
        return new NextResponse(null, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Nextcloud PUT error' }, { status: 500 });
    }
}

export async function DELETE(req: Request, ctx: RouteParams) {
    const path = getPath(ctx.params);
    try {
        await deleteFile(path);
        return new NextResponse(null, { status: 204 });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Nextcloud DELETE error' }, { status: 500 });
    }
}

export async function POST(req: Request, ctx: RouteParams) {
    // Use POST for special WebDAV methods like MKCOL and PROPFIND (workaround for limited HTTP verbs)
    try {
        const path = getPath(ctx.params);
        const method = req.headers.get('x-webdav-method') || '';
        if (method.toUpperCase() === 'MKCOL') {
            await ensureDirectory(path);
            return new NextResponse(null, { status: 201 });
        }
        if (method.toUpperCase() === 'PROPFIND') {
            const depthHeader = req.headers.get('x-webdav-depth');
            const depth = depthHeader ? Number(depthHeader) : 1;
            const xml = await propfind(path, depth);
            const items = parsePropfindXml(xml);
            return NextResponse.json({ items });
        }
        return NextResponse.json({ error: 'Unsupported x-webdav-method' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Nextcloud POST error' }, { status: 500 });
    }
}


