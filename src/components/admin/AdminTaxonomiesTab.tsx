import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../utils/api';

export const AdminTaxonomiesTab: React.FC = () => {
  const { boards, classes, subjects, contentLanguages, uiLanguages, refreshAll } = useApp();

  const [boardCode, setBoardCode] = useState('');
  const [boardName, setBoardName] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [langCode, setLangCode] = useState('');
  const [langName, setLangName] = useState('');
  const [langNative, setLangNative] = useState('');
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');

  const addBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/taxonomies/boards', {
      method: 'POST',
      body: JSON.stringify({ code: boardCode, name: boardName }),
    });
    setBoardCode('');
    setBoardName('');
    await refreshAll();
  };

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/taxonomies/subjects', {
      method: 'POST',
      body: JSON.stringify({ name: subjectName }),
    });
    setSubjectName('');
    await refreshAll();
  };

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/taxonomies/classes', {
      method: 'POST',
      body: JSON.stringify({ code: classCode, name: className }),
    });
    setClassCode('');
    setClassName('');
    await refreshAll();
  };

  const addContentLang = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/taxonomies/contentLanguages', {
      method: 'POST',
      body: JSON.stringify({ code: langCode, name: langName, nativeName: langNative || langName }),
    });
    setLangCode('');
    setLangName('');
    setLangNative('');
    await refreshAll();
  };

  const toggleItem = async (type: string, id: string, enabled: boolean) => {
    await apiFetch(`/api/admin/taxonomies/${type}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
    await refreshAll();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Education Boards */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-xs">
        <h3 className="font-display text-base font-semibold text-slate-900">Education Boards</h3>
        <form onSubmit={addBoard} className="mt-3 flex gap-2">
          <input
            type="text"
            required
            placeholder="Code (e.g. NIOS)"
            value={boardCode}
            onChange={(e) => setBoardCode(e.target.value)}
            className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <input
            type="text"
            required
            placeholder="Board Name"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-blue-900 px-3 py-1.5 font-medium text-white">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </form>
        <div className="mt-3 divide-y divide-slate-100">
          {boards.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-2">
              <span className="font-medium text-slate-800">
                {b.code} — {b.name}
              </span>
              <button
                type="button"
                onClick={() => toggleItem('boards', b.id, !b.enabled)}
                className={`rounded border px-2 py-0.5 font-medium ${
                  b.enabled ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-400'
                }`}
              >
                {b.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Book Content Languages */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-xs">
        <h3 className="font-display text-base font-semibold text-slate-900">
          Book Content Languages &amp; UI Languages
        </h3>
        <form onSubmit={addContentLang} className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            required
            placeholder="Code (ta)"
            value={langCode}
            onChange={(e) => setLangCode(e.target.value)}
            className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <input
            type="text"
            required
            placeholder="Name (Tamil)"
            value={langName}
            onChange={(e) => setLangName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <input
            type="text"
            placeholder="Native (தமிழ்)"
            value={langNative}
            onChange={(e) => setLangNative(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-blue-900 px-3 py-1.5 font-medium text-white">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </form>
        <div className="mt-3 divide-y divide-slate-100">
          {contentLanguages.map((l) => (
            <div key={l.code} className="flex items-center justify-between py-2">
              <span className="font-medium text-slate-800">
                {l.nativeName} ({l.name} · {l.code})
              </span>
              <button
                type="button"
                onClick={() => toggleItem('contentLanguages', l.code, !l.enabled)}
                className={`rounded border px-2 py-0.5 font-medium ${
                  l.enabled ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-400'
                }`}
              >
                {l.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="font-semibold text-slate-700">Interface Languages ({uiLanguages.length})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {uiLanguages.map((ul) => (
              <button
                key={ul.code}
                type="button"
                onClick={() => toggleItem('uiLanguages', ul.code, !ul.enabled)}
                className={`rounded border px-2.5 py-1 ${
                  ul.enabled ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-400'
                }`}
              >
                {ul.nativeName} ({ul.enabled ? 'On' : 'Off'})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-xs">
        <h3 className="font-display text-base font-semibold text-slate-900">Subjects</h3>
        <form onSubmit={addSubject} className="mt-3 flex gap-2">
          <input
            type="text"
            required
            placeholder="New Subject Name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-blue-900 px-3 py-1.5 font-medium text-white">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </form>
        <div className="mt-3 divide-y divide-slate-100">
          {subjects.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2">
              <span className="font-medium text-slate-800">{s.name}</span>
              <button
                type="button"
                onClick={() => toggleItem('subjects', s.id, !s.enabled)}
                className={`rounded border px-2 py-0.5 font-medium ${
                  s.enabled ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-400'
                }`}
              >
                {s.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Classes Nursery–12 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-xs">
        <h3 className="font-display text-base font-semibold text-slate-900">Classes (Nursery – Class 12)</h3>
        <form onSubmit={addClass} className="mt-3 flex gap-2">
          <input
            type="text"
            required
            placeholder="Code (PG)"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <input
            type="text"
            required
            placeholder="Class Name"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5"
          />
          <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-blue-900 px-3 py-1.5 font-medium text-white">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </form>
        <div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pt-1">
          {classes
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border border-slate-200 px-2.5 py-1.5">
                <span className="font-medium text-slate-800">{c.name}</span>
                <button
                  type="button"
                  onClick={() => toggleItem('classes', c.id, !c.enabled)}
                  className={c.enabled ? 'text-emerald-700 font-semibold' : 'text-slate-400'}
                >
                  {c.enabled ? 'On' : 'Off'}
                </button>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
};
