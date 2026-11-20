import type { Book, BookPage } from '../shared/types';

export interface ParsedTextBook {
  format: Book['format'];
  pages: BookPage[];
  suggestedTitle: string;
}

/** Split plain text cleanly into ~1600-character textbook pages */
export function paginatePlainText(rawText: string, baseTitle = 'Chapter'): BookPage[] {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) {
    return [
      {
        pageNumber: 1,
        chapterTitle: `${baseTitle} 1`,
        heading: baseTitle,
        body: 'Uploaded book document ready for viewing and download.',
      },
    ];
  }

  const paragraphs = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const pages: BookPage[] = [];
  let bucket: string[] = [];
  let bucketLen = 0;

  const flush = () => {
    if (bucket.length === 0) return;
    const pageNum = pages.length + 1;
    const firstLine = bucket[0].split('\n')[0].trim();
    const heading = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine || `Page ${pageNum}`;
    pages.push({
      pageNumber: pageNum,
      chapterTitle: `${baseTitle} · Page ${pageNum}`,
      heading,
      body: bucket.join('\n\n'),
    });
    bucket = [];
    bucketLen = 0;
  };

  for (const para of paragraphs) {
    if (bucketLen > 0 && bucketLen + para.length > 1600) {
      flush();
    }
    if (para.length > 2200) {
      for (let i = 0; i < para.length; i += 1600) {
        bucket.push(para.slice(i, i + 1600));
        flush();
      }
    } else {
      bucket.push(para);
      bucketLen += para.length;
    }
  }
  flush();

  return pages.length > 0
    ? pages
    : [
        {
          pageNumber: 1,
          chapterTitle: `${baseTitle} 1`,
          heading: baseTitle,
          body: normalized,
        },
      ];
}

export function stripHtmlToText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|br|section|article)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned;
}

