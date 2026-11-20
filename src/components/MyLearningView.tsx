import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bookmark as BookmarkIcon,
  BookOpen,
  Download,
  Headphones,
  Heart,
  Receipt,
  Settings,
  Trash2,
  UserX,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Annotation, Bookmark, PaymentTransaction, SupportTicket } from '../shared/types';
import { apiFetch, setStoredToken } from '../utils/api';

export const MyLearningView: React.FC = () => {
  const {
    user,
    books,
    classes,
    boards,
    uiLanguages,
    contentLanguages,
    uiLang,
    setUiLanguage,
    offlineBooks,
    deleteBookOffline,
    notifications,
    openReader,
    setShowAuthModal,
    refreshAll,
    config,
    t,
  } = useApp();

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<
    { id: string; planName: string; status: string; expiresAt: string }[]
  >([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileClass, setProfileClass] = useState(user?.classId || 'cls-10');
  const [profileBoard, setProfileBoard] = useState(user?.boardId || 'brd-cbse');
  const [profileContentLang, setProfileContentLang] = useState(user?.preferredContentLanguageCode || 'hi');
  const [profileSaved, setProfileSaved] = useState(false);

  const [issueBookId, setIssueBookId] = useState('');
  const [issueSubject, setIssueSubject] = useState('');
  const [issueMsg, setIssueMsg] = useState('');
  const [issueSubmitted, setIssueSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfileName(user.name);
    setProfileClass(user.classId || 'cls-10');
    setProfileBoard(user.boardId || 'brd-cbse');
    setProfileContentLang(user.preferredContentLanguageCode || 'hi');

    apiFetch<{
      bookmarks: Bookmark[];
      annotations: Annotation[];
      payments: PaymentTransaction[];
      subscriptions: { id: string; planName: string; status: string; expiresAt: string }[];
      tickets: SupportTicket[];
    }>('/api/learning/overview')
      .then((res) => {
        setBookmarks(res.bookmarks);
        setAnnotations(res.annotations);
        setPayments(res.payments);
        setSubscriptions(res.subscriptions);
        setTickets(res.tickets);
      })
      .catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
        <h1 className="mt-3 font-display text-2xl font-bold text-slate-900">{t('nav.myLearning')}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to sync reading progress, bookmarks, pen annotations, subscriptions, and offline books across devices.
        </p>
        <button
          type="button"
          onClick={() => setShowAuthModal(true)}
          className="mt-5 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
        >
          {t('action.signIn')}
        </button>
      </div>
    );
  }

  const bookMap = new Map(books.map((b) => [b.id, b]));
  const favoriteBooks = books.filter((b) => user.favoriteBookIds.includes(b.id));
  const offlineList = Object.values(offlineBooks);
  const sym = config?.currencySymbol || '₹';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        name: profileName,
        classId: profileClass,
        boardId: profileBoard,
        preferredContentLanguageCode: profileContentLang,
        uiLanguageCode: uiLang,
      }),
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
    await refreshAll();
  };

  const handleExportMyData = async () => {
    const data = await apiFetch<Record<string, unknown>>('/api/auth/export-data');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vidyakosha-my-data-${user.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    await apiFetch('/api/auth/account', { method: 'DELETE' });
    setStoredToken(null);
    await refreshAll();
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify({
        type: issueBookId ? 'content_issue' : 'support',
        bookId: issueBookId || undefined,
        subject: issueSubject,
        message: issueMsg,
      }),
    });
    setIssueSubject('');
    setIssueMsg('');
    setIssueSubmitted(true);
    setTimeout(() => setIssueSubmitted(false), 2500);
    const res = await apiFetch<{ tickets: SupportTicket[] }>('/api/learning/overview');
    setTickets(res.tickets);
  };

  const handleMarkNotificationsRead = async () => {
    await apiFetch('/api/notifications/read', { method: 'POST' });
    await refreshAll();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t('nav.myLearning')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {user.name} · {t(`role.${user.role}` as const)} · Multi-device synced workspace
          </p>
        </div>
      </div>

      {/* Notifications + Subscriptions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
              <Bell className="h-4 w-4 text-blue-800" aria-hidden="true" />
              <span>Notifications ({notifications.filter((n) => !n.read).length} unread)</span>
            </h2>
            <button
              type="button"
              onClick={handleMarkNotificationsRead}
              className="text-xs font-medium text-blue-800 hover:underline"
            >
              Mark all read
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500">No notifications.</p>
            ) : (
              notifications.slice(0, 4).map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3 text-xs ${
                    n.read ? 'border-slate-100 bg-slate-50 text-slate-600' : 'border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-0.5">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <Receipt className="h-4 w-4 text-blue-800" aria-hidden="true" />
            <span>Subscriptions &amp; Invoices</span>
          </h2>
          <div className="mt-3 space-y-2.5 text-xs">
            {subscriptions.length === 0 ? (
              <p className="text-slate-500">No active paid subscriptions yet.</p>
            ) : (
              subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-semibold text-slate-900">{sub.planName}</p>
                    <p className="text-slate-500">Expires: {sub.expiresAt.slice(0, 10)}</p>
                  </div>
                  <span className="font-semibold uppercase text-emerald-700">{sub.status}</span>
                </div>
              ))
            )}
            {payments.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-t border-slate-100 pt-2 text-slate-600">
                <span className="font-mono-num">{p.invoiceNumber}</span>
                <span>{p.planName}</span>
                <span className="font-mono-num font-medium">
                  {sym}
                  {p.totalAmount.toFixed(2)} ({p.status})
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Favorites & Offline Books */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <Heart className="h-4 w-4 text-red-600" aria-hidden="true" />
            <span>Favorites ({favoriteBooks.length})</span>
          </h2>
          <div className="mt-3 space-y-2">
            {favoriteBooks.length === 0 ? (
              <p className="text-xs text-slate-500">Mark books with the heart button in the library.</p>
            ) : (
              favoriteBooks.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{b.title}</p>
                    <p className="text-slate-500">{b.contentLanguageCode.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openReader(b, { startAudio: true })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Headphones className="h-3.5 w-3.5 text-blue-800" aria-hidden="true" />
                      <span>{t('action.listenAudio')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openReader(b)}
                      className="rounded-lg bg-blue-900 px-3 py-1.5 font-medium text-white whitespace-nowrap"
                    >
                      {t('action.openReader')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <Download className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Offline Saved Books ({offlineList.length})</span>
          </h2>
          <div className="mt-3 space-y-2">
            {offlineList.length === 0 ? (
              <p className="text-xs text-slate-500">
                Save any licensed offline-permitted book from inside the Reader.
              </p>
            ) : (
              offlineList.map((bundle) => (
                <div key={bundle.book.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{bundle.book.title}</p>
                    <p className="text-slate-500">Saved {bundle.savedAt.slice(0, 10)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openReader(bundle.book, { startAudio: true })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Headphones className="h-3.5 w-3.5 text-blue-800" aria-hidden="true" />
                      <span>{t('action.listenAudio')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openReader(bundle.book)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white whitespace-nowrap"
                    >
                      Read
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBookOffline(bundle.book.id)}
                      aria-label={`Remove ${bundle.book.title} offline copy`}
                      className="rounded-lg border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Bookmarks & Notes */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
          <BookmarkIcon className="h-4 w-4 text-amber-600" aria-hidden="true" />
          <span>Saved Bookmarks &amp; Study Annotations</span>
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {bookmarks.map((bm) => {
            const b = bookMap.get(bm.bookId);
            return (
              <div key={bm.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{bm.label}</p>
                  <p className="text-slate-500">
                    {b?.title || bm.bookId} · Page {bm.pageNumber}
                  </p>
                </div>
                {b && (
                  <button
                    type="button"
                    onClick={() => openReader(b)}
                    className="font-medium text-blue-800 hover:underline"
                  >
                    Open
                  </button>
                )}
              </div>
            );
          })}
          {annotations.map((ann) => {
            const b = bookMap.get(ann.bookId);
            return (
              <div key={ann.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                <p className="font-semibold capitalize text-slate-900">
                  {ann.type} · Page {ann.pageNumber}
                </p>
                <p className="mt-0.5 text-slate-700">{ann.noteText || ann.textSelection || 'Freehand drawing'}</p>
                <p className="mt-1 text-[11px] text-slate-500">{b?.title || ann.bookId}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Profile, Language Settings, Privacy & Content Issue Report */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <Settings className="h-4 w-4 text-blue-800" aria-hidden="true" />
            <span>{t('profile.title')}</span>
          </h2>
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="prof-name" className="block font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="prof-uilang" className="block font-medium text-slate-700">
                  {t('profile.uiLanguage')}
                </label>
                <select
                  id="prof-uilang"
                  value={uiLang}
                  onChange={(e) => setUiLanguage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {uiLanguages
                    .filter((l) => l.enabled)
                    .map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeName} ({l.name})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="prof-class" className="block font-medium text-slate-700">
                  Class
                </label>
                <select
                  id="prof-class"
                  value={profileClass}
                  onChange={(e) => setProfileClass(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="prof-board" className="block font-medium text-slate-700">
                  Board
                </label>
                <select
                  id="prof-board"
                  value={profileBoard}
                  onChange={(e) => setProfileBoard(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="prof-clang" className="block font-medium text-slate-700">
                  Book Language
                </label>
                <select
                  id="prof-clang"
                  value={profileContentLang}
                  onChange={(e) => setProfileContentLang(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {contentLanguages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-900 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
              >
                {profileSaved ? 'Saved!' : t('action.save')}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportMyData}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('profile.exportData')}
                </button>
                {user.role !== 'super_admin' && (
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 font-medium text-red-700 hover:bg-red-50"
                  >
                    <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('profile.deleteAccount')}</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-base font-semibold text-slate-900">{t('support.reportIssue')}</h2>
          <form onSubmit={handleSubmitTicket} className="mt-4 space-y-3 text-xs">
            <select
              aria-label="Related book"
              value={issueBookId}
              onChange={(e) => setIssueBookId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">General Support / Feedback</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  Book Issue: {b.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={issueSubject}
              onChange={(e) => setIssueSubject(e.target.value)}
              placeholder="Subject / Page reference"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              required
              rows={3}
              value={issueMsg}
              onChange={(e) => setIssueMsg(e.target.value)}
              placeholder="Describe the content correction or support request..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex items-center justify-between">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                {issueSubmitted ? 'Submitted!' : 'Submit Request'}
              </button>
              <span className="text-slate-500">{tickets.length} open/past tickets</span>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
