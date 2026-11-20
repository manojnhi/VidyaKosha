import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { BookPage } from '../shared/types';
import { getStoredToken, isCapacitorNative, resolveApiUrl } from './api';
import { storeNativePdfBytes } from './nativeLocalApi';

let workerConfigured = false;

export function ensurePdfWorker(): void {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerConfigured = true;
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface InspectedPdfResult {
  pageCount: number;
  pages: BookPage[];
  suggestedTitle: string;
}

export async function inspectPdfFile(file: File): Promise<InspectedPdfResult> {
  ensurePdfWorker();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;
  const pageCount = Math.max(1, doc.numPages);
  const textExtractLimit = Math.min(pageCount, 60);
  const pages: BookPage[] = [];

  for (let i = 1; i <= pageCount; i += 1) {
    if (i <= textExtractLimit) {
      try {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const rawText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const headingLine = rawText
          ? rawText.slice(0, 70).trim() + (rawText.length > 70 ? '…' : '')
          : `Page ${i}`;
        pages.push({
          pageNumber: i,
          chapterTitle: `Page ${i}`,
          heading: headingLine,
          body: rawText || `PDF Page ${i} (Visual PDF layout)`,
        });
      } catch {
        pages.push({
          pageNumber: i,
          chapterTitle: `Page ${i}`,
          heading: `Page ${i}`,
          body: `PDF Page ${i}`,
        });
      }
    } else {
      pages.push({
        pageNumber: i,
        chapterTitle: `Page ${i}`,
        heading: `Page ${i}`,
        body: `PDF Page ${i}`,
      });
    }
  }

  doc.cleanup();
  await loadingTask.destroy();
  const suggestedTitle = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  return { pageCount, pages, suggestedTitle };
}

export interface UploadedPdfMeta {
  pdfFileId: string;
  fileName: string;
  sizeBytes: number;
  pageCount: number;
}

export async function uploadPdfFile(file: File, detectedPageCount: number): Promise<UploadedPdfMeta> {
  const apiUrl = resolveApiUrl('/api/admin/books/upload-pdf');
  const isRemoteConfigured = apiUrl !== '/api/admin/books/upload-pdf';

  if (isCapacitorNative() && !isRemoteConfigured) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileId = `pdf-${Math.random().toString(36).slice(2, 10)}`;
    storeNativePdfBytes(fileId, bytes);
    return {
      pdfFileId: fileId,
      fileName: file.name,
      sizeBytes: bytes.byteLength,
      pageCount: detectedPageCount,
    };
  }

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'X-File-Name': encodeURIComponent(file.name),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: file,
  });

  if (!res.ok) {
    let msg = `PDF upload failed (${res.status})`;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (data?.error) msg = data.error;
    }
    throw new Error(msg);
  }

  return (await res.json()) as UploadedPdfMeta;
}
