import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Link2,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, type BulkImportJob, type EnrichedBook } from '../../utils/api';

const COVER_OPTIONS = [
  { label: 'Mathematics Geometric', url: '/src/assets/images/cover_mathematics_1795146975787.jpg' },
  { label: 'Science Botanical & Orbit', url: '/src/assets/images/cover_science_1795146975807.jpg' },
  { label: 'Literature Linen & Quill', url: '/src/assets/images/cover_literature_1795146976453.jpg' },
  { label: 'Early Learning Paper-Craft', url: '/src/assets/images/cover_early_learning_1795146976262.jpg' },
];

export const AdminBooksTab: React.FC = () => {
  const { classes, boards, subjects, contentLanguages, openReader, refreshAll } = useApp();
  const [adminBooks, setAdminBooks] = useState<EnrichedBook[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<Partial<EnrichedBook> | null>(null);
  const [pageBody, setPageBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Link edition state
  const [linkSourceId, setLinkSourceId] = useState('');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  // Bulk import state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkJson, setBulkJson] = useState(
    JSON.stringify(
      [
        {
          title: 'विज्ञान — कक्षा 7',
          isbn: '978-93-81009-07-1',
          rightsHolder: 'VidyaKosha Academic Press',
          licenseNumber: 'PUB-VK-2026-701',
          distributionPermissionGranted: true,
          classId: 'cls-7',
          boardId: 'brd-cbse',
          subjectId: 'sub-sci',
          contentLanguageCode: 'hi',
          isFree: true,
        },
        {
          title: 'Incomplete Row Without License',
          isbn: '978-93-00000-00-0',
          rightsHolder: '',
          licenseNumber: '',
        },
      ],
      null,
      2
    )
  );
  const [bulkJob, setBulkJob] = useState<BulkImportJob | null>(null);

  const loadBooks = async () => {
    const res = await apiFetch<{ books: EnrichedBook[] }>('/api/books?includeUnpublished=1');
    setAdminBooks(res.books);
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const filtered = adminBooks.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${b.title} ${b.author} ${b.isbn}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const openNewBook = () => {
    setFormError(null);
    setPageBody(
      'Chapter 1: Core Concepts\n\nWrite or paste curriculum textbook content here. Publishing requires verified distribution rights below.'
    );
    setEditing({
      title: '',
      subtitle: '',
      author: '',
      publisher: 'VidyaKosha Academic Press',
      editionLabel: '2026 Edition',
      academicYear: '2026-27',
      isbn: `978-93-${Math.floor(100000 + Math.random() * 899999)}`,
      description: '',
      coverUrl: COVER_OPTIONS[0].url,
      format: 'reflowable',
      classId: 'cls-10',
      boardId: 'brd-cbse',
      subjectId: 'sub-math',
      contentLanguageCode: 'hi',
      status: 'draft',
      isFree: true,
      price: 0,
      previewPagesCount: 2,
      license: {
        rightsHolder: '',
        licenseType: 'publisher_direct',
        licenseNumber: '',
        distributionPermissionGranted: false,
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2028-12-31T00:00:00.000Z',
        allowOfflineDownload: true,
        allowPrinting: false,
        territoryCountries: ['IN'],
      },
    });
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFormError(null);
    setBusy(true);
    try {
      const payload = {
        ...editing,
        pages: editing.id
          ? undefined
          : [
              {
                pageNumber: 1,
                chapterTitle: 'Chapter 1',
                heading: editing.title || 'Lesson 1',
                body: pageBody || editing.description || 'Sample content',
              },
            ],
      };
      if (editing.id) {
        await apiFetch(`/api/admin/books/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/books', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      await loadBooks();
      await refreshAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save book.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBook = async (id: string) => {
    await apiFetch(`/api/admin/books/${id}`, { method: 'DELETE' });
    await loadBooks();
    await refreshAll();
  };

  const handleLinkEditions = async () => {
    if (!linkSourceId || !linkTargetId || linkSourceId === linkTargetId) return;
    const res = await apiFetch<{ editionGroupId: string }>('/api/admin/edition-groups/link', {
      method: 'POST',
      body: JSON.stringify({ sourceBookId: linkSourceId, targetBookId: linkTargetId }),
    });
    setLinkMessage(`Linked into edition group ${res.editionGroupId}`);
    await loadBooks();
    await refreshAll();
  };

  const handleRunBulkImport = async () => {
    setFormError(null);
    try {
      const rows = JSON.parse(bulkJson);
      const res = await apiFetch<{ job: BulkImportJob }>('/api/admin/books/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
      setBulkJob(res.job);
      await loadBooks();
      await refreshAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Invalid JSON format.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search books or ISBN..."
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          />
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBulk((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Bulk Metadata Import</span>
          </button>
          <button
            type="button"
            onClick={openNewBook}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Book / Upload Content</span>
          </button>
        </div>
      </div>

      {/* Bulk Import Panel */}
      {showBulk && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Bulk Book Metadata Import</h3>
          <p className="mt-1 text-xs text-slate-600">
            All imported rows enter as Draft and must include valid rightsHolder and licenseNumber.
          </p>
          <textarea
            rows={7}
            value={bulkJson}
            onChange={(e) => setBulkJson(e.target.value)}
            className="font-mono-num mt-3 w-full rounded-lg border border-slate-300 p-3 text-xs"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRunBulkImport}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              Run Import Job
            </button>
            {bulkJob && (
              <div className="text-xs text-slate-700">
                Processed {bulkJob.processedRows}/{bulkJob.totalRows} · Succeeded: {bulkJob.successCount} · Errors:{' '}
                {bulkJob.errorCount}
                {bulkJob.errors.length > 0 && (
                  <span className="ml-2 text-red-700">
                    ({bulkJob.errors.map((e) => `Row ${e.row}: ${e.message}`).join('; ')})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Language Editions Tool */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
          <Link2 className="h-4 w-4 text-blue-800" aria-hidden="true" />
          Link Language Editions:
        </span>
        <select
          aria-label="Primary book edition"
          value={linkSourceId}
          onChange={(e) => setLinkSourceId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
        >
          <option value="">Select primary edition...</option>
          {adminBooks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} ({b.contentLanguageCode.toUpperCase()})
            </option>
          ))}
        </select>
        <select
          aria-label="Target book edition to link"
          value={linkTargetId}
          onChange={(e) => setLinkTargetId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
        >
          <option value="">Select edition to link...</option>
          {adminBooks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} ({b.contentLanguageCode.toUpperCase()})
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
        {linkMessage && <span className="text-emerald-700 font-medium">{linkMessage}</span>}
      </div>

      {/* Books Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Title &amp; ISBN</th>
              <th className="px-4 py-3 font-semibold">Format / Lang</th>
              <th className="px-4 py-3 font-semibold">License Status</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Reads</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{b.title}</p>
                  <p className="font-mono-num text-[11px] text-slate-500">
                    {b.isbn} · Group: {b.editionGroupId}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {b.format.toUpperCase()} · {b.contentLanguageCode.toUpperCase()}
                </td>
                <td className="px-4 py-3">
                  {b.license.distributionPermissionGranted ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {b.license.licenseNumber}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Unverified Rights
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 uppercase font-semibold text-slate-700">{b.status}</td>
                <td className="px-4 py-3 text-right font-mono-num text-slate-700">{b.readCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openReader(b)}
                      title="Preview before publishing"
                      className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setEditing(b);
                      }}
                      className="rounded border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBook(b.id)}
                      aria-label={`Delete ${b.title}`}
                      className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
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

      {/* Add / Edit Book & License Verification Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleSaveBook}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editing.id ? 'Edit Book & Licensing' : 'Create / Upload New Book'}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-slate-600"
              >
                Close
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{formError}</div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block font-medium text-slate-700">Title *</label>
                <input
                  type="text"
                  required
                  value={editing.title || ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Subtitle</label>
                <input
                  type="text"
                  value={editing.subtitle || ''}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Author</label>
                <input
                  type="text"
                  value={editing.author || ''}
                  onChange={(e) => setEditing({ ...editing, author: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">ISBN</label>
                <input
                  type="text"
                  value={editing.isbn || ''}
                  onChange={(e) => setEditing({ ...editing, isbn: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block font-medium text-slate-700">Class</label>
                <select
                  value={editing.classId}
                  onChange={(e) => setEditing({ ...editing, classId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700">Board</label>
                <select
                  value={editing.boardId}
                  onChange={(e) => setEditing({ ...editing, boardId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700">Subject</label>
                <select
                  value={editing.subjectId}
                  onChange={(e) => setEditing({ ...editing, subjectId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700">Content Language</label>
                <select
                  value={editing.contentLanguageCode}
                  onChange={(e) => setEditing({ ...editing, contentLanguageCode: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  {contentLanguages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block font-medium text-slate-700">Format</label>
                <select
                  value={editing.format}
                  onChange={(e) =>
                    setEditing({ ...editing, format: e.target.value as EnrichedBook['format'] })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  <option value="reflowable">Reflowable</option>
                  <option value="pdf">PDF</option>
                  <option value="epub">EPUB</option>
                  <option value="image_pages">Image Pages</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as EnrichedBook['status'] })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700">Price (0 = Free)</label>
                <input
                  type="number"
                  min={0}
                  value={editing.price ?? 0}
                  onChange={(e) => {
                    const price = Number(e.target.value);
                    setEditing({ ...editing, price, isFree: price === 0 });
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Free Preview Pages</label>
                <input
                  type="number"
                  min={1}
                  value={editing.previewPagesCount ?? 2}
                  onChange={(e) => setEditing({ ...editing, previewPagesCount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700">Cover Artwork</label>
              <select
                value={editing.coverUrl}
                onChange={(e) => setEditing({ ...editing, coverUrl: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
              >
                {COVER_OPTIONS.map((c) => (
                  <option key={c.url} value={c.url}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {!editing.id && (
              <div>
                <label className="block font-medium text-slate-700">Initial Chapter Text Content</label>
                <textarea
                  rows={4}
                  value={pageBody}
                  onChange={(e) => setPageBody(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                />
              </div>
            )}

            {/* Mandatory Licensing & Distribution Rights Gate */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-blue-800" />
                <span>Mandatory Distribution Rights &amp; License Clearance</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-medium text-slate-700">Rights Holder *</label>
                  <input
                    type="text"
                    value={editing.license?.rightsHolder || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        license: { ...editing.license!, rightsHolder: e.target.value },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700">License Number *</label>
                  <input
                    type="text"
                    value={editing.license?.licenseNumber || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        license: { ...editing.license!, licenseNumber: e.target.value },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700">License Type</label>
                  <select
                    value={editing.license?.licenseType || 'publisher_direct'}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        license: {
                          ...editing.license!,
                          licenseType: e.target.value as NonNullable<EnrichedBook['license']>['licenseType'],
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                  >
                    <option value="publisher_direct">Publisher Direct</option>
                    <option value="open_oer">Open Educational Resource (OER)</option>
                    <option value="public_domain">Public Domain</option>
                    <option value="institutional_contract">Institutional Contract</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.license?.distributionPermissionGranted)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        license: { ...editing.license!, distributionPermissionGranted: e.target.checked },
                      })
                    }
                  />
                  <span>Distribution permission verified &amp; granted</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.license?.allowOfflineDownload)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        license: { ...editing.license!, allowOfflineDownload: e.target.checked },
                      })
                    }
                  />
                  <span>Allow offline download</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.license?.allowPrinting)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        license: { ...editing.license!, allowPrinting: e.target.checked },
                      })
                    }
                  />
                  <span>Allow printing</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-900 px-5 py-2 font-medium text-white hover:bg-blue-800"
              >
                {busy ? 'Saving...' : 'Save Book'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
