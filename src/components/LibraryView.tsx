import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Headphones,
  Heart,
  Languages,
  Lock,
  Megaphone,
  Search,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { EnrichedBook } from '../utils/api';
import { PWAInstallButton } from './PWAInstallButton';

export const LibraryView: React.FC = () => {
  const {
    config,
    books,
    classes,
    boards,
    subjects,
    contentLanguages,
    uiLanguages,
    uiLang,
    setUiLanguage,
    user,
    readingProgress,
    offlineBooks,
    openReader,
    openCheckout,
    toggleFavorite,
    setActiveTab,
    t,
  } = useApp();

  const savedPrefs = useMemo(() => {
    try {
      const raw = localStorage.getItem('vidyakosha_student_prefs');
      return raw ? (JSON.parse(raw) as { classId?: string; boardId?: string; contentLanguageCode?: string }) : {};
    } catch {
      return {};
    }
  }, []);

  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState(user?.classId || savedPrefs.classId || 'all');
  const [boardId, setBoardId] = useState(user?.boardId || savedPrefs.boardId || 'all');
  const [subjectId, setSubjectId] = useState('all');
  const [contentLang, setContentLang] = useState('all');
  const [academicYear, setAcademicYear] = useState('all');
  const [onlyFree, setOnlyFree] = useState(false);
  const [selectedBook, setSelectedBook] = useState<EnrichedBook | null>(null);
  const [missingLangNotice, setMissingLangNotice] = useState<string | null>(null);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const boardMap = useMemo(() => new Map(boards.map((b) => [b.id, b.code])), [boards]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const langMap = useMemo(() => new Map(contentLanguages.map((l) => [l.code, l])), [contentLanguages]);

  const years = useMemo(() => Array.from(new Set(books.map((b) => b.academicYear))), [books]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter((b) => {
      if (classId !== 'all' && b.classId !== classId) return false;
      if (boardId !== 'all' && b.boardId !== boardId) return false;
      if (subjectId !== 'all' && b.subjectId !== subjectId) return false;
      if (contentLang !== 'all' && b.contentLanguageCode !== contentLang) return false;
      if (academicYear !== 'all' && b.academicYear !== academicYear) return false;
      if (onlyFree && !b.isFree) return false;
      if (q) {
        const hay = `${b.title} ${b.subtitle} ${b.author} ${b.isbn}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [books, classId, boardId, subjectId, contentLang, academicYear, onlyFree, search]);

  const resetFilters = () => {
    setSearch('');
    setClassId('all');
    setBoardId('all');
    setSubjectId('all');
    setContentLang('all');
    setAcademicYear('all');
    setOnlyFree(false);
  };

  const activeBanner = config?.announcements.find((a) => a.active);
  const sym = config?.currencySymbol || '₹';

  const handleOpenEditionFromDetails = (langCode: string) => {
    if (!selectedBook) return;
    const match = selectedBook.linkedEditions.find((e) => e.contentLanguageCode === langCode);
    if (!match) {
      setMissingLangNotice(langCode);
      return;
    }
    setMissingLangNotice(null);
    const fullTarget = books.find((b) => b.id === match.bookId);
    if (fullTarget) setSelectedBook(fullTarget);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Announcement Strip */}
      {activeBanner && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-blue-800 sm:mt-0" aria-hidden="true" />
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">{activeBanner.title}:</span>{' '}
              <span>{activeBanner.body}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('plans')}
            className="text-xs font-semibold text-blue-800 hover:text-blue-900 underline underline-offset-4 whitespace-nowrap"
          >
            {t('hero.ctaPlans')}
          </button>
        </div>
      )}

      {/* Hero Split */}
      <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500">
                Nursery – Class 12 · CBSE / ICSE / State Boards
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="quick-ui-lang" className="sr-only">
                  {t('profile.uiLanguage')}
                </label>
                <select
                  id="quick-ui-lang"
                  value={uiLang}
                  onChange={(e) => setUiLanguage(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {uiLanguages
                    .filter((l) => l.enabled)
                    .map((l) => (
                      <option key={l.code} value={l.code}>
                        UI: {l.nativeName}
                      </option>
                    ))}
                </select>
                <PWAInstallButton label={t('action.installApp')} />
              </div>
            </div>

            <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl text-balance">
              {t('hero.title')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {t('hero.desc')}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#catalog-section"
              className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              {t('hero.ctaBrowse')}
            </a>
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              {t('hero.ctaPlans')}
            </button>
          </div>
        </div>

        <div className="relative min-h-[220px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:col-span-5">
          <img
            src="/src/assets/images/hero_library_study_1795146976067.jpg"
            alt="Quiet study desk with hardcover textbooks and morning sunlight"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/75 via-slate-900/30 to-transparent p-5 text-white">
            <p className="text-xs font-medium text-slate-200">
              {books.length} Licensed Editions · {boards.filter((b) => b.enabled).length} Education Boards
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              Multi-language editions · Never auto-translated
            </p>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section
        id="catalog-section"
        aria-label="Filter textbooks"
        className="mt-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filter.searchPlaceholder')}
              aria-label={t('filter.searchPlaceholder')}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <select
            aria-label={t('onboarding.classLabel')}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">{t('filter.allClasses')}</option>
            {classes
              .filter((c) => c.enabled)
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>

          <select
            aria-label={t('onboarding.boardLabel')}
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">{t('filter.allBoards')}</option>
            {boards
              .filter((b) => b.enabled)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>

          <select
            aria-label={t('filter.allSubjects')}
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">{t('filter.allSubjects')}</option>
            {subjects
              .filter((s) => s.enabled)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>

          <select
            aria-label={t('onboarding.contentLangLabel')}
            value={contentLang}
            onChange={(e) => setContentLang(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">{t('filter.allLanguages')}</option>
            {contentLanguages
              .filter((l) => l.enabled)
              .map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} ({l.name})
                </option>
              ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <select
              aria-label={t('filter.allYears')}
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
            >
              <option value="all">{t('filter.allYears')}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-700">
              <input
                type="checkbox"
                checked={onlyFree}
                onChange={(e) => setOnlyFree(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>{t('filter.freeOnly')}</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono-num text-slate-500">{filteredBooks.length} books</span>
            <button
              type="button"
              onClick={resetFilters}
              className="font-medium text-blue-800 hover:text-blue-900 underline underline-offset-2"
            >
              {t('action.resetFilters')}
            </button>
          </div>
        </div>
      </section>

      {/* Books Grid */}
      {filteredBooks.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">
            No books match the selected filters
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Try switching to another content language or clearing class/board filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t('action.resetFilters')}
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBooks.map((book) => {
            const langObj = langMap.get(book.contentLanguageCode);
            const prog = readingProgress.find((p) => p.bookId === book.id);
            const isFav = user?.favoriteBookIds.includes(book.id);
            const isOffline = Boolean(offlineBooks[book.id]);
            const hasFull = book.access.accessLevel === 'full';

            return (
              <article
                key={book.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  <img
                    src={book.coverUrl}
                    alt={`${book.title} cover`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => toggleFavorite(book.id)}
                    aria-label={isFav ? `Remove ${book.title} from favorites` : `Save ${book.title} to favorites`}
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow-xs hover:bg-white"
                  >
                    <Heart
                      className={`h-4 w-4 ${isFav ? 'fill-red-600 text-red-600' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    {/* Clean unboxed metadata row */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{classMap.get(book.classId) || book.classId}</span>
                      <span aria-hidden="true">·</span>
                      <span>{boardMap.get(book.boardId) || book.boardId}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-800">
                        {langObj ? `${langObj.nativeName}` : book.contentLanguageCode.toUpperCase()}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{book.totalPages} {t('book.pages')}</span>
                    </div>

                    <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-slate-900">
                      {book.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{book.description}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span>{subjectMap.get(book.subjectId)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{book.author}</span>
                      {book.linkedEditions.length > 1 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-800 font-medium">
                            {book.linkedEditions.length} language editions
                          </span>
                        </>
                      )}
                    </div>

                    {prog && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Reading progress</span>
                          <span className="font-mono-num">{prog.percentComplete}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-blue-800"
                            style={{ width: `${prog.percentComplete}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                    <div className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                      {book.isFree ? (
                        <span className="text-emerald-700">{t('book.free')}</span>
                      ) : hasFull ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Unlocked
                        </span>
                      ) : (
                        <span className="font-mono-num">
                          {sym}
                          {book.price}/yr
                        </span>
                      )}
                      {isOffline && (
                        <span className="ml-2 text-[11px] font-normal text-slate-500">· Offline Ready</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openReader(book, { startAudio: true })}
                        aria-label={`${t('action.listenAudio')}: ${book.title}`}
                        title={t('action.listenAudio')}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <Headphones className="h-3.5 w-3.5 text-blue-800" aria-hidden="true" />
                        <span>{t('action.listenAudio')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMissingLangNotice(null);
                          setSelectedBook(book);
                        }}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => openReader(book)}
                        className="rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                      >
                        {hasFull ? t('action.openReader') : t('action.previewBook')}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Book Details Drawer / Modal */}
      {selectedBook && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-details-title"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs text-slate-500">
                  {classMap.get(selectedBook.classId)} · {boardMap.get(selectedBook.boardId)} ·{' '}
                  {selectedBook.academicYear} · ISBN {selectedBook.isbn}
                </p>
                <h2 id="book-details-title" className="mt-1 font-display text-xl font-bold text-slate-900">
                  {selectedBook.title}
                </h2>
                <p className="text-sm text-slate-600">{selectedBook.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                aria-label="Close book details"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <img
                  src={selectedBook.coverUrl}
                  alt={selectedBook.title}
                  referrerPolicy="no-referrer"
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>

              <div className="space-y-4 sm:col-span-2">
                <p className="text-sm leading-relaxed text-slate-700">{selectedBook.description}</p>

                <dl className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
                  <div>
                    <dt className="text-slate-500">Author / Publisher</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedBook.author} · {selectedBook.publisher}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{t('book.contentLanguage')}</dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">
                      {langMap.get(selectedBook.contentLanguageCode)?.nativeName ||
                        selectedBook.contentLanguageCode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Access &amp; Duration</dt>
                    <dd className="mt-0.5 font-mono-num font-semibold text-slate-900">
                      {selectedBook.isFree ? t('book.free') : `${sym}${selectedBook.price} / 1 Year`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Format &amp; Preview</dt>
                    <dd className="mt-0.5 font-medium text-slate-900 uppercase">
                      {selectedBook.format} · {selectedBook.previewPagesCount}/{selectedBook.totalPages} pages
                    </dd>
                  </div>
                </dl>

                {/* Language Editions Selector (Never Auto-Translated) */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Languages className="h-4 w-4 text-blue-800" aria-hidden="true" />
                    <span>{t('book.availableEditions')}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {contentLanguages
                      .filter((l) => l.enabled)
                      .map((lang) => {
                        const available = selectedBook.linkedEditions.some(
                          (e) => e.contentLanguageCode === lang.code
                        );
                        const active = selectedBook.contentLanguageCode === lang.code;
                        return (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => handleOpenEditionFromDetails(lang.code)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? 'border-blue-800 bg-blue-50 text-blue-950'
                                : available
                                  ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                                  : 'border-slate-200 bg-slate-50 text-slate-400'
                            }`}
                          >
                            {lang.nativeName} {!available ? '(Unavailable)' : ''}
                          </button>
                        );
                      })}
                  </div>
                  {missingLangNotice && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                      <span>{t('book.editionUnavailable')}</span>
                    </div>
                  )}
                </div>

                {/* Licensing & Rights Verification */}
                <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {t('book.licenseVerified')} ({selectedBook.license.licenseNumber})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {selectedBook.license.allowOfflineDownload ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    )}
                    {selectedBook.license.allowOfflineDownload
                      ? t('book.offlineAllowed')
                      : t('book.offlineRestricted')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
              {!selectedBook.isFree && selectedBook.access.accessLevel === 'preview_only' && (
                <button
                  type="button"
                  onClick={() => {
                    const b = selectedBook;
                    setSelectedBook(null);
                    openCheckout({ book: b });
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-900 bg-white px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-50"
                >
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {t('action.subscribe')} ({sym}
                    {selectedBook.price})
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const b = selectedBook;
                  setSelectedBook(null);
                  openReader(b, { startAudio: true });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <Headphones className="h-4 w-4 text-blue-800" aria-hidden="true" />
                <span>{t('action.listenAudio')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = selectedBook;
                  setSelectedBook(null);
                  openReader(b);
                }}
                className="rounded-lg bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
              >
                {selectedBook.access.accessLevel === 'full' ? t('action.openReader') : t('action.previewBook')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
