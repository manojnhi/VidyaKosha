import React, { useState } from 'react';
import { Globe2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const OnboardingModal: React.FC = () => {
  const {
    showOnboarding,
    setShowOnboarding,
    uiLanguages,
    contentLanguages,
    classes,
    boards,
    uiLang,
    setUiLanguage,
    t,
  } = useApp();

  const [selectedUiLang, setSelectedUiLang] = useState(uiLang);
  const [selectedClass, setSelectedClass] = useState('cls-10');
  const [selectedBoard, setSelectedBoard] = useState('brd-cbse');
  const [selectedContentLang, setSelectedContentLang] = useState('hi');

  if (!showOnboarding) return null;

  const handleLanguagePick = async (code: string) => {
    setSelectedUiLang(code);
    await setUiLanguage(code);
  };

  const handleContinue = async () => {
    await setUiLanguage(selectedUiLang);
    try {
      localStorage.setItem(
        'vidyakosha_student_prefs',
        JSON.stringify({
          classId: selectedClass,
          boardId: selectedBoard,
          contentLanguageCode: selectedContentLang,
        })
      );
    } catch {
      // ignore
    }
    setShowOnboarding(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-heading"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-2.5 text-blue-900">
          <Globe2 className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wide text-slate-600">
            VidyaKosha · Multilingual Setup
          </span>
        </div>

        <h2 id="onboarding-heading" className="mt-3 font-display text-2xl font-bold text-slate-900">
          {t('onboarding.chooseUiLang')}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t('onboarding.subtitle')}</p>

        {/* UI Language Choice */}
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {uiLanguages
            .filter((l) => l.enabled)
            .map((lang) => {
              const active = selectedUiLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguagePick(lang.code)}
                  className={`flex min-h-[54px] flex-col items-start justify-center rounded-lg border px-4 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-blue-800 bg-blue-50/70 text-blue-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-sm font-semibold">{lang.nativeName}</span>
                  <span className="text-xs text-slate-500">{lang.name}</span>
                </button>
              );
            })}
        </div>

        {/* Optional Class, Board & Content Language */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
          <div>
            <label htmlFor="onb-class" className="block text-xs font-medium text-slate-700">
              {t('onboarding.classLabel')}
            </label>
            <select
              id="onb-class"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
          </div>

          <div>
            <label htmlFor="onb-board" className="block text-xs font-medium text-slate-700">
              {t('onboarding.boardLabel')}
            </label>
            <select
              id="onb-board"
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
          </div>

          <div>
            <label htmlFor="onb-clang" className="block text-xs font-medium text-slate-700">
              {t('onboarding.contentLangLabel')}
            </label>
            <select
              id="onb-clang"
              value={selectedContentLang}
              onChange={(e) => setSelectedContentLang(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleContinue()}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4"
          >
            {t('onboarding.openLibrary')}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 transition-colors"
          >
            {t('onboarding.continue')}
          </button>
        </div>
      </div>
    </div>
  );
};
