"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// Configure worker
// @ts-ignore - pdfjs-dist ships the worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfViewerProps {
    src: string; // object URL
    className?: string;
}

export function PdfViewer({ src, className }: PdfViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [numPages, setNumPages] = useState<number>(0);

    useEffect(() => {
        let isCancelled = false;
        const render = async () => {
            if (!src || !containerRef.current) return;
            const container = containerRef.current;
            container.innerHTML = '';

            const loadingTask = pdfjsLib.getDocument(src);
            const pdf = await loadingTask.promise;
            if (isCancelled) return;
            setNumPages(pdf.numPages);

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                if (isCancelled) return;

                const viewport = page.getViewport({ scale: 0.9 });
                const canvas = document.createElement('canvas');
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
                canvas.className = 'block mx-auto rounded border border-neutral-200 bg-white';
                const context = canvas.getContext('2d');
                if (!context) continue;

                // Resize canvas to device pixel ratio for crisp rendering
                const outputScale = window.devicePixelRatio || 1;
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

                const renderContext = { canvasContext: context, transform, viewport } as any;
                await page.render(renderContext).promise;

                // Downscale via CSS
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;
                container.appendChild(canvas);
            }
        };

        render();
        return () => {
            isCancelled = true;
        };
    }, [src]);

    return (
        <div className={className}>
            <div className="flex items-center justify-between py-1 px-3 border-b border-neutral-200 bg-neutral-50 rounded-t">
                <div className="text-xs text-neutral-600">PDF Preview {numPages ? `( ${numPages} page${numPages > 1 ? 's' : ''} )` : ''}</div>
            </div>
            <div ref={containerRef} className="p-2 space-y-3 overflow-auto h-[68vh] flex flex-col items-center" />
        </div>
    );
}






