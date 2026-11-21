import React, { useState } from 'react';
import { BookOpen, Leaf, LogOut, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

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
    logout,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'parent' | 'teacher'>('student');
  const [classId, setClassId] = useState('cls-10');
  const [boardId, setBoardId] = useState('brd-cbse');
  const [contentLang, setContentLang] = useState('hi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showAuthModal) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          classId,
          boardId,
          preferredContentLanguageCode: contentLang,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not sign you in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const setPageMode = (next: 'login' | 'register') => {
    setError(null);
    setMode(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#e7eafb] p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/80 bg-[#f4f1e7] shadow-[0_28px_90px_rgba(42,49,78,0.20)]">
        <div className="flex min-h-[540px] flex-col md:flex-row">
          <section className="flex flex-1 flex-col bg-white">
            <header className="flex items-center justify-between border-b border-[#ece8dc] px-6 py-4 sm:px-8">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[#34412f]">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>VidyaKosha</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
                <button
                  type="button"
                  onClick={() => setPageMode(mode === 'login' ? 'register' : 'login')}
                  className="rounded-md bg-[#253327] px-3 py-1.5 font-semibold text-white transition hover:bg-[#344632]"
                >
                  {mode === 'login' ? 'Sign up' : 'Log in'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  aria-label="Close login"
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8 sm:px-10">
              {user ? (
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#edf2e8] text-[#344b35]">
                    <BookOpen className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h2 id="auth-modal-title" className="mt-5 text-2xl font-semibold text-slate-900">
                    {user.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">{user.email}</p>
                  <p className="mt-1 text-sm text-slate-500">{user.role.replace('_', ' ')}</p>
                  <button
                    type="button"
                    onClick={logout}
                    className="mt-7 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#738069]">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      VidyaKosha Library
                    </p>
                    <h2 id="auth-modal-title" className="text-3xl font-semibold tracking-tight text-[#252a24]">
                      {mode === 'login' ? 'Log in' : 'Create your account'}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {mode === 'login'
                        ? 'Continue reading and learning with your library account.'
                        : 'Join the library to save books and track your learning.'}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                        {error}
                      </div>
                    )}

                    {mode === 'register' && (
                      <>
                        <div>
                          <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700">Full name</label>
                          <input
                            id="auth-name"
                            type="text"
                            autoComplete="name"
                            required
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Your name"
                            className="mt-1.5 w-full rounded-md border border-[#e2e1d9] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#65745d] focus:ring-2 focus:ring-[#65745d]/15"
                          />
                        </div>
                        <div>
                          <label htmlFor="auth-role" className="block text-xs font-semibold text-slate-700">Account type</label>
                          <select
                            id="auth-role"
                            value={role}
                            onChange={(event) => setRole(event.target.value as 'student' | 'parent' | 'teacher')}
                            className="mt-1.5 w-full rounded-md border border-[#e2e1d9] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#65745d]"
                          >
                            <option value="student">Student</option>
                            <option value="parent">Parent</option>
                            <option value="teacher">Teacher</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div>
                      <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700">Username or Email</label>
                      <input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="name@example.com"
                        className="mt-1.5 w-full rounded-md border border-[#e2e1d9] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#65745d] focus:ring-2 focus:ring-[#65745d]/15"
                      />
                    </div>

                    <div>
                      <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700">Password</label>
                      <input
                        id="auth-password"
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        minLength={6}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                        className="mt-1.5 w-full rounded-md border border-[#e2e1d9] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#65745d] focus:ring-2 focus:ring-[#65745d]/15"
                      />
                    </div>

                    {mode === 'register' && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label htmlFor="reg-class" className="block text-xs font-semibold text-slate-700">Class</label>
                          <select id="reg-class" value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#e2e1d9] bg-white px-2.5 py-2.5 text-sm">
                            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="reg-board" className="block text-xs font-semibold text-slate-700">Board</label>
                          <select id="reg-board" value={boardId} onChange={(event) => setBoardId(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#e2e1d9] bg-white px-2.5 py-2.5 text-sm">
                            {boards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="reg-language" className="block text-xs font-semibold text-slate-700">Book language</label>
                          <select id="reg-language" value={contentLang} onChange={(event) => setContentLang(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#e2e1d9] bg-white px-2.5 py-2.5 text-sm">
                            {contentLanguages.map((item) => <option key={item.code} value={item.code}>{item.nativeName}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-md bg-[#263429] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#354634] disabled:cursor-wait disabled:opacity-60"
                    >
                      {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
                    </button>
                  </form>
                  <p className="mt-4 text-center text-xs text-slate-400">Your account keeps your reading progress in sync.</p>
                </>
              )}
            </div>
          </section>

          <aside className="relative hidden min-h-[540px] flex-1 items-center justify-center overflow-hidden bg-[#f4f1e7] px-8 md:flex">
            <div className="absolute left-8 top-8 text-xs font-medium text-[#8a887c]">A quiet place to learn</div>
            <div className="absolute right-10 top-12 text-[#88a9bb]"><Sparkles className="h-5 w-5" aria-hidden="true" /></div>
            <div className="absolute left-14 top-1/3 text-[#9cb9be]"><Sparkles className="h-4 w-4" aria-hidden="true" /></div>
            <div className="relative flex h-72 w-80 items-end justify-center">
              <div className="absolute bottom-4 left-12 h-3 w-60 rounded-full bg-[#d8d1be]" />
              <div className="absolute bottom-7 left-16 h-10 w-52 -rotate-3 rounded-md border-b-[6px] border-[#8b493c] bg-[#d9886e] shadow-md" />
              <div className="absolute bottom-[4.4rem] left-20 h-11 w-48 rotate-2 rounded-md border-b-[6px] border-[#315447] bg-[#75a78b] shadow-md" />
              <div className="absolute bottom-[6.9rem] left-[4.2rem] h-10 w-56 -rotate-2 rounded-md border-b-[6px] border-[#a87b35] bg-[#e4bc65] shadow-md" />
              <div className="absolute bottom-[9.2rem] left-[5.1rem] h-10 w-44 rotate-2 rounded-md border-b-[6px] border-[#344c62] bg-[#738ca0] shadow-md" />
              <div className="absolute bottom-[11.5rem] left-[4.6rem] flex h-11 w-52 -rotate-1 items-center justify-center rounded-md border-b-[6px] border-[#c87552] bg-[#efad7b] shadow-md">
                <BookOpen className="h-5 w-5 text-white/90" aria-hidden="true" />
              </div>
              <div className="absolute bottom-5 right-7 flex h-16 w-12 items-end justify-center">
                <div className="absolute bottom-0 h-6 w-10 rounded-b-xl rounded-t-md bg-[#d99d70]" />
                <Leaf className="absolute bottom-5 h-9 w-8 -rotate-12 text-[#47775a]" aria-hidden="true" />
                <Leaf className="absolute bottom-7 right-0 h-7 w-6 rotate-45 text-[#638b68]" aria-hidden="true" />
              </div>
              <div className="absolute bottom-16 left-9 text-[#87a8b8]"><Sparkles className="h-5 w-5" aria-hidden="true" /></div>
            </div>
            <div className="absolute bottom-8 text-center">
              <p className="font-display text-lg font-semibold text-[#3b4739]">Books open new worlds</p>
              <p className="mt-1 text-xs text-[#858476]">Read, learn, and keep growing.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
