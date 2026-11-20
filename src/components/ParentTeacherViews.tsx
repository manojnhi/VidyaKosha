import React, { useEffect, useState } from 'react';
import { BookOpen, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Bookmark, BookSummary, ReadingProgress, SafeUser, Subscription } from '../shared/types';
import { apiFetch } from '../utils/api';

export const ParentDashboardView: React.FC = () => {
  const { books, openReader } = useApp();
  const [data, setData] = useState<{
    child: SafeUser | null;
    progress: ReadingProgress[];
    subscriptions: Subscription[];
    bookmarks: Bookmark[];
    books: BookSummary[];
  } | null>(null);

  useEffect(() => {
    apiFetch<typeof data>('/api/parent/overview').then(setData).catch(() => {});
  }, []);

  const enrichedMap = new Map(books.map((b) => [b.id, b]));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">Parent Monitoring Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track your child’s reading completion, active 1-year subscriptions, and study bookmarks.
        </p>
      </div>

      {data?.child && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Linked Student</p>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900">{data.child.name}</h2>
            <p className="text-xs text-slate-600">{data.child.email}</p>
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
              <p className="font-semibold text-slate-700">Active Subscriptions</p>
              {data.subscriptions.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-slate-800">{s.planName}</span>
                  <span className="font-medium text-emerald-700">Until {s.expiresAt.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h3 className="font-display text-base font-semibold text-slate-900">Child’s Reading Progress</h3>
            <div className="mt-3 space-y-3">
              {data.progress.map((prog) => {
                const bk = enrichedMap.get(prog.bookId);
                return (
                  <div key={prog.bookId} className="rounded-lg border border-slate-200 p-3.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{bk?.title || prog.bookId}</span>
                      <span className="font-mono-num text-slate-600">
                        Page {prog.lastPage}/{prog.totalPages} ({prog.percentComplete}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-blue-800" style={{ width: `${prog.percentComplete}%` }} />
                    </div>
                    {bk && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openReader(bk)}
                          className="text-xs font-medium text-blue-800 hover:underline"
                        >
                          Inspect Book in Reader
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TeacherDashboardView: React.FC = () => {
  const { books, openReader } = useApp();
  const [data, setData] = useState<{
    students: SafeUser[];
    studentProgress: ReadingProgress[];
  } | null>(null);

  useEffect(() => {
    apiFetch<typeof data>('/api/teacher/overview').then(setData).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">Teacher Classroom Console</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review curriculum books, classroom practice worksheets, and student reading completion.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <Users className="h-4 w-4 text-blue-800" />
            <span>Enrolled Students ({data?.students.length || 0})</span>
          </h2>
          <div className="mt-3 space-y-2 text-xs">
            {(data?.students || []).map((st) => {
              const items = (data?.studentProgress || []).filter((p) => p.userId === st.id);
              return (
                <div key={st.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">{st.name}</p>
                  <p className="text-slate-500">{st.email}</p>
                  <p className="mt-1 font-mono-num text-blue-800">{items.length} active books read</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-slate-900">
            <GraduationCap className="h-4 w-4 text-blue-800" />
            <span>Published Curriculum Textbooks (Full Educator Access)</span>
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {books.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs">
                <div className="min-w-0 pr-2">
                  <p className="truncate font-semibold text-slate-900">{b.title}</p>
                  <p className="text-slate-500">
                    {b.contentLanguageCode.toUpperCase()} · {b.learningResources.length} worksheets
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openReader(b)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-900 px-3 py-1.5 font-medium text-white"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Open</span>
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <span>Educator role grants full textbook &amp; worksheet inspection without student paywalls.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
