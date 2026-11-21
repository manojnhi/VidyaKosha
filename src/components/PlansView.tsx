import React, { useState } from 'react';
import { Check, CreditCard, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const PlansView: React.FC = () => {
  const { plans, config, subscriptions, openCheckout, boards, classes, subjects, t } = useApp();
  const [policyTab, setPolicyTab] = useState<'refund' | 'terms' | null>(null);

  const sym = config?.currencySymbol || '₹';
  const boardMap = new Map(boards.map((b) => [b.id, b.name]));
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-medium text-slate-500">
            1-Year Annual Plans · {config?.targetCountry || 'IN'} Pricing ({config?.currency || 'INR'})
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Subscription Plans &amp; Academic Passes
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Browse the learning plans currently available in the library.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setPolicyTab(policyTab === 'refund' ? null : 'refund')}
            className="font-medium text-blue-800 underline underline-offset-4"
          >
            Refund Policy
          </button>
          <button
            type="button"
            onClick={() => setPolicyTab(policyTab === 'terms' ? null : 'terms')}
            className="font-medium text-blue-800 underline underline-offset-4"
          >
            Purchase Terms
          </button>
        </div>
      </div>

      {policyTab && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <h3 className="font-semibold text-slate-900">
            {policyTab === 'refund' ? 'Refund & Cancellation Policy' : 'Purchase & Licensing Terms'}
          </h3>
          <p className="mt-2 leading-relaxed">
            {policyTab === 'refund' ? config?.legalPages.refundPolicy : config?.legalPages.purchaseTerms}
          </p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isActive = subscriptions.some((s) => s.planId === plan.id && s.status === 'active');
          const scopeLabel =
            plan.scopeType === 'all_access'
              ? 'All Boards · Nursery–Class 12'
              : [
                  plan.classId ? classMap.get(plan.classId) : null,
                  plan.boardId ? boardMap.get(plan.boardId) : null,
                  plan.subjectId ? subjectMap.get(plan.subjectId) : null,
                ]
                  .filter(Boolean)
                  .join(' · ');

          return (
            <div
              key={plan.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
            >
              <div>
                <p className="text-xs font-medium text-slate-500">{scopeLabel}</p>
                <h2 className="mt-1 font-display text-xl font-bold text-slate-900">{plan.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{plan.description}</p>

                <div className="mt-5 flex items-baseline gap-1.5 border-y border-slate-100 py-4">
                  <span className="font-mono-num text-3xl font-bold text-slate-900">
                    {sym}
                    {plan.price}
                  </span>
                  <span className="text-xs text-slate-500">
                    / {plan.durationDays} days (+{plan.taxRatePercent}% {config?.taxLabel || 'GST'})
                  </span>
                </div>

                <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4">
                {isActive ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Active Subscription</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openCheckout({ plan })}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 transition-colors"
                  >
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    <span>{t('action.subscribe')}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
