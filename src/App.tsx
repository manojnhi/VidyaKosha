import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { BookReader } from './components/BookReader';
import { CheckoutModal } from './components/CheckoutModal';
import { Header } from './components/Header';
import { LibraryView } from './components/LibraryView';
import { MyLearningView } from './components/MyLearningView';
import { OnboardingModal } from './components/OnboardingModal';
import { ParentDashboardView, TeacherDashboardView } from './components/ParentTeacherViews';
import { PlansView } from './components/PlansView';
import { OfflineIndicator } from './components/PWAInstallButton';
import { HelpAndLegalView, ResourcesView } from './components/ResourcesAndHelpView';

const AppShell: React.FC = () => {
  const { loading, error, activeTab, setActiveTab, setShowAuthModal, can, config, t, refreshAll } = useApp();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-900" />
          <p className="mt-3 text-sm font-medium text-slate-600">Loading VidyaKosha Digital Library...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center">
          <h1 className="font-display text-lg font-bold text-slate-900">Connection Error</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => refreshAll()}
            className="mt-4 rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="flex-1 pb-12">
        {activeTab === 'library' && <LibraryView />}
        {activeTab === 'my_learning' && <MyLearningView />}
        {activeTab === 'plans' && <PlansView />}
        {activeTab === 'resources' && <ResourcesView />}
        {activeTab === 'help' && <HelpAndLegalView />}
        {activeTab === 'parent' && <ParentDashboardView />}
        {activeTab === 'teacher' && <TeacherDashboardView />}
        {activeTab === 'admin' && <AdminPanel />}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-slate-600 sm:px-6 lg:px-8">
          <div>
            <span className="font-semibold text-slate-900">{config?.appName || 'VidyaKosha'}</span>
            <span className="mx-2">·</span>
            <span>{config?.tagline}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setActiveTab('help')} className="hover:text-slate-900">
              {t('nav.help')}
            </button>
            <button type="button" onClick={() => setActiveTab('plans')} className="hover:text-slate-900">
              {t('nav.plans')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (can('books.manage')) setActiveTab('admin');
                else setShowAuthModal(true);
              }}
              className="hover:text-slate-900"
            >
              {t('nav.admin')}
            </button>
            <span>© 2026 {config?.appName || 'VidyaKosha'}</span>
          </div>
        </div>
      </footer>

      <OnboardingModal />
      <AuthModal />
      <CheckoutModal />
      <BookReader />
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