export function stripRtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n\n')
    .replace(/\{\\\*[^{}]*\}/g, ' ')
    .replace(/\\[a-z]+-?\d*\s?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractXmlParagraphText(xml: string): string {
  // Works for DOCX (<w:p>, <w:t>) and ODT (<text:p>)
  const withBreaks = xml
    .replace(/<\/w:p>/gi, '\n\n')
    .replace(/<\/text:p>/gi, '\n\n')
    .replace(/<\/text:h>/gi, '\n\n')
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return withBreaks;
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedData: Uint8Array;
}

/** Pure TypeScript ZIP reader (reads local file headers + Store/Deflate-raw entries) */
async function readZipEntries(bytes: Uint8Array): Promise<{ name: string; data: Uint8Array }[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder('utf-8');
  const rawEntries: ZipEntry[] = [];

  // Prefer End of Central Directory (0x06054b50) to reliably handle data descriptors
  let eocdOffset = -1;
  const searchStart = Math.max(0, bytes.length - 65558);
  for (let i = bytes.length - 22; i >= searchStart; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset >= 0) {
    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let ptr = cdOffset;
    const end = Math.min(bytes.length, cdOffset + cdSize);

    while (ptr + 46 <= end && view.getUint32(ptr, true) === 0x02014b50) {
      const compressionMethod = view.getUint16(ptr + 10, true);
      const compressedSize = view.getUint32(ptr + 20, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHeaderOffset = view.getUint32(ptr + 42, true);
      const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

      if (localHeaderOffset + 30 <= bytes.length && view.getUint32(localHeaderOffset, true) === 0x04034b50) {
        const lNameLen = view.getUint16(localHeaderOffset + 26, true);
        const lExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
        const dataEnd = Math.min(bytes.length, dataStart + compressedSize);
        if (!name.endsWith('/') && compressedSize > 0) {
          rawEntries.push({
            name,
            compressionMethod,
            compressedData: bytes.subarray(dataStart, dataEnd),
          });
        }
      }
      ptr += 46 + nameLen + extraLen + commentLen;
    }
  }

  const out: { name: string; data: Uint8Array }[] = [];
  for (const entry of rawEntries) {
    try {
      if (entry.compressionMethod === 0) {
        out.push({ name: entry.name, data: entry.compressedData });
      } else if (entry.compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        const copy = new Uint8Array(entry.compressedData.byteLength);
        copy.set(entry.compressedData);
        writer.write(copy);
        writer.close();
        const decompressed = await new Response(ds.readable).arrayBuffer();
        out.push({ name: entry.name, data: new Uint8Array(decompressed) });
      }
    } catch {
      // Skip unreadable entry and continue extracting the rest
    }
  }
  return out;
}

export async function parseNonPdfBytes(bytes: Uint8Array, fileName: string): Promise<ParsedTextBook> {
  const lower = fileName.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';
  const suggestedTitle = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Uploaded Book';
  const decoder = new TextDecoder('utf-8', { fatal: false });

  // 1. EPUB (ZIP of XHTML/HTML chapter files)
  if (ext === 'epub') {
    try {
      const entries = await readZipEntries(bytes);
      const chapterFiles = entries
        .filter((e) => /\.(xhtml|html|htm)$/i.test(e.name) && !/toc|nav|cover/i.test(e.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      const fallbackFiles = chapterFiles.length > 0 ? chapterFiles : entries.filter((e) => /\.(xhtml|html|htm)$/i.test(e.name));
      const allPages: BookPage[] = [];
      for (const ch of fallbackFiles.slice(0, 80)) {
        const text = stripHtmlToText(decoder.decode(ch.data));
        if (text.length < 10) continue;
        const chPages = paginatePlainText(text, suggestedTitle);
        for (const p of chPages) {
          allPages.push({ ...p, pageNumber: allPages.length + 1 });
        }
      }
      if (allPages.length > 0) {
        return { format: 'epub', pages: allPages, suggestedTitle };
      }
    } catch {
      // Fall through to generic epub summary page
    }
    return {
      format: 'epub',
      suggestedTitle,
      pages: [
        {
          pageNumber: 1,
          chapterTitle: suggestedTitle,
          heading: `${suggestedTitle} (EPUB)`,
          body: `EPUB book "${fileName}" uploaded successfully. Use the attached file button below to open or download if needed.`,
        },
      ],
    };
  }

  // 2. DOCX / ODT
  if (ext === 'docx' || ext === 'odt') {
    try {
      const entries = await readZipEntries(bytes);
      const docEntry = entries.find((e) =>
        ext === 'docx' ? e.name === 'word/document.xml' : e.name === 'content.xml'
      );
      if (docEntry) {
        const text = extractXmlParagraphText(decoder.decode(docEntry.data));
        if (text.length > 0) {
          return { format: 'reflowable', pages: paginatePlainText(text, suggestedTitle), suggestedTitle };
        }
      }
    } catch {
      // Fall through cleanly
    }
  }

  // 3. HTML / XHTML / XML
  if (ext === 'html' || ext === 'htm' || ext === 'xhtml') {
    const text = stripHtmlToText(decoder.decode(bytes));
    return { format: 'reflowable', pages: paginatePlainText(text, suggestedTitle), suggestedTitle };
  }

  // 4. RTF
  if (ext === 'rtf') {
    const text = stripRtfToText(decoder.decode(bytes));
    return { format: 'reflowable', pages: paginatePlainText(text, suggestedTitle), suggestedTitle };
  }

  // 5. Plain Text / Markdown / CSV / JSON / YAML / XML / FB2
  if (['txt', 'md', 'markdown', 'csv', 'json', 'yaml', 'yml', 'log', 'xml', 'fb2'].includes(ext)) {
    const raw = decoder.decode(bytes);
    const cleaned = ext === 'fb2' || ext === 'xml' ? stripHtmlToText(raw) : raw;
    return { format: 'reflowable', pages: paginatePlainText(cleaned, suggestedTitle), suggestedTitle };
  }

  // 6. Legacy .doc / .ppt / .pptx / .djvu / .cbz / any other format -> always accepted!
  const rawProbe = decoder.decode(bytes.subarray(0, Math.min(bytes.length, 64000)));
  const printableLines = rawProbe
    .replace(/[^\x20-\x7E\u0900-\u097F\n\r\t]/g, ' ')
    .replace(/[ \t]{3,}/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 24 && /[a-zA-Z\u0900-\u097F]{4,}/.test(l));

  if (printableLines.length >= 2) {
    return {
      format: 'reflowable',
      suggestedTitle,
      pages: paginatePlainText(printableLines.slice(0, 120).join('\n\n'), suggestedTitle),
    };
  }

  return {
    format: 'reflowable',
    suggestedTitle,
    pages: [
      {
        pageNumber: 1,
        chapterTitle: suggestedTitle,
        heading: `${suggestedTitle}${ext ? ` (.${ext.toUpperCase()})` : ''}`,
        body: `Book file "${fileName}" has been uploaded and verified. Open or download the authorized attachment below.`,
      },
    ],
  };
}
