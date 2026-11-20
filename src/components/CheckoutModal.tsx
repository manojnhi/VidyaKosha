import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Receipt, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, type PaymentTransaction } from '../utils/api';
import type { Subscription } from '../shared/types';

export const CheckoutModal: React.FC = () => {
  const { checkoutTarget, closeCheckout, config, t } = useApp();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [providerId, setProviderId] = useState(config?.activePaymentProvider || 'razorpay_in');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [preview, setPreview] = useState<{
    itemTitle: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    couponApplied: boolean;
    couponError?: string;
  } | null>(null);
  const [receipt, setReceipt] = useState<{
    transaction: PaymentTransaction;
    subscription: Subscription;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!checkoutTarget) {
      setReceipt(null);
      setError(null);
      setCouponCode('');
      setAppliedCoupon('');
      return;
    }
    const fetchPreview = async () => {
      try {
        const res = await apiFetch<typeof preview>('/api/checkout/preview', {
          method: 'POST',
          body: JSON.stringify({
            planId: checkoutTarget.plan?.id,
            bookId: checkoutTarget.book?.id,
            couponCode: appliedCoupon || undefined,
          }),
        });
        setPreview(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to compute price.');
      }
    };
    fetchPreview();
  }, [checkoutTarget, appliedCoupon]);

  if (!checkoutTarget) return null;

  const sym = config?.currencySymbol || '₹';

  const handlePay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ transaction: PaymentTransaction; subscription: Subscription }>(
        '/api/checkout/pay',
        {
          method: 'POST',
          body: JSON.stringify({
            planId: checkoutTarget.plan?.id,
            bookId: checkoutTarget.book?.id,
            couponCode: appliedCoupon || undefined,
            providerId,
            simulateFailure,
          }),
        }
      );
      setReceipt(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-blue-800" aria-hidden="true" />
            <h2 id="checkout-modal-title" className="font-display text-lg font-bold text-slate-900">
              {receipt ? t('checkout.receiptTitle') : t('checkout.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCheckout}
            aria-label="Close checkout"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {receipt ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Subscription Activated (1 Year)</p>
                <p className="mt-0.5 text-xs">
                  Valid until {receipt.subscription.expiresAt.slice(0, 10)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 text-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Receipt className="h-4 w-4" aria-hidden="true" />
                  Invoice
                </span>
                <span className="font-mono-num text-xs font-semibold text-slate-900">
                  {receipt.transaction.invoiceNumber}
                </span>
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Plan / Book</dt>
                  <dd className="font-medium text-slate-900">{receipt.transaction.planName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Gateway ({receipt.transaction.countryCode})</dt>
                  <dd className="text-slate-700">{receipt.transaction.provider}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t('checkout.subtotal')}</dt>
                  <dd className="font-mono-num">
                    {sym}
                    {receipt.transaction.subtotal.toFixed(2)}
                  </dd>
                </div>
                {receipt.transaction.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>{t('checkout.discount')}</dt>
                    <dd className="font-mono-num">
                      -{sym}
                      {receipt.transaction.discountAmount.toFixed(2)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">
                    {t('checkout.tax')} ({config?.taxLabel || 'GST'})
                  </dt>
                  <dd className="font-mono-num">
                    {sym}
                    {receipt.transaction.taxAmount.toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <dt>{t('checkout.total')}</dt>
                  <dd className="font-mono-num">
                    {sym}
                    {receipt.transaction.totalAmount.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeCheckout}
                className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
              >
                Done &amp; Return
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {preview && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{preview.itemTitle}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Duration: 365 days · Country: {config?.targetCountry || 'IN'} · Currency: {config?.currency || 'INR'}
                </p>
              </div>
            )}

            {/* Payment Provider (country-configurable) */}
            <div>
              <label htmlFor="chk-provider" className="block text-xs font-medium text-slate-700">
                Payment Gateway ({config?.targetCountry || 'IN'})
              </label>
              <select
                id="chk-provider"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {(config?.paymentProviders || [])
                  .filter((p) => p.enabled)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.methodsLabel}
                    </option>
                  ))}
              </select>
            </div>

            {/* Coupon */}
            <div>
              <label htmlFor="chk-coupon" className="block text-xs font-medium text-slate-700">
                Promo / Coupon Code
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="chk-coupon"
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder={t('checkout.couponPlaceholder')}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
                />
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(couponCode.trim())}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                >
                  {t('checkout.applyCoupon')}
                </button>
              </div>
              {preview?.couponError && (
                <p className="mt-1 text-xs text-red-700">Coupon code invalid or expired.</p>
              )}
              {preview?.couponApplied && (
                <p className="mt-1 text-xs text-emerald-700">Coupon {appliedCoupon.toUpperCase()} applied.</p>
              )}
            </div>

            {/* Price Breakdown */}
            {preview && (
              <dl className="space-y-1.5 rounded-lg border border-slate-200 p-4 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-600">{t('checkout.subtotal')}</dt>
                  <dd className="font-mono-num font-medium text-slate-900">
                    {sym}
                    {preview.subtotal.toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <dt>{t('checkout.discount')}</dt>
                  <dd className="font-mono-num">
                    -{sym}
                    {preview.discountAmount.toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">
                    {t('checkout.tax')} ({config?.taxLabel || 'GST'} {config?.taxRatePercent || 18}%)
                  </dt>
                  <dd className="font-mono-num text-slate-900">
                    {sym}
                    {preview.taxAmount.toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <dt>{t('checkout.total')}</dt>
                  <dd className="font-mono-num">
                    {sym}
                    {preview.totalAmount.toFixed(2)}
                  </dd>
                </div>
              </dl>
            )}

            <p className="text-[11px] leading-relaxed text-slate-500">{t('checkout.cardNotice')}</p>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                />
                <span>Simulate gateway failure (for testing)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowTerms((v) => !v)}
                className="text-blue-800 underline underline-offset-2"
              >
                Refund &amp; Terms
              </button>
            </div>

            {showTerms && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-800">Refund Policy</p>
                <p className="mt-1">{config?.legalPages.refundPolicy}</p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeCheckout}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handlePay}
                className="rounded-lg bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {busy ? 'Processing...' : t('checkout.payNow')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
