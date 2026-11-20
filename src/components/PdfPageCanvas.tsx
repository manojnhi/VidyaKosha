import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';
import { resolveApiUrl } from '../utils/api';
import { getNativePdfBytes } from '../utils/nativeLocalApi';
import { ensurePdfWorker } from '../utils/pdfUtils';

interface PdfPageCanvasProps {
  pdfUrl: string;
  pageNumber: number;
  zoom: number;
  fitMode: 'width' | 'page';
  theme: 'light' | 'sepia' | 'dark';
}

export const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfUrl,
  pageNumber,
  zoom,
  fitMode,
  theme,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [docReadyUrl, setDocReadyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(720);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load PDF document once per pdfUrl
  useEffect(() => {
    let cancelled = false;
    ensurePdfWorker();
    setLoading(true);
    setError(null);
    setDocReadyUrl(null);

    const loadDoc = async () => {
      try {
        if (docRef.current) {
          docRef.current.cleanup();
          docRef.current = null;
        }
        if (loadingTaskRef.current) {
          await loadingTaskRef.current.destroy().catch(() => {});
          loadingTaskRef.current = null;
        }

        let pdfBytes: Uint8Array;
        if (pdfUrl.startsWith('native-pdf://')) {
          const id = pdfUrl.slice('native-pdf://'.length);
          const localBytes = getNativePdfBytes(id);
          if (!localBytes) throw new Error('Offline PDF binary unavailable.');
          pdfBytes = localBytes;
        } else {
          const res = await fetch(resolveApiUrl(pdfUrl));
          if (!res.ok) throw new Error(`Unable to fetch PDF (${res.status})`);
          pdfBytes = new Uint8Array(await res.arrayBuffer());
        }

        if (cancelled) return;
        const task = pdfjsLib.getDocument({ data: pdfBytes.slice() });
        loadingTaskRef.current = task;
        const doc = await task.promise;
        if (cancelled) {
          doc.cleanup();
          await task.destroy().catch(() => {});
          return;
        }
        docRef.current = doc;
        setDocReadyUrl(pdfUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to render PDF.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDoc();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      if (docRef.current) {
        docRef.current.cleanup();
        docRef.current = null;
      }
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy().catch(() => {});
        loadingTaskRef.current = null;
      }
    };
  }, [pdfUrl]);

  // Render active page on canvas whenever pageNumber, zoom, fitMode, or containerWidth updates
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || docReadyUrl !== pdfUrl) return;

    let cancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }
        const safePage = Math.max(1, Math.min(doc.numPages, pageNumber));
        const page = await doc.getPage(safePage);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const targetCssWidth =
          fitMode === 'width'
            ? Math.max(280, containerWidth - 16)
            : Math.min(Math.max(280, containerWidth - 16), Math.round(7.4 * zoom));
        const cssScale = targetCssWidth / baseViewport.width;
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);

        const viewport = page.getViewport({ scale: cssScale * outputScale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / outputScale)}px`;
        canvas.style.height = `${Math.floor(viewport.height / outputScale)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const renderTask = page.render({ canvasContext: ctx, viewport, canvas });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!cancelled && !msg.includes('Rendering cancelled')) {
          setError('Could not render this PDF page.');
        }
      }
    };

    renderPage();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [docReadyUrl, pdfUrl, pageNumber, zoom, fitMode, containerWidth]);

  const filterStyle =
    theme === 'dark'
      ? 'invert(0.9) hue-rotate(180deg)'
      : theme === 'sepia'
        ? 'sepia(0.24) contrast(0.98)'
        : 'none';

  return (
    <div ref={containerRef} className="relative flex w-full flex-col items-center justify-center py-2">
      {loading && (
        <div className="flex items-center gap-2 py-12 text-xs opacity-70">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading PDF page...</span>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>
      )}
      <canvas
        ref={canvasRef}
        data-testid="pdf-page-canvas"
        style={{ filter: filterStyle }}
        className={`max-w-full rounded shadow-sm transition-[filter] ${loading || error ? 'hidden' : 'block'}`}
      />
    </div>
  );
};
