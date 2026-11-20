import React, { useState } from 'react';
import { BookOpen, FileText, HelpCircle, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ResourcesView: React.FC = () => {
  const { books, openReader, classes, boards } = useApp();
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const boardMap = new Map(boards.map((b) => [b.id, b.code]));

  const resources = books.flatMap((book) =>
    book.learningResources.map((res) => ({
      ...res,
      book,
    }))
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Worksheets, Sample Papers &amp; Chapter Practice
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Board-aligned practice materials linked directly to published textbooks.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {resources.map((item) => (
          <div key={item.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                {item.type.replace('_', ' ')} · {classMap.get(item.book.classId)} · {boardMap.get(item.book.boardId)}
              </p>
              <h2 className="mt-2 font-display text-base font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-1 text-xs text-slate-600">{item.chapter}</p>
              <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="truncate text-xs text-slate-500 max-w-[170px]">{item.book.title}</span>
              <button
                type="button"
                onClick={() => openReader(item.book)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Open Book</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const HelpAndLegalView: React.FC = () => {
  const { config, setActiveTab } = useApp();
  const [openFaq, setOpenFaq] = useState<number>(0);

  const faqs = [
    {
      q: 'Are app interface language and book content language separate?',
      a: 'Yes. Changing your app interface language (Hindi, English, Marathi) translates menus, buttons, and help text without altering the book catalog language. Inside the Reader, you can switch between explicitly linked official language editions of a book. Unavailable languages show a clear notice and are never auto-translated.',
    },
    {
      q: 'How does offline reading work securely?',
      a: 'Only books whose publisher license permits offline storage AND for which you hold active access (free or valid subscription) can be cached for offline reading inside the app.',
    },
    {
      q: 'Can I switch boards or classes mid-year?',
      a: 'Yes. Update your Class and Board preferences anytime from My Learning → Profile & Language Settings.',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">Help Center, Licensing &amp; Policies</h1>
        <p className="mt-1 text-sm text-slate-600">
          Frequently asked questions, privacy rights, refund policy, and content reporting.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
          <HelpCircle className="h-5 w-5 text-blue-800" aria-hidden="true" />
          <span>Frequently Asked Questions</span>
        </h2>
        <div className="mt-4 divide-y divide-slate-200">
          {faqs.map((item, idx) => (
            <div key={idx} className="py-3">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900"
              >
                <span>{item.q}</span>
                <span className="text-slate-400">{openFaq === idx ? '−' : '+'}</span>
              </button>
              {openFaq === idx && <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Shield className="h-4 w-4 text-blue-800" />
            Privacy Policy
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{config?.legalPages.privacyPolicy}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <BookOpen className="h-4 w-4 text-blue-800" />
            Purchase Terms
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{config?.legalPages.purchaseTerms}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Refund &amp; Cancellation</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{config?.legalPages.refundPolicy}</p>
          <button
            type="button"
            onClick={() => setActiveTab('my_learning')}
            className="mt-3 text-xs font-medium text-blue-800 underline underline-offset-4"
          >
            Contact Support / Report Issue
          </button>
        </div>
      </section>
    </div>
  );
};
