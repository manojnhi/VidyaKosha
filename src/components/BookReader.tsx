import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark as BookmarkIcon,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  Headphones,
  Highlighter,
  Layers,
  Lock,
  MessageSquarePlus,
  Minus,
  Moon,
  PenTool,
  Plus,
  Redo2,
  Search,
  Sun,
  Trash2,
  Underline,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { splitPageIntoAudioSegments } from '../shared/audioUtils';
import { resolveEditionSwitch } from '../shared/domainLogic';
import type { Annotation, BookPage, Bookmark, PenStroke } from '../shared/types';
import { apiFetch, type EnrichedBook } from '../utils/api';
import { AudioPlayerBar } from './AudioPlayerBar';

type ReaderTheme = 'light' | 'sepia' | 'dark';
type ReaderTool = 'read' | 'highlight' | 'underline' | 'pen' | 'note' | 'eraser';

interface LoadedBookContent {
  accessLevel: 'full' | 'preview_only';
  totalPages: number;
  allowedPages: number;
  pages: BookPage[];
  licensePermissions: {
    allowOfflineDownload: boolean;
    allowPrinting: boolean;
  };
}

export const BookReader: React.FC = () => {
  const {
    readerBook,
    readerStartAudio,
    books,
    contentLanguages,
    user,
    offlineBooks,
    saveBookOffline,
    closeReader,
    openReader,
    openCheckout,
    setShowAuthModal,
    t,
  } = useApp();

  const [activeBook, setActiveBook] = useState<EnrichedBook | null>(readerBook);
  const [content, setContent] = useState<LoadedBookContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [theme, setTheme] = useState<ReaderTheme>('light');
  const [zoom, setZoom] = useState(100);
  const [fitMode, setFitMode] = useState<'width' | 'page'>('page');
  const [twoPageSpread, setTwoPageSpread] = useState(false);
  const [fontSize, setFontSize] = useState(17);
  const [lineSpacing, setLineSpacing] = useState(1.7);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'toc' | 'thumbs' | 'search' | 'notes'>('toc');
  const [searchQuery, setSearchQuery] = useState('');

  const [tool, setTool] = useState<ReaderTool>('read');
  const [penColor, setPenColor] = useState('#1D4ED8');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Pen stroke history for Undo/Redo on current page
  const [strokes, setStrokes] = useState<PenStroke[]>([]);
  const [redoStack, setRedoStack] = useState<PenStroke[]>([]);
  const [dirtyMarks, setDirtyMarks] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const [noteInput, setNoteInput] = useState('');
  const [editionError, setEditionError] = useState<string | null>(null);
  const [showBookSwitcher, setShowBookSwitcher] = useState(false);
  const [audioOpen, setAudioOpen] = useState(readerStartAudio);
  const [audioAutoPlay, setAudioAutoPlay] = useState(readerStartAudio);
  const [activeAudioSegmentIndex, setActiveAudioSegmentIndex] = useState<number | null>(null);
  const [audioJumpRequest, setAudioJumpRequest] = useState<{ index: number; nonce: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const activeStrokeRef = useRef<PenStroke | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveBook(readerBook);
    setEditionError(null);
    if (readerStartAudio) {
      setAudioOpen(true);
      setAudioAutoPlay(true);
    }
  }, [readerBook, readerStartAudio]);

  // Fetch authorized content via temporary signed token (or offline bundle)
  useEffect(() => {
    if (!activeBook) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Try online signed token flow
        const tokenRes = await apiFetch<{
          accessToken: string;
          access: EnrichedBook['access'];
        }>(`/api/books/${activeBook.id}/access-token`, { method: 'POST' });
        const contentRes = await apiFetch<LoadedBookContent>(
          `/api/books/${activeBook.id}/content?token=${encodeURIComponent(tokenRes.accessToken)}`
        );
        if (cancelled) return;
        setContent(contentRes);

        if (user) {
          const stateRes = await apiFetch<{
            progress: { lastPage: number } | null;
            bookmarks: Bookmark[];
            annotations: Annotation[];
          }>(`/api/reader/state/${activeBook.id}`);
          if (cancelled) return;
          setBookmarks(stateRes.bookmarks);
          setAnnotations(stateRes.annotations);
          if (stateRes.progress?.lastPage) {
            setCurrentPage(Math.min(contentRes.allowedPages, stateRes.progress.lastPage));
          } else {
            setCurrentPage(1);
          }
        } else {
          setCurrentPage(1);
        }
      } catch (err) {
        // 2. Fallback to licensed offline bundle if offline
        const offline = offlineBooks[activeBook.id];
        if (offline && !cancelled) {
          setContent({
            accessLevel: 'full',
            totalPages: offline.pages.length,
            allowedPages: offline.pages.length,
            pages: offline.pages,
            licensePermissions: { allowOfflineDownload: true, allowPrinting: false },
          });
          setCurrentPage(1);
        } else if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to open book.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activeBook, user, offlineBooks]);

  // Sync page pen strokes when page or annotations change
  useEffect(() => {
    const pagePen = annotations.find((a) => a.pageNumber === currentPage && a.type === 'pen');
    setStrokes(pagePen?.strokes || []);
    setRedoStack([]);
    setDirtyMarks(false);
  }, [currentPage, annotations]);

  // Auto-save reading progress
  useEffect(() => {
    if (!activeBook || !user || !content) return;
    const timer = setTimeout(() => {
      apiFetch('/api/reader/progress', {
        method: 'PUT',
        body: JSON.stringify({ bookId: activeBook.id, lastPage: currentPage }),
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [activeBook, user, content, currentPage]);

  // Redraw HTML5 Canvas whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      stroke.points.forEach((pt, idx) => {
        const x = pt.x * canvas.width;
        const y = pt.y * canvas.height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [strokes, currentPage, theme, zoom, fontSize]);

  const maxReadablePage = content ? content.pages.length : 1;
  const totalBookPages = content?.totalPages || activeBook?.totalPages || 1;
  const isAtPreviewWall =
    content?.accessLevel === 'preview_only' && currentPage >= content.allowedPages && totalBookPages > content.allowedPages;

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentPage((p) => {
      if (!content) return p;
      return Math.min(content.pages.length + (content.accessLevel === 'preview_only' ? 1 : 0), p + 1);
    });
  }, [content]);

  // Desktop keyboard arrow navigation
  useEffect(() => {
    if (!activeBook) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') closeReader();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBook, goNext, goPrev, closeReader]);

  const currentPageData = useMemo(
    () => content?.pages.find((p) => p.pageNumber === currentPage) || null,
    [content, currentPage]
  );

  const secondPageData = useMemo(
    () => (twoPageSpread ? content?.pages.find((p) => p.pageNumber === currentPage + 1) || null : null),
    [content, currentPage, twoPageSpread]
  );

  const pageHighlights = useMemo(
    () => annotations.filter((a) => a.pageNumber === currentPage && (a.type === 'highlight' || a.type === 'underline')),
    [annotations, currentPage]
  );

  const pageNotes = useMemo(
    () => annotations.filter((a) => a.pageNumber === currentPage && a.type === 'note'),
    [annotations, currentPage]
  );

  const isBookmarked = useMemo(
    () => bookmarks.some((b) => b.pageNumber === currentPage),
    [bookmarks, currentPage]
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !content) return [];
    return content.pages.filter(
      (p) =>
        p.heading.toLowerCase().includes(q) ||
        p.chapterTitle.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q)
    );
  }, [searchQuery, content]);

  if (!activeBook) return null;

  const handleToggleBookmark = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const existing = bookmarks.find((b) => b.pageNumber === currentPage);
    if (existing) {
      await apiFetch(`/api/reader/bookmarks/${existing.id}`, { method: 'DELETE' });
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
    } else {
      const res = await apiFetch<{ bookmark: Bookmark }>('/api/reader/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          bookId: activeBook.id,
          pageNumber: currentPage,
          chapterTitle: currentPageData?.chapterTitle || `Page ${currentPage}`,
          label: currentPageData?.heading || `Page ${currentPage}`,
        }),
      });
      setBookmarks((prev) => [res.bookmark, ...prev]);
    }
  };

  const handleApplyTextMark = async (type: 'highlight' | 'underline') => {
    if (!user || !currentPageData) return;
    const sel = window.getSelection()?.toString().trim();
    const snippet = sel && sel.length > 2 ? sel : currentPageData.heading;
    const res = await apiFetch<{ annotation: Annotation }>('/api/reader/annotations', {
      method: 'POST',
      body: JSON.stringify({
        bookId: activeBook.id,
        pageNumber: currentPage,
        type,
        color: type === 'highlight' ? '#FEF08A' : '#1D4ED8',
        textSelection: snippet,
      }),
    });
    setAnnotations((prev) => [res.annotation, ...prev]);
    window.getSelection()?.removeAllRanges();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !noteInput.trim()) return;
    const res = await apiFetch<{ annotation: Annotation }>('/api/reader/annotations', {
      method: 'POST',
      body: JSON.stringify({
        bookId: activeBook.id,
        pageNumber: currentPage,
        type: 'note',
        color: '#F59E0B',
        noteText: noteInput.trim(),
      }),
    });
    setAnnotations((prev) => [res.annotation, ...prev]);
    setNoteInput('');
  };

  const handleDeleteAnnotation = async (id: string) => {
    await apiFetch(`/api/reader/annotations/${id}`, { method: 'DELETE' });
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSavePenMarks = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const res = await apiFetch<{ annotation: Annotation | null }>('/api/reader/annotations', {
      method: 'POST',
      body: JSON.stringify({
        bookId: activeBook.id,
        pageNumber: currentPage,
        type: 'pen',
        color: penColor,
        strokes,
      }),
    });
    setAnnotations((prev) => {
      const withoutPagePen = prev.filter((a) => !(a.pageNumber === currentPage && a.type === 'pen'));
      return res.annotation ? [res.annotation, ...withoutPagePen] : withoutPagePen;
    });
    setDirtyMarks(false);
    setSaveToast(t('reader.marksSaved'));
    setTimeout(() => setSaveToast(null), 1800);
  };

  // Pointer drawing handlers (touch + mouse)
  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onPointerDownCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'pen' && tool !== 'eraser') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedPoint(e);
    if (tool === 'eraser') {
      // Remove any stroke intersecting near pointer
      setStrokes((prev) => {
        const next = prev.filter(
          (s) => !s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 0.04)
        );
        if (next.length !== prev.length) setDirtyMarks(true);
        return next;
      });
      return;
    }
    isDrawingRef.current = true;
    activeStrokeRef.current = { points: [pt], width: 3, color: penColor };
    setStrokes((prev) => [...prev, activeStrokeRef.current!]);
    setRedoStack([]);
    setDirtyMarks(true);
  };

  const onPointerMoveCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    const pt = getNormalizedPoint(e);
    activeStrokeRef.current.points.push(pt);
    setStrokes((prev) => [...prev.slice(0, -1), { ...activeStrokeRef.current! }]);
  };

  const onPointerUpCanvas = () => {
    isDrawingRef.current = false;
    activeStrokeRef.current = null;
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
    setDirtyMarks(true);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const restored = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, restored]);
    setDirtyMarks(true);
  };

  // Switch linked edition strictly (never auto-translates!)
  const handleEditionChange = (langCode: string) => {
    const pseudoCurrent = {
      ...activeBook,
      pages: content?.pages || [],
    } as unknown as Parameters<typeof resolveEditionSwitch>[0];
    const pseudoAll = books.map((b) => ({ ...b, pages: [] })) as unknown as Parameters<
      typeof resolveEditionSwitch
    >[2];
    const res = resolveEditionSwitch(pseudoCurrent, langCode, pseudoAll, currentPage, true);
    if (!res.found || !res.targetBook) {
      setEditionError(t('book.editionUnavailable'));
      return;
    }
    setEditionError(null);
    const nextBook = books.find((b) => b.id === res.targetBook!.id);
    if (nextBook) {
      openReader(nextBook);
      setCurrentPage(res.mappedPage);
    }
  };

  const handleOfflineSave = () => {
    if (!content || !content.licensePermissions.allowOfflineDownload) return;
    saveBookOffline({
      book: activeBook,
      pages: content.pages,
      savedAt: new Date().toISOString(),
    });
  };

  const toggleAudioMode = () => {
    setAudioOpen((prev) => {
      const next = !prev;
      setAudioAutoPlay(next);
      return next;
    });
  };

  const themeClasses: Record<ReaderTheme, string> = {
    light: 'bg-slate-100 text-slate-900',
    sepia: 'bg-[#F4ECD8] text-[#3B2F23]',
    dark: 'bg-slate-950 text-slate-100',
  };

  const pageSurfaceClasses: Record<ReaderTheme, string> = {
    light: 'bg-white text-slate-900 border-slate-200',
    sepia: 'bg-[#FBF5E9] text-[#33271B] border-[#E6D9BE]',
    dark: 'bg-slate-900 text-slate-100 border-slate-800',
  };

  const isSavedOffline = Boolean(offlineBooks[activeBook.id]);

  const renderPageTextWithMarks = (text: string) => {
    if (pageHighlights.length === 0) return text;
    let segments: React.ReactNode[] = [text];
    pageHighlights.forEach((mark, idx) => {
      const needle = mark.textSelection;
      if (!needle) return;
      const nextSegments: React.ReactNode[] = [];
      segments.forEach((seg, sIdx) => {
        if (typeof seg !== 'string') {
          nextSegments.push(seg);
          return;
        }
        const pos = seg.indexOf(needle);
        if (pos === -1) {
          nextSegments.push(seg);
          return;
        }
        nextSegments.push(seg.slice(0, pos));
        nextSegments.push(
          <mark
            key={`${idx}-${sIdx}`}
            className={
              mark.type === 'highlight'
                ? 'rounded bg-yellow-200/80 px-0.5 text-slate-900'
                : 'bg-transparent underline decoration-blue-700 decoration-2 underline-offset-4 text-inherit'
            }
          >
            {needle}
          </mark>
        );
        nextSegments.push(seg.slice(pos + needle.length));
      });
      segments = nextSegments;
    });
    return segments;
  };

  const renderPageCard = (page: BookPage) => {
    const isPrimary = page.pageNumber === currentPage;
    const pageAudioSegments = audioOpen && isPrimary ? splitPageIntoAudioSegments(page) : [];
    const bodyAudioSegments = pageAudioSegments.filter((s) => s.kind === 'body');
    const headingAudioSegment = pageAudioSegments.find((s) => s.kind === 'heading');
    const keyPointAudioSegments = pageAudioSegments.filter((s) => s.kind === 'keyPoint');

    return (
      <div
        key={page.pageNumber}
        className={`relative rounded-xl border p-6 sm:p-10 shadow-sm transition-colors ${pageSurfaceClasses[theme]}`}
        style={{
          width: fitMode === 'width' ? '100%' : `${Math.round(7.4 * zoom)}px`,
          maxWidth: '100%',
        }}
      >
        <div className="flex items-center justify-between border-b border-current/10 pb-3 text-xs opacity-70">
          <span>{page.chapterTitle}</span>
          <span className="font-mono-num">
            Page {page.pageNumber} / {totalBookPages}
          </span>
        </div>

        <h2
          className={`mt-5 font-display text-xl font-bold sm:text-2xl ${
            headingAudioSegment && activeAudioSegmentIndex === headingAudioSegment.index
              ? 'rounded-md bg-blue-500/15 px-2 py-1'
              : ''
          }`}
        >
          {page.heading}
        </h2>

        <div
          className="font-book mt-4 whitespace-pre-line"
          style={{
            fontSize: `${Math.round((fontSize * zoom) / 100)}px`,
            lineHeight: lineSpacing,
          }}
        >
          {audioOpen && isPrimary && bodyAudioSegments.length > 0 ? (
            <span className="space-x-1">
              {bodyAudioSegments.map((seg) => {
                const isActive = activeAudioSegmentIndex === seg.index;
                return (
                  <span
                    key={seg.index}
                    onClick={() => setAudioJumpRequest({ index: seg.index, nonce: Date.now() })}
                    title="Click to listen from this line"
                    className={`cursor-pointer rounded transition-colors ${
                      isActive
                        ? theme === 'dark'
                          ? 'bg-blue-500/35 px-1 text-white ring-1 ring-blue-400'
                          : 'bg-blue-100 px-1 text-slate-950 ring-1 ring-blue-300'
                        : 'hover:bg-current/5'
                    }`}
                  >
                    {renderPageTextWithMarks(seg.text)}{' '}
                  </span>
                );
              })}
            </span>
          ) : (
            renderPageTextWithMarks(page.body)
          )}
        </div>

        {page.keyPoints && page.keyPoints.length > 0 && (
          <div className="mt-6 rounded-lg border border-current/15 bg-current/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Key Takeaways</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {page.keyPoints.map((kp, i) => {
                const kpSeg = keyPointAudioSegments[i];
                const isActive = kpSeg && activeAudioSegmentIndex === kpSeg.index;
                return (
                  <li
                    key={i}
                    onClick={() => {
                      if (kpSeg) setAudioJumpRequest({ index: kpSeg.index, nonce: Date.now() });
                    }}
                    className={
                      isActive
                        ? theme === 'dark'
                          ? 'rounded bg-blue-500/30 px-1.5 py-0.5 text-white'
                          : 'rounded bg-blue-100 px-1.5 py-0.5 text-slate-950'
                        : kpSeg
                          ? 'cursor-pointer hover:bg-current/5 rounded px-1'
                          : ''
                    }
                  >
                    {kp}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {page.diagramLabel && (
          <div className="mt-5 rounded-lg border border-dashed border-current/25 p-4 text-center text-xs opacity-80">
            [Curriculum Figure: {page.diagramLabel}]
          </div>
        )}

        {isPrimary && (
          <canvas
            ref={canvasRef}
            width={800}
            height={1000}
            data-testid="reader-pen-canvas"
            onPointerDown={onPointerDownCanvas}
            onPointerMove={onPointerMoveCanvas}
            onPointerUp={onPointerUpCanvas}
            className={`absolute inset-0 h-full w-full rounded-xl ${
              tool === 'pen' || tool === 'eraser' ? 'pointer-events-auto cursor-crosshair touch-none' : 'pointer-events-none'
            }`}
          />
        )}
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${themeClasses[theme]}`}
      role="region"
      aria-label={`Book reader: ${activeBook.title}`}
    >
      {/* Top Reader Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 px-3 py-2 sm:px-5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={closeReader}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-current/15 px-3 text-xs font-medium hover:bg-current/5 whitespace-nowrap"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>{t('action.closeReader')}</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-current/15 px-3 text-xs font-medium hover:bg-current/5 whitespace-nowrap"
            aria-label="Toggle contents and notes panel"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('reader.toc')}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBookSwitcher((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-current/15 px-3 text-xs font-medium hover:bg-current/5 whitespace-nowrap"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-[140px] truncate sm:max-w-[240px]">{activeBook.title}</span>
              <span className="hidden md:inline opacity-60">({t('action.switchBook')})</span>
            </button>

            {showBookSwitcher && (
              <div className="absolute left-0 top-12 z-50 w-72 rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl">
                <p className="px-2 py-1 text-xs font-semibold text-slate-500">{t('action.switchBook')}</p>
                <div className="max-h-64 overflow-y-auto">
                  {books.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setShowBookSwitcher(false);
                        openReader(b);
                      }}
                      className={`flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 ${
                        b.id === activeBook.id ? 'bg-blue-50 text-blue-900 font-semibold' : ''
                      }`}
                    >
                      <span className="truncate">{b.title}</span>
                      <span className="text-[11px] text-slate-500">{b.contentLanguageCode.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Toolbar Controls: Language Edition Switcher, Bookmark, Offline, Read Aloud */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="reader-edition-lang" className="sr-only">
              {t('reader.editionSwitch')}
            </label>
            <select
              id="reader-edition-lang"
              value={activeBook.contentLanguageCode}
              onChange={(e) => handleEditionChange(e.target.value)}
              className="h-10 rounded-lg border border-current/20 bg-transparent px-2.5 text-xs font-medium"
            >
              {contentLanguages
                .filter((l) => l.enabled)
                .map((l) => {
                  const hasEd = activeBook.linkedEditions.some((e) => e.contentLanguageCode === l.code);
                  return (
                    <option key={l.code} value={l.code} className="text-slate-900">
                      {l.nativeName} {hasEd ? '' : '— N/A'}
                    </option>
                  );
                })}
            </select>
          </div>

          <button
            type="button"
            onClick={handleToggleBookmark}
            title={!user ? 'Sign in to bookmark' : t('reader.bookmarkPage')}
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
              isBookmarked
                ? 'border-amber-500 bg-amber-500/15 text-amber-600'
                : 'border-current/15 hover:bg-current/5'
            }`}
          >
            <BookmarkIcon className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} aria-hidden="true" />
            <span className="hidden lg:inline">
              {isBookmarked ? t('reader.bookmarked') : t('reader.bookmarkPage')}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleAudioMode}
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
              audioOpen
                ? 'border-blue-800 bg-blue-900 text-white'
                : 'border-current/15 hover:bg-current/5'
            }`}
            aria-label={t('action.listenAudio')}
            aria-pressed={audioOpen}
          >
            <Headphones className="h-4 w-4" aria-hidden="true" />
            <span>{t('action.listenAudio')}</span>
          </button>

          {content?.licensePermissions.allowOfflineDownload && (
            <button
              type="button"
              onClick={handleOfflineSave}
              className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${
                isSavedOffline
                  ? 'border-emerald-600 bg-emerald-600/15 text-emerald-700'
                  : 'border-current/15 hover:bg-current/5'
              }`}
            >
              {isSavedOffline ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              <span className="hidden md:inline">
                {isSavedOffline ? t('action.offlineSaved') : t('action.downloadOffline')}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Unavailable Edition Notice (Strict Anti-Auto-Translation Rule) */}
      {editionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>{editionError}</span>
          </div>
          <button type="button" onClick={() => setEditionError(null)} aria-label="Dismiss notice">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Reader Body */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Navigation & Notes Drawer */}
        {sidebarOpen && (
          <aside className="z-30 flex w-72 shrink-0 flex-col border-r border-current/10 bg-white text-slate-900">
            <div className="flex border-b border-slate-200 p-1.5 text-xs font-medium">
              {(['toc', 'thumbs', 'search', 'notes'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 rounded-md py-1.5 capitalize ${
                    sidebarTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'toc'
                    ? t('reader.toc')
                    : tab === 'thumbs'
                      ? t('reader.thumbnails')
                      : tab === 'search'
                        ? 'Search'
                        : 'Notes'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 text-xs">
              {sidebarTab === 'toc' && (
                <ul className="space-y-1.5">
                  {(content?.pages || []).map((p) => (
                    <li key={p.pageNumber}>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p.pageNumber)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left hover:bg-slate-100 ${
                          currentPage === p.pageNumber ? 'bg-blue-50 font-semibold text-blue-900' : ''
                        }`}
                      >
                        <span className="truncate">{p.heading}</span>
                        <span className="font-mono-num ml-2 text-[11px] text-slate-500">p.{p.pageNumber}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {sidebarTab === 'thumbs' && (
                <div className="grid grid-cols-2 gap-2.5">
                  {(content?.pages || []).map((p) => (
                    <button
                      key={p.pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(p.pageNumber)}
                      className={`rounded-lg border p-2 text-left transition-colors ${
                        currentPage === p.pageNumber
                          ? 'border-blue-800 bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-mono-num text-[10px] font-semibold text-slate-500">
                        Page {p.pageNumber}
                      </div>
                      <div className="mt-1 line-clamp-3 text-[11px] text-slate-800">{p.heading}</div>
                    </button>
                  ))}
                </div>
              )}

              {sidebarTab === 'search' && (
                <div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('reader.searchPlaceholder')}
                      className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-xs"
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    {searchResults.map((p) => (
                      <button
                        key={p.pageNumber}
                        type="button"
                        onClick={() => setCurrentPage(p.pageNumber)}
                        className="block w-full rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
                      >
                        <div className="font-semibold text-blue-900">
                          Page {p.pageNumber}: {p.heading}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{p.body}</div>
                      </button>
                    ))}
                    {searchQuery.trim() && searchResults.length === 0 && (
                      <p className="text-slate-500">No matches found in authorized pages.</p>
                    )}
                  </div>
                </div>
              )}

              {sidebarTab === 'notes' && (
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-slate-700">Bookmarks ({bookmarks.length})</p>
                    {bookmarks.map((bm) => (
                      <button
                        key={bm.id}
                        type="button"
                        onClick={() => setCurrentPage(bm.pageNumber)}
                        className="mt-1.5 flex w-full items-center justify-between rounded-lg border border-slate-200 px-2.5 py-1.5 text-left hover:bg-slate-50"
                      >
                        <span className="truncate">{bm.label}</span>
                        <span className="font-mono-num text-slate-500">p.{bm.pageNumber}</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <p className="font-semibold text-slate-700">Page Notes &amp; Highlights ({annotations.length})</p>
                    {annotations.map((ann) => (
                      <div key={ann.id} className="mt-1.5 rounded-lg border border-slate-200 p-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="capitalize">
                            {ann.type} · p.{ann.pageNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnotation(ann.id)}
                            aria-label="Delete annotation"
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-1 text-slate-800">{ann.noteText || ann.textSelection || 'Drawing strokes'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Center Page Stage */}
        <main
          className="flex-1 overflow-y-auto p-4 sm:p-8"
          onTouchStart={(e) => {
            if (tool !== 'read') return;
            touchStartXRef.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (tool !== 'read' || touchStartXRef.current === null) return;
            const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
            touchStartXRef.current = null;
            if (Math.abs(deltaX) > 60) {
              if (deltaX < 0) goNext();
              else goPrev();
            }
          }}
        >
          {loading ? (
            <div className="mx-auto max-w-2xl rounded-xl border border-current/15 p-12 text-center text-sm opacity-75">
              Verifying license &amp; loading encrypted reading stream...
            </div>
          ) : error ? (
            <div className="mx-auto max-w-xl rounded-xl border border-red-300 bg-red-50 p-6 text-center text-sm text-red-900">
              <p className="font-semibold">Unable to load book content</p>
              <p className="mt-1 text-xs">{error}</p>
            </div>
          ) : isAtPreviewWall && currentPage > maxReadablePage ? (
            <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-900 shadow-lg">
              <Lock className="mx-auto h-10 w-10 text-blue-800" aria-hidden="true" />
              <h3 className="mt-3 font-display text-xl font-bold">{t('reader.previewWallTitle')}</h3>
              <p className="mt-2 text-sm text-slate-600">{t('reader.previewWallDesc')}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Back to Preview
                </button>
                <button
                  type="button"
                  onClick={() => openCheckout({ book: activeBook })}
                  className="rounded-lg bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800"
                >
                  {t('action.subscribe')}
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
              <div className={`flex w-full justify-center gap-6 ${twoPageSpread ? 'lg:flex-row flex-col items-start' : ''}`}>
                {currentPageData && renderPageCard(currentPageData)}
                {secondPageData && renderPageCard(secondPageData)}
              </div>

              {/* Page-level Notes Composer when Note tool is active or notes exist */}
              {(tool === 'note' || pageNotes.length > 0) && (
                <div className="w-full max-w-2xl rounded-xl border border-current/15 bg-current/[0.04] p-4">
                  <p className="text-xs font-semibold">Page {currentPage} Notes</p>
                  {user && tool === 'note' && (
                    <form onSubmit={handleAddNote} className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Write a personal note or comment for this page..."
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-blue-900 px-3.5 py-2 text-xs font-medium text-white"
                      >
                        {t('action.save')}
                      </button>
                    </form>
                  )}
                  <div className="mt-2 space-y-1.5">
                    {pageNotes.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center justify-between rounded-lg bg-amber-50/90 px-3 py-2 text-xs text-slate-900"
                      >
                        <span>{n.noteText}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnotation(n.id)}
                          aria-label="Delete note"
                          className="text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {content?.accessLevel === 'preview_only' && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 w-full max-w-2xl">
                  <span>
                    Preview mode: {content.allowedPages} of {totalBookPages} pages available.
                  </span>
                  <button
                    type="button"
                    onClick={() => openCheckout({ book: activeBook })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3.5 py-1.5 font-medium text-white"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('action.subscribe')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Audiobook Narration Dock */}
      <AudioPlayerBar
        open={audioOpen}
        onClose={() => {
          setAudioOpen(false);
          setAudioAutoPlay(false);
          setActiveAudioSegmentIndex(null);
        }}
        bookTitle={activeBook.title}
        contentLanguageCode={activeBook.contentLanguageCode}
        page={currentPageData}
        currentPage={currentPage}
        allowedPages={content?.allowedPages || 1}
        totalBookPages={totalBookPages}
        accessLevel={content?.accessLevel || 'preview_only'}
        theme={theme}
        autoPlayOnOpen={audioAutoPlay}
        jumpRequest={audioJumpRequest}
        onActiveSegmentChange={setActiveAudioSegmentIndex}
        onRequestPageChange={(p) => setCurrentPage(p)}
        t={t}
      />

      {/* Bottom Control Dock: Navigation, Themes, Zoom, Font, Annotation Tools */}
      <footer className="border-t border-current/10 px-3 py-2 sm:px-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-current/15 disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono-num text-xs font-medium">
              {currentPage} / {totalBookPages}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={content?.accessLevel === 'full' && currentPage >= maxReadablePage}
              aria-label="Next page"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-current/15 disabled:opacity-35"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Annotation & Study Tools */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-current/15 p-1">
            {(
              [
                { id: 'read', icon: BookOpen, label: t('reader.toolRead') },
                { id: 'highlight', icon: Highlighter, label: t('reader.toolHighlight') },
                { id: 'underline', icon: Underline, label: t('reader.toolUnderline') },
                { id: 'pen', icon: PenTool, label: t('reader.toolPen') },
                { id: 'note', icon: MessageSquarePlus, label: t('reader.toolNote') },
                { id: 'eraser', icon: Eraser, label: t('reader.toolEraser') },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTool(item.id);
                    if (item.id === 'highlight' || item.id === 'underline') {
                      handleApplyTextMark(item.id);
                    }
                  }}
                  title={item.label}
                  className={`inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors ${
                    active ? 'bg-blue-900 text-white' : 'hover:bg-current/10'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden xl:inline">{item.label}</span>
                </button>
              );
            })}

            {(tool === 'pen' || tool === 'eraser' || dirtyMarks) && (
              <>
                <input
                  type="color"
                  aria-label="Pen color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={strokes.length === 0}
                  aria-label={t('reader.undo')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-current/10 disabled:opacity-35"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  aria-label={t('reader.redo')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-current/10 disabled:opacity-35"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleSavePenMarks}
                  className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
                >
                  {saveToast || t('reader.saveMarks')}
                </button>
              </>
            )}
          </div>

          {/* Theme, Zoom, Font & Orientation Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center rounded-lg border border-current/15 p-0.5">
              <button
                type="button"
                onClick={() => setTheme('light')}
                aria-label={t('reader.themeLight')}
                className={`rounded-md p-1.5 ${theme === 'light' ? 'bg-slate-900 text-white' : ''}`}
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme('sepia')}
                aria-label={t('reader.themeSepia')}
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${theme === 'sepia' ? 'bg-amber-800 text-white' : ''}`}
              >
                {t('reader.themeSepia')}
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                aria-label={t('reader.themeDark')}
                className={`rounded-md p-1.5 ${theme === 'dark' ? 'bg-slate-700 text-white' : ''}`}
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(75, z - 10))}
                aria-label="Zoom out"
                className="rounded-md border border-current/15 p-1.5"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono-num w-10 text-center">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(150, z + 10))}
                aria-label="Zoom in"
                className="rounded-md border border-current/15 p-1.5"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setFitMode((m) => (m === 'width' ? 'page' : 'width'))}
                className="rounded-md border border-current/15 px-2 py-1"
              >
                {fitMode === 'width' ? t('reader.fitPage') : t('reader.fitWidth')}
              </button>
              <button
                type="button"
                onClick={() => setTwoPageSpread((v) => !v)}
                className="hidden lg:inline-flex rounded-md border border-current/15 px-2 py-1"
              >
                {twoPageSpread ? '1-Page' : '2-Page'}
              </button>
            </div>

            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.max(13, f - 1))}
                aria-label="Decrease font size"
                className="rounded-md border border-current/15 p-1.5"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="font-mono-num">A{fontSize}</span>
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.min(24, f + 1))}
                aria-label="Increase font size"
                className="rounded-md border border-current/15 p-1.5"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setLineSpacing((s) => (s >= 2.0 ? 1.4 : Number((s + 0.2).toFixed(1))))}
                className="rounded-md border border-current/15 px-2 py-1 font-mono-num"
                title="Line spacing"
              >
                LH {lineSpacing}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
