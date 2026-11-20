import React, { useState } from 'react';
import { LogOut, ShieldCheck, UserCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { RoleId } from '../shared/types';

export const AuthModal: React.FC = () => {
  const {
    showAuthModal,
    setShowAuthModal,
    user,
    classes,
    boards,
    contentLanguages,
    login,
    register,
    demoSwitchRole,
    logout,
    t,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('aarav@student.vidyakosha.edu');
  const [password, setPassword] = useState('Student@123');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'parent' | 'teacher'>('student');
  const [classId, setClassId] = useState('cls-10');
  const [boardId, setBoardId] = useState('brd-cbse');
  const [contentLang, setContentLang] = useState('hi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showAuthModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({
          name,
          email,
          password,
          role,
          classId,
          boardId,
          preferredContentLanguageCode: contentLang,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const rolesList: { role: RoleId; label: string; emailHint: string }[] = [
    { role: 'student', label: t('role.student'), emailHint: 'aarav@student.vidyakosha.edu' },
    { role: 'parent', label: t('role.parent'), emailHint: 'parent@vidyakosha.edu' },
    { role: 'teacher', label: t('role.teacher'), emailHint: 'teacher@vidyakosha.edu' },
    { role: 'admin', label: t('role.admin'), emailHint: 'content@vidyakosha.edu' },
    { role: 'super_admin', label: t('role.super_admin'), emailHint: 'superadmin@vidyakosha.edu' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 id="auth-modal-title" className="font-display text-xl font-bold text-slate-900">
              {user ? user.name : t('action.signIn')}
            </h2>
            {user && (
              <p className="mt-0.5 text-xs text-slate-600">
                {t(`role.${user.role}` as const)} · {user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowAuthModal(false)}
            aria-label="Close account modal"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {user && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-blue-800" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold text-slate-900">Signed in as {user.name}</p>
                <p className="text-xs text-slate-600">{t(`role.${user.role}` as const)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('action.signOut')}</span>
            </button>
          </div>
        )}

        {/* Quick Demo Role Switcher */}
        <div className="mt-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-blue-800" aria-hidden="true" />
            <span>Role-Based Workspace Switcher (Demo Accounts)</span>
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rolesList.map((item) => {
              const isCurrent = user?.role === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => demoSwitchRole(item.role)}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                    isCurrent
                      ? 'border-blue-800 bg-blue-50 text-blue-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-semibold">{item.label}</span>
                  <span className="mt-0.5 truncate max-w-full text-[11px] text-slate-500">{item.emailHint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Standard Email / Password Sign In or Registration */}
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {error}
              </div>
            )}

            {mode === 'register' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-medium text-slate-700">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ananya Sharma"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="auth-role" className="block text-xs font-medium text-slate-700">
                    Account Role
                  </label>
                  <select
                    id="auth-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'student' | 'parent' | 'teacher')}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="student">{t('role.student')}</option>
                    <option value="parent">{t('role.parent')}</option>
                    <option value="teacher">{t('role.teacher')}</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="reg-class" className="block text-xs font-medium text-slate-700">
                    Class
                  </label>
                  <select
                    id="reg-class"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-board" className="block text-xs font-medium text-slate-700">
                    Board
                  </label>
                  <select
                    id="reg-board"
                    value={boardId}
                    onChange={(e) => setBoardId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-clang" className="block text-xs font-medium text-slate-700">
                    Book Language
                  </label>
                  <select
                    id="reg-clang"
                    value={contentLang}
                    onChange={(e) => setContentLang(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {contentLanguages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {busy ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
