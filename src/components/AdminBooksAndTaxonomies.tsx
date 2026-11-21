import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  FileUp,
  Link2,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Book, BookPage, BulkImportJob } from '../shared/types';
import { apiFetch, type EnrichedBook } from '../utils/api';
import { formatFileSize, processAndUploadBookFiles } from '../utils/pdfUtils';

export const AdminBooksSection: React.FC<{
  allBooks: EnrichedBook[];
  bulkJobs: BulkImportJob[];
  onRefresh: () => Promise<void>;
}> = ({ allBooks, bulkJobs, onRefresh }) => {
  const { classes, boards, subjects, contentLanguages, openReader } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState('');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  // Form state for New Book / Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [isbn, setIsbn] = useState('');
  const [classId, setClassId] = useState('cls-10');
  const [boardId, setBoardId] = useState('brd-cbse');
  const [subjectId, setSubjectId] = useState('sub-math');
  const [contentLang, setContentLang] = useState('hi');
  const [format, setFormat] = useState<'reflowable' | 'pdf' | 'epub' | 'image_pages'>('reflowable');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published' | 'archived'>('draft');
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState('299');
  const [previewPages, setPreviewPages] = useState('2');
  const [sampleHeading, setSampleHeading] = useState('Chapter 1: Introduction');
  const [sampleBody, setSampleBody] = useState('Authorized digital curriculum textbook content.');

  // Uploaded book file state (all formats: PDF, EPUB, TXT, MD, HTML, DOCX, DOC, RTF, Images, etc.)
  const [pdfFileId, setPdfFileId] = useState<string | undefined>(undefined);
  const [pdfFileName, setPdfFileName] = useState<string | undefined>(undefined);
  const [pdfFileSizeBytes, setPdfFileSizeBytes] = useState<number | undefined>(undefined);
  const [attachmentFileId, setAttachmentFileId] = useState<string | undefined>(undefined);
  const [attachmentFileName, setAttachmentFileName] = useState<string | undefined>(undefined);
  const [attachmentSizeBytes, setAttachmentSizeBytes] = useState<number | undefined>(undefined);
  const [attachmentMimeType, setAttachmentMimeType] = useState<string | undefined>(undefined);
  const [uploadedPageCount, setUploadedPageCount] = useState<number | undefined>(undefined);
  const [uploadedPages, setUploadedPages] = useState<BookPage[] | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  // Mandatory Licensing & Rights fields
  const [rightsHolder, setRightsHolder] = useState('');
  const [licenseType, setLicenseType] = useState<Book['license']['licenseType']>('publisher_direct');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [validUntil, setValidUntil] = useState('2028-12-31');
  const [distributionGranted, setDistributionGranted] = useState(false);
  const [allowOffline, setAllowOffline] = useState(true);
  const [allowPrint, setAllowPrint] = useState(false);

  // Bulk Import JSON/CSV rows
  const [bulkJson, setBulkJson] = useState('[]');
  const [bulkResult, setBulkResult] = useState<BulkImportJob | null>(null);

  const openNewBook = () => {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setAuthor('');
    setPublisher('');
    setIsbn('');
    setFormat('reflowable');
    setStatus('draft');
    setDistributionGranted(false);
    setRightsHolder('');
    setLicenseNumber('');
    setPdfFileId(undefined);
    setPdfFileName(undefined);
    setPdfFileSizeBytes(undefined);
    setAttachmentFileId(undefined);
    setAttachmentFileName(undefined);
    setAttachmentSizeBytes(undefined);
    setAttachmentMimeType(undefined);
    setUploadedPageCount(undefined);
    setUploadedPages(null);
    setError(null);
    setShowModal(true);
  };

  const openEditBook = (b: EnrichedBook) => {
    setEditingId(b.id);
    setTitle(b.title);
    setSubtitle(b.subtitle);
    setAuthor(b.author);
    setPublisher(b.publisher);
    setIsbn(b.isbn);
    setClassId(b.classId);
    setBoardId(b.boardId);
    setSubjectId(b.subjectId);
    setContentLang(b.contentLanguageCode);
    setFormat(b.format);
    setStatus(b.status);
    setIsFree(b.isFree);
    setPrice(String(b.price));
    setPreviewPages(String(b.previewPagesCount));
    setPdfFileId(b.pdfFileId);
    setPdfFileName(b.pdfFileName);
    setPdfFileSizeBytes(b.pdfFileSizeBytes);
    setAttachmentFileId(b.attachmentFileId);
    setAttachmentFileName(b.attachmentFileName);
    setAttachmentSizeBytes(b.attachmentSizeBytes);
    setAttachmentMimeType(b.attachmentMimeType);
    setUploadedPageCount(b.pdfFileId || b.attachmentFileId ? b.totalPages : undefined);
    setUploadedPages(null);
    setRightsHolder(b.license.rightsHolder);
    setLicenseType(b.license.licenseType);
    setLicenseNumber(b.license.licenseNumber);
    setValidUntil(b.license.validUntil.slice(0, 10));
    setDistributionGranted(b.license.distributionPermissionGranted);
    setAllowOffline(b.license.allowOfflineDownload);
    setAllowPrint(b.license.allowPrinting);
    setError(null);
    setShowModal(true);
  };

  const handleBookFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setError(null);
    setFileUploading(true);
    try {
      const result = await processAndUploadBookFiles(files);
      setFormat(result.format);
      setPdfFileId(result.pdfFileId);
      setPdfFileName(result.pdfFileName);
      setPdfFileSizeBytes(result.pdfFileSizeBytes);
      setAttachmentFileId(result.attachmentFileId);
      setAttachmentFileName(result.attachmentFileName);
      setAttachmentSizeBytes(result.attachmentSizeBytes);
      setAttachmentMimeType(result.attachmentMimeType);
      setUploadedPageCount(result.pageCount);
      setUploadedPages(result.pages);
      if (!title.trim() && result.suggestedTitle) {
        setTitle(result.suggestedTitle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload book file.');
    } finally {
      setFileUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const resolvedPages = uploadedPages
      ? uploadedPages
      : editingId
        ? undefined
        : [
            {
              pageNumber: 1,
              chapterTitle: 'Chapter 1',
              heading: sampleHeading,
              body: sampleBody,
            },
          ];

    const payload = {
      title,
      subtitle,
      author,
      publisher,
      isbn,
      classId,
      boardId,
      subjectId,
      contentLanguageCode: contentLang,
      format: pdfFileId ? 'pdf' : format,
      status,
      isFree,
      price: Number(price || 0),
      previewPagesCount: Number(previewPages || 2),
      totalPages: uploadedPageCount,
      pages: resolvedPages,
      pdfFileId: pdfFileId ?? null,
      pdfFileName: pdfFileName ?? null,
      pdfFileSizeBytes: pdfFileSizeBytes ?? null,
      attachmentFileId: attachmentFileId ?? null,
      attachmentFileName: attachmentFileName ?? null,
      attachmentSizeBytes: attachmentSizeBytes ?? null,
      attachmentMimeType: attachmentMimeType ?? null,
      license: {
        rightsHolder,
        licenseType,
        licenseNumber,
        distributionPermissionGranted: distributionGranted,
        validFrom: new Date().toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        allowOfflineDownload: allowOffline,
        allowPrinting: allowPrint,
        territoryCountries: ['IN'],
      },
    };
    try {
      if (editingId) {
        await apiFetch(`/api/admin/books/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/books', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save book.');
    }
  };

  const handleDeleteBook = async (id: string) => {
    await apiFetch(`/api/admin/books/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const handleLinkEditions = async () => {
    if (!linkSourceId || !linkTargetId || linkSourceId === linkTargetId) return;
    await apiFetch('/api/admin/edition-groups/link', {
      method: 'POST',
      body: JSON.stringify({ sourceBookId: linkSourceId, targetBookId: linkTargetId }),
    });
    setLinkSourceId('');
    setLinkTargetId('');
    await onRefresh();
  };

  const handleBulkImport = async () => {
    setError(null);
    try {
      const rows = JSON.parse(bulkJson);
      const res = await apiFetch<{ job: BulkImportJob }>('/api/admin/books/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
      setBulkResult(res.job);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format.');
    }
  };

  const visibleBooks = allBooks.filter((b) => statusFilter === 'all' || b.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Book Catalog, Linked Editions &amp; Distribution Licensing
          </h2>
          <p className="text-xs text-slate-600">
            Every book requires verified distribution permission and license number before publishing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBulkResult(null);
              setShowBulkModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
          >
            <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Bulk Metadata Import</span>
          </button>
          <button
            type="button"
            onClick={openNewBook}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add / Upload Book</span>
          </button>
        </div>
      </div>

      {/* Filter & Link Language Editions Bar */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-700">Status:</span>
          {(['all', 'published', 'draft', 'scheduled', 'archived'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-2.5 py-1 capitalize ${
                statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <select
            aria-label="Primary edition book"
            value={linkSourceId}
            onChange={(e) => setLinkSourceId(e.target.value)}
            className="max-w-[170px] rounded-lg border border-slate-300 px-2 py-1.5"
          >
            <option value="">Source Edition...</option>
            {allBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.contentLanguageCode})
              </option>
            ))}
          </select>
          <select
            aria-label="Target edition book to link"
            value={linkTargetId}
            onChange={(e) => setLinkTargetId(e.target.value)}
            className="max-w-[170px] rounded-lg border border-slate-300 px-2 py-1.5"
          >
            <option value="">Target Edition...</option>
            {allBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.contentLanguageCode})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLinkEditions}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50"
          >
            Link Editions
          </button>
        </div>
      </div>

      {/* Books Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Title &amp; Edition Group</th>
              <th className="px-4 py-3 font-semibold">Lang / Format</th>
              <th className="px-4 py-3 font-semibold">Rights &amp; License</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Reads</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleBooks.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{b.title}</p>
                  <p className="font-mono-num text-[11px] text-slate-500">
                    Group: {b.editionGroupId} · ISBN {b.isbn}
                  </p>
                </td>
                <td className="px-4 py-3 uppercase text-slate-700">
                  <span>{b.contentLanguageCode} · {b.format}</span>
                  {(b.pdfFileId || b.attachmentFileId) && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-blue-800">
                      <FileText className="h-2.5 w-2.5" />
                      {b.totalPages}p {b.pdfFileId ? 'PDF' : b.format.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {b.license.distributionPermissionGranted ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {b.license.licenseNumber}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Rights Unverified
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 capitalize font-medium text-slate-800">{b.status}</td>
                <td className="font-mono-num px-4 py-3 text-right">{b.readCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openReader(b)}
                      title="Preview before publish"
                      className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditBook(b)}
                      className="rounded border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBook(b.id)}
                      aria-label={`Delete ${b.title}`}
                      className="rounded border border-red-200 p-1 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Book + License Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-slate-900">
              {editingId ? 'Edit Book & Licensing Metadata' : 'Upload / Create Book'}
            </h3>
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>
            )}
            <form onSubmit={handleSaveBook} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Book Title"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Subtitle"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Author"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  required
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="ISBN"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2">
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select value={boardId} onChange={(e) => setBoardId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2">
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.code}</option>
                  ))}
                </select>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2">
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select value={contentLang} onChange={(e) => setContentLang(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2">
                  {contentLanguages.map((l) => (
                    <option key={l.code} value={l.code}>{l.nativeName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="rounded-lg border border-slate-300 px-2 py-2">
                  <option value="reflowable">Reflowable</option>
                  <option value="pdf">PDF</option>
                  <option value="epub">EPUB</option>
                  <option value="image_pages">Image Pages</option>
                </select>
                <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-lg border border-slate-300 px-2 py-2">
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                <input
                  type="number"
                  value={price}
                  disabled={isFree}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Price"
                  className="rounded-lg border border-slate-300 px-2 py-2"
                />
                <input
                  type="number"
                  value={previewPages}
                  onChange={(e) => setPreviewPages(e.target.value)}
                  placeholder="Preview pages"
                  className="rounded-lg border border-slate-300 px-2 py-2"
                />
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
                <span>Free open-access textbook</span>
              </label>

              {/* Universal Book File Upload Section (All Formats Accepted) */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">Upload Book File · PDF up to 500 MB</p>
                    <p className="text-[11px] text-slate-600">
                      PDFs up to 500 MB use cloud storage. Other formats support up to 50 MB and are prepared for the Reader &amp; Audio.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800">
                    {fileUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileUp className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {fileUploading
                        ? 'Processing File...'
                        : pdfFileId || attachmentFileId || uploadedPages
                          ? 'Replace File'
                          : 'Choose Book File'}
                    </span>
                    <input
                      type="file"
                      multiple
                      disabled={fileUploading}
                      onChange={handleBookFileSelect}
                      className="sr-only"
                    />
                  </label>
                </div>

                {(pdfFileId || attachmentFileId || uploadedPages) && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span className="font-medium">
                        {pdfFileName || attachmentFileName || `${uploadedPageCount || 1} page(s) ready`}
                      </span>
                      {(pdfFileSizeBytes || attachmentSizeBytes) ? (
                        <span className="text-slate-500">
                          ({formatFileSize(pdfFileSizeBytes || attachmentSizeBytes || 0)})
                        </span>
                      ) : null}
                      {uploadedPageCount ? (
                        <span className="font-mono-num text-slate-600">· {uploadedPageCount} pages</span>
                      ) : null}
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                        {format}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfFileId(undefined);
                        setPdfFileName(undefined);
                        setPdfFileSizeBytes(undefined);
                        setAttachmentFileId(undefined);
                        setAttachmentFileName(undefined);
                        setAttachmentSizeBytes(undefined);
                        setAttachmentMimeType(undefined);
                        setUploadedPageCount(undefined);
                        setUploadedPages(null);
                      }}
                      className="text-[11px] font-medium text-red-700 hover:underline"
                    >
                      Remove File
                    </button>
                  </div>
                )}
              </div>

              {!editingId && !pdfFileId && !attachmentFileId && !uploadedPages && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-800">Or Enter Manual Chapter Content (Optional for non-PDF)</p>
                  <input
                    value={sampleHeading}
                    onChange={(e) => setSampleHeading(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
                  />
                  <textarea
                    rows={3}
                    value={sampleBody}
                    onChange={(e) => setSampleBody(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
                  />
                </div>
              )}

              {/* Mandatory Licensing & Rights Section */}
              <div className="space-y-2.5 rounded-lg border border-slate-300 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Distribution Rights &amp; License Clearance (Required for Publish)</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    value={rightsHolder}
                    onChange={(e) => setRightsHolder(e.target.value)}
                    placeholder="Rights Holder / Publisher"
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5"
                  />
                  <input
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="License Reference #"
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5"
                  />
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <select
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value as typeof licenseType)}
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                  >
                    <option value="publisher_direct">Publisher Direct</option>
                    <option value="open_oer">Open OER</option>
                    <option value="institutional_contract">Institutional Contract</option>
                    <option value="public_domain">Public Domain</option>
                  </select>
                  <label className="flex items-center gap-1.5 font-medium text-slate-900">
                    <input
                      type="checkbox"
                      checked={distributionGranted}
                      onChange={(e) => setDistributionGranted(e.target.checked)}
                    />
                    <span>Verified distribution permission granted</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={allowOffline} onChange={(e) => setAllowOffline(e.target.checked)} />
                    <span>Allow offline</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={allowPrint} onChange={(e) => setAllowPrint(e.target.checked)} />
                    <span>Allow print</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-blue-900 px-5 py-2 font-medium text-white">
                  Save Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-slate-900">Bulk Metadata Import &amp; Error Report</h3>
            <p className="mt-1 text-xs text-slate-600">
              Rows missing ISBN, title, rightsHolder, or licenseNumber are automatically flagged and rejected.
            </p>
            <textarea
              rows={8}
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              className="font-mono-num mt-3 w-full rounded-lg border border-slate-300 p-3 text-xs"
            />
            {bulkResult && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  Processed {bulkResult.processedRows} rows · {bulkResult.successCount} imported ·{' '}
                  {bulkResult.errorCount} errors
                </p>
                {bulkResult.errors.map((err, i) => (
                  <p key={i} className="mt-1 text-red-700">
                    Row {err.row}: {err.message}
                  </p>
                ))}
              </div>
            )}
            {bulkJobs.length > 0 && (
              <div className="mt-3 text-xs text-slate-500">
                Recent import jobs: {bulkJobs.slice(0, 2).map((j) => `${j.successCount}/${j.totalRows} (${j.status})`).join(' · ')}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowBulkModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs">
                Close
              </button>
              <button type="button" onClick={handleBulkImport} className="rounded-lg bg-blue-900 px-4 py-2 text-xs font-medium text-white">
                Run Bulk Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminTaxonomiesSection: React.FC<{ onRefresh: () => Promise<void> }> = ({ onRefresh }) => {
  const { boards, classes, subjects, contentLanguages, uiLanguages } = useApp();
  const [boardCode, setBoardCode] = useState('');
  const [boardName, setBoardName] = useState('');
  const [className, setClassName] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [langCode, setLangCode] = useState('');
  const [langNative, setLangNative] = useState('');
  const [langTarget, setLangTarget] = useState<'contentLanguages' | 'uiLanguages'>('contentLanguages');

  const addItem = async (type: string, body: Record<string, unknown>) => {
    await apiFetch(`/api/admin/taxonomies/${type}`, { method: 'POST', body: JSON.stringify(body) });
    await onRefresh();
  };

  const toggleItem = async (type: string, id: string, enabled: boolean) => {
    await apiFetch(`/api/admin/taxonomies/${type}/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
    await onRefresh();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Boards */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-display text-base font-semibold text-slate-900">Education Boards</h3>
        <div className="mt-3 flex gap-2 text-xs">
          <input value={boardCode} onChange={(e) => setBoardCode(e.target.value)} placeholder="Code (e.g. NIOS)" className="w-28 rounded border border-slate-300 px-2.5 py-1.5" />
          <input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="Board Name" className="flex-1 rounded border border-slate-300 px-2.5 py-1.5" />
          <button
            type="button"
            onClick={() => {
              if (!boardCode || !boardName) return;
              addItem('boards', { code: boardCode, name: boardName });
              setBoardCode('');
              setBoardName('');
            }}
            className="rounded bg-blue-900 px-3 py-1.5 font-medium text-white"
          >
            Add
          </button>
        </div>
        <div className="mt-3 space-y-1.5 text-xs">
          {boards.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2">
              <span>{b.code} — {b.name}</span>
              <button
                type="button"
                onClick={() => toggleItem('boards', b.id, !b.enabled)}
                className={`font-medium ${b.enabled ? 'text-emerald-700' : 'text-slate-400'}`}
              >
                {b.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Languages (UI vs Content) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-display text-base font-semibold text-slate-900">UI &amp; Book Content Languages</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <select value={langTarget} onChange={(e) => setLangTarget(e.target.value as typeof langTarget)} className="rounded border border-slate-300 px-2 py-1.5">
            <option value="contentLanguages">Book Content Lang</option>
            <option value="uiLanguages">App UI Lang</option>
          </select>
          <input value={langCode} onChange={(e) => setLangCode(e.target.value)} placeholder="Code (ta, gu)" className="w-24 rounded border border-slate-300 px-2.5 py-1.5" />
          <input value={langNative} onChange={(e) => setLangNative(e.target.value)} placeholder="Native Name" className="flex-1 rounded border border-slate-300 px-2.5 py-1.5" />
          <button
            type="button"
            onClick={() => {
              if (!langCode || !langNative) return;
              addItem(langTarget, { code: langCode, name: langNative, nativeName: langNative });
              setLangCode('');
              setLangNative('');
            }}
            className="rounded bg-blue-900 px-3 py-1.5 font-medium text-white"
          >
            Add
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-semibold text-slate-600">UI Languages</p>
            {uiLanguages.map((l) => (
              <div key={l.code} className="mt-1 flex items-center justify-between rounded border border-slate-100 px-2.5 py-1.5">
                <span>{l.nativeName} ({l.code})</span>
                <button type="button" onClick={() => toggleItem('uiLanguages', l.code, !l.enabled)} className={l.enabled ? 'text-emerald-700' : 'text-slate-400'}>
                  {l.enabled ? 'On' : 'Off'}
                </button>
              </div>
            ))}
          </div>
          <div>
            <p className="font-semibold text-slate-600">Content Languages</p>
            {contentLanguages.map((l) => (
              <div key={l.code} className="mt-1 flex items-center justify-between rounded border border-slate-100 px-2.5 py-1.5">
                <span>{l.nativeName} ({l.code})</span>
                <button type="button" onClick={() => toggleItem('contentLanguages', l.code, !l.enabled)} className={l.enabled ? 'text-emerald-700' : 'text-slate-400'}>
                  {l.enabled ? 'On' : 'Off'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Classes */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-display text-base font-semibold text-slate-900">Classes (Nursery – Class 12)</h3>
        <div className="mt-3 flex gap-2 text-xs">
          <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="New Class / Grade" className="flex-1 rounded border border-slate-300 px-2.5 py-1.5" />
          <button
            type="button"
            onClick={() => {
              if (!className) return;
              addItem('classes', { code: className.slice(0, 4), name: className });
              setClassName('');
            }}
            className="rounded bg-blue-900 px-3 py-1.5 font-medium text-white"
          >
            Add
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleItem('classes', c.id, !c.enabled)}
              className={`rounded border px-2.5 py-1 ${c.enabled ? 'border-slate-300 bg-white text-slate-800' : 'border-slate-200 bg-slate-100 text-slate-400'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Subjects */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-display text-base font-semibold text-slate-900">Subjects</h3>
        <div className="mt-3 flex gap-2 text-xs">
          <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="New Subject" className="flex-1 rounded border border-slate-300 px-2.5 py-1.5" />
          <button
            type="button"
            onClick={() => {
              if (!subjectName) return;
              addItem('subjects', { name: subjectName, category: 'Elective' });
              setSubjectName('');
            }}
            className="rounded bg-blue-900 px-3 py-1.5 font-medium text-white"
          >
            Add
          </button>
        </div>
        <div className="mt-3 space-y-1 text-xs">
          {subjects.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
              <span>{s.name} · {s.category}</span>
              <button type="button" onClick={() => toggleItem('subjects', s.id, !s.enabled)} className={s.enabled ? 'text-emerald-700' : 'text-slate-400'}>
                {s.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
