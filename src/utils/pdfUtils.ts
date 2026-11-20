import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import type { Book, BookPage } from '../shared/types';
import { getStoredToken, isCapacitorNative, resolveApiUrl } from './api';
import { parseNonPdfBytes } from './bookFileParser';
import { storeNativeFileDataUrl, storeNativePdfBytes } from './nativeLocalApi';

let workerConfigured = false;

export function ensurePdfWorker(): void {
  // Defensive main-thread polyfill for browsers lacking ES2025 Uint8Array.prototype.toHex
  const proto = Uint8Array.prototype as Uint8Array & { toHex?: () => string };
  if (typeof proto.toHex !== 'function') {
    Object.defineProperty(Uint8Array.prototype, 'toHex', {
      configurable: true,
      writable: true,
      value: function toHexPolyfill(this: Uint8Array): string {
        let hex = '';
        for (let i = 0; i < this.length; i += 1) {
          hex += this[i].toString(16).padStart(2, '0');
        }
        return hex;
      },
    });
  }

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
  const rawBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(rawBuffer);
  const suggestedTitle = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();

  try {
    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
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
    return { pageCount, pages, suggestedTitle };
  } catch {
    // Fallback to pure-JS pdf-lib page counter so unusual/encrypted PDFs never block upload
    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      pageCount = Math.max(1, pdfDoc.getPageCount());
    } catch {
      pageCount = 1;
    }
    const pages: BookPage[] = Array.from({ length: pageCount }, (_, idx) => ({
      pageNumber: idx + 1,
      chapterTitle: `Page ${idx + 1}`,
      heading: idx === 0 ? suggestedTitle || 'Page 1' : `Page ${idx + 1}`,
      body: `PDF Page ${idx + 1} (Visual PDF layout)`,
    }));
    return { pageCount, pages, suggestedTitle };
  }
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

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file bytes.'));
    reader.readAsDataURL(file);
  });
}

async function uploadGenericBookFile(file: File): Promise<{ fileId: string; fileName: string; sizeBytes: number; mimeType: string }> {
  const apiUrl = resolveApiUrl('/api/admin/books/upload-file');
  const isRemoteConfigured = apiUrl !== '/api/admin/books/upload-file';

  if (isCapacitorNative() && !isRemoteConfigured) {
    const fileId = `file-${Math.random().toString(36).slice(2, 10)}.bin`;
    const dataUrl = await readFileAsDataUrl(file);
    storeNativeFileDataUrl(fileId, dataUrl);
    return {
      fileId,
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
    };
  }

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'X-File-Name': encodeURIComponent(file.name),
    'X-Mime-Type': encodeURIComponent(file.type || 'application/octet-stream'),
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
    let msg = `File upload failed (${res.status})`;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (data?.error) msg = data.error;
    }
    throw new Error(msg);
  }

  return (await res.json()) as { fileId: string; fileName: string; sizeBytes: number; mimeType: string };
}

export interface UploadedBookAssetResult {
  format: Book['format'];
  fileName: string;
  sizeBytes: number;
  pageCount: number;
  pages: BookPage[];
  suggestedTitle: string;
  pdfFileId?: string;
  pdfFileName?: string;
  pdfFileSizeBytes?: number;
  attachmentFileId?: string;
  attachmentFileName?: string;
  attachmentSizeBytes?: number;
  attachmentMimeType?: string;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(file.name);
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Universal upload handler accepting ALL book formats (PDF, EPUB, TXT, MD, HTML, DOCX, DOC, RTF, Images, etc.) */
export async function processAndUploadBookFiles(files: File[]): Promise<UploadedBookAssetResult> {
  if (files.length === 0) {
    throw new Error('Please choose a book file to upload.');
  }
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  if (totalBytes > 50 * 1024 * 1024) {
    throw new Error('Selected upload size must be 50 MB or smaller.');
  }

  // Case 1: One or more image files -> create illustrated image_pages book
  if (files.every(isImageFile)) {
    const pages: BookPage[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      const uploaded = await uploadGenericBookFile(f);
      const cleanName = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      pages.push({
        pageNumber: i + 1,
        chapterTitle: `Page ${i + 1}`,
        heading: cleanName || `Page ${i + 1}`,
        body: `Illustrated page ${i + 1} (${f.name})`,
        attachmentFileId: uploaded.fileId,
      });
    }
    const primary = files[0];
    const displayName = files.length > 1 ? `${files.length} image pages (${primary.name}...)` : primary.name;
    const suggestedTitle = primary.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Illustrated Book';
    return {
      format: 'image_pages',
      fileName: displayName,
      sizeBytes: totalBytes,
      pageCount: pages.length,
      pages,
      suggestedTitle,
      attachmentFileName: displayName,
      attachmentSizeBytes: totalBytes,
    };
  }

  const file = files[0];

  // Case 2: PDF file
  if (isPdfFile(file)) {
    const inspected = await inspectPdfFile(file);
    const uploaded = await uploadPdfFile(file, inspected.pageCount);
    return {
      format: 'pdf',
      fileName: uploaded.fileName,
      sizeBytes: uploaded.sizeBytes,
      pageCount: uploaded.pageCount,
      pages: inspected.pages,
      suggestedTitle: inspected.suggestedTitle,
      pdfFileId: uploaded.pdfFileId,
      pdfFileName: uploaded.fileName,
      pdfFileSizeBytes: uploaded.sizeBytes,
    };
  }

  // Case 3: Any other format (EPUB, TXT, MD, HTML, DOCX, DOC, RTF, ODT, CSV, etc.)
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = await parseNonPdfBytes(bytes, file.name);
  const uploaded = await uploadGenericBookFile(file);

  return {
    format: parsed.format,
    fileName: uploaded.fileName,
    sizeBytes: uploaded.sizeBytes,
    pageCount: parsed.pages.length,
    pages: parsed.pages,
    suggestedTitle: parsed.suggestedTitle,
    attachmentFileId: uploaded.fileId,
    attachmentFileName: uploaded.fileName,
    attachmentSizeBytes: uploaded.sizeBytes,
    attachmentMimeType: uploaded.mimeType,
  };
}
