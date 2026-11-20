import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { type ActiveTab, useApp } from '../context/AppContext';

export const Header: React.FC = () => {
  const { config, user, activeTab, setActiveTab, setShowAuthModal, can, t } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fifthTab: { id: ActiveTab; label: string } = can('books.manage')
    ? { id: 'admin', label: t('nav.admin') }
    : can('parent.monitor')
      ? { id: 'parent', label: t('nav.parent') }
      : can('teacher.assign')
        ? { id: 'teacher', label: t('nav.teacher') }
        : { id: 'help', label: t('nav.help') };

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'library', label: t('nav.library') },
    { id: 'my_learning', label: t('nav.myLearning') },
    { id: 'plans', label: t('nav.plans') },
    { id: 'resources', label: t('nav.resources') },
    fifthTab,
  ];

  const handleNav = (id: ActiveTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Title */}
        <button
          type="button"
          onClick={() => handleNav('library')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          {config?.appName || 'VidyaKosha'}
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  active
                    ? 'border-blue-800 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {user ? user.name.split(' ')[0] : t('action.signIn')}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-slate-200 bg-white px-4 py-3 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`flex min-h-[44px] items-center rounded-lg px-3 text-left text-sm font-medium ${
                  activeTab === item.id
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            {fifthTab.id !== 'help' && (
              <button
                type="button"
                onClick={() => handleNav('help')}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('nav.help')}
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};
