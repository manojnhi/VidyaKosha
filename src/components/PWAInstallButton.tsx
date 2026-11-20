import React, { useState } from 'react';
import { Download, MonitorSmartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ label?: string; variant?: 'compact' | 'card' }> = ({
  label = 'Install App',
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'card'
            ? 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
      >
        <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install Desktop & Android App"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Install on Desktop &amp; Android</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {isIOS
                ? 'Tap the Share button in Safari, then choose "Add to Home Screen" for full-screen offline access.'
                : 'In Chrome or Edge on Desktop/Android, click the Install icon in the browser address bar (or Menu → Install App) to run as a standalone app.'}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-md"
    >
      <WifiOff className="h-4 w-4 text-amber-700" aria-hidden="true" />
      <span>Offline Mode — Cached licensed books remain readable</span>
    </div>
  );
};
