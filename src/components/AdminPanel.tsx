import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookMarked,
  Download,
  Layers,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Upload,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type {
  AuditLogEntry,
  BulkImportJob,
  Coupon,
  PaymentTransaction,
  Permission,
  RoleId,
  SafeUser,
  SubscriptionPlan,
  SupportTicket,
} from '../shared/types';
import { apiFetch, type EnrichedBook } from '../utils/api';
import { AdminBooksSection, AdminTaxonomiesSection } from './AdminBooksAndTaxonomies';

type AdminTab = 'overview' | 'books' | 'taxonomies' | 'users' | 'reports' | 'config' | 'architecture';

interface AdminUserRow extends SafeUser {
  subscriptionsCount: number;
  totalSpent: number;
}

export const AdminPanel: React.FC = () => {
  const { user, config, can, refreshAll, t } = useApp();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [adminBooks, setAdminBooks] = useState<EnrichedBook[]>([]);
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [bulkJobs, setBulkJobs] = useState<BulkImportJob[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [reports, setReports] = useState<{
    summary: {
      totalRevenue: number;
      succeededCount: number;
      failedCount: number;
      activeSubscriptions: number;
      expiringSoon: number;
      publishedBooks: number;
      totalUsers: number;
    };
    payments: PaymentTransaction[];
    popularBooks: { id: string; title: string; contentLanguageCode: string; boardId: string; readCount: number }[];
    usageByLanguage: Record<string, number>;
    usageByBoard: Record<string, number>;
    coupons: Coupon[];
    plans: SubscriptionPlan[];
  } | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // App Config Editor
  const [cfgAppName, setCfgAppName] = useState(config?.appName || 'VidyaKosha');
  const [cfgCountry, setCfgCountry] = useState(config?.targetCountry || 'IN');
  const [cfgCurrency, setCfgCurrency] = useState(config?.currency || 'INR');
  const [cfgSymbol, setCfgSymbol] = useState(config?.currencySymbol || '₹');
  const [cfgTaxRate, setCfgTaxRate] = useState(String(config?.taxRatePercent ?? 18));
  const [cfgProvider, setCfgProvider] = useState(config?.activePaymentProvider || 'razorpay_in');
  const [cfgRefund, setCfgRefund] = useState(config?.legalPages.refundPolicy || '');
  const [cfgSaved, setCfgSaved] = useState(false);

  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPct, setNewCouponPct] = useState('15');
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('499');
  const [restoreText, setRestoreText] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    try {
      const booksRes = await apiFetch<{ books: EnrichedBook[] }>('/api/books?includeUnpublished=1');
      setAdminBooks(booksRes.books);

      if (can('users.manage')) {
        const usersRes = await apiFetch<{
          users: AdminUserRow[];
          tickets: SupportTicket[];
          bulkImportJobs: BulkImportJob[];
        }>('/api/admin/users');
        setUsersList(usersRes.users);
        setTickets(usersRes.tickets);
        setBulkJobs(usersRes.bulkImportJobs);
      }

      if (can('audit.view')) {
        const audRes = await apiFetch<{ auditLogs: AuditLogEntry[] }>('/api/admin/audit-logs');
        setAuditLogs(audRes.auditLogs);
      }

      if (can('reports.view')) {
        const qs = new URLSearchParams();
        if (dateFrom) qs.set('from', dateFrom);
        if (dateTo) qs.set('to', dateTo);
        const repRes = await apiFetch<typeof reports>(`/api/admin/reports${qs.toString() ? `?${qs}` : ''}`);
        setReports(repRes);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    }
  }, [can, dateFrom, dateTo]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  if (!user || !can('books.manage')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-700" />
        <h1 className="mt-3 font-display text-2xl font-bold text-slate-900">Admin Access Required</h1>
        <p className="mt-2 text-sm text-slate-600">
          Switch to Admin / Content Manager or Super Admin in the Account menu to access content, user, and system controls.
        </p>
      </div>
    );
  }

  const refreshEverything = async () => {
    await refreshAll();
    await loadAdminData();
  };

  const handleToggleUserStatus = async (u: AdminUserRow) => {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    await apiFetch(`/api/admin/users/${u.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadAdminData();
  };

  const handleResetUserPassword = async (id: string) => {
    await apiFetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword: 'Reset@2026' }),
    });
    await loadAdminData();
  };

  const handleTicketStatus = async (id: string, status: SupportTicket['status']) => {
    await apiFetch(`/api/admin/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadAdminData();
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/config', {
      method: 'PATCH',
      body: JSON.stringify({
        appName: cfgAppName,
        targetCountry: cfgCountry,
        currency: cfgCurrency,
        currencySymbol: cfgSymbol,
        taxRatePercent: Number(cfgTaxRate || 0),
        activePaymentProvider: cfgProvider,
        legalPages: { refundPolicy: cfgRefund },
      }),
    });
    setCfgSaved(true);
    setTimeout(() => setCfgSaved(false), 2000);
    await refreshEverything();
  };

  const handleCreateCoupon = async () => {
    if (!newCouponCode.trim()) return;
    await apiFetch('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify({ code: newCouponCode, discountPercent: Number(newCouponPct || 10) }),
    });
    setNewCouponCode('');
    await refreshEverything();
  };

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) return;
    await apiFetch('/api/admin/plans', {
      method: 'POST',
      body: JSON.stringify({ name: newPlanName, price: Number(newPlanPrice || 499) }),
    });
    setNewPlanName('');
    await refreshEverything();
  };

  const handleDownloadBackup = async () => {
    const data = await apiFetch<Record<string, unknown>>('/api/admin/backup');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vidyakosha-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = async () => {
    try {
      const parsed = JSON.parse(restoreText);
      await apiFetch('/api/admin/restore', { method: 'POST', body: JSON.stringify(parsed) });
      setRestoreStatus('Database snapshot restored successfully.');
      await refreshEverything();
    } catch (err) {
      setRestoreStatus(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  const handleExportCsv = async () => {
    const csv = await apiFetch<string>('/api/admin/reports/export.csv');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vidyakosha-payments-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sidebarTabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: t('admin.dashboard'), icon: LayoutDashboard },
    { id: 'books', label: t('admin.books'), icon: BookMarked },
    { id: 'taxonomies', label: t('admin.taxonomies'), icon: Layers },
    { id: 'users', label: t('admin.users'), icon: Users },
    { id: 'reports', label: t('admin.reports'), icon: BarChart3 },
    ...(can('config.manage') ? [{ id: 'config' as const, label: t('admin.config'), icon: Settings }] : []),
    { id: 'architecture', label: t('admin.architecture'), icon: ShieldAlert },
  ];

  const sym = config?.currencySymbol || '₹';

  const filteredUsers = usersList.filter((u) => {
    if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
      {/* Left Admin Sidebar */}
      <aside className="w-full shrink-0 lg:w-60">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="px-3 py-1.5 text-xs font-semibold text-slate-500">
            {t(`role.${user.role}` as const)}
          </p>
          <nav className="mt-1 flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin sections">
            {sidebarTabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium whitespace-nowrap transition-colors ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="min-w-0 flex-1 space-y-6">
        {tab === 'overview' && reports && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Gross Revenue</p>
                <p className="font-mono-num mt-1 text-2xl font-bold text-slate-900">
                  {sym}
                  {reports.summary.totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Active Subscriptions</p>
                <p className="font-mono-num mt-1 text-2xl font-bold text-slate-900">
                  {reports.summary.activeSubscriptions}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Published Books</p>
                <p className="font-mono-num mt-1 text-2xl font-bold text-slate-900">
                  {reports.summary.publishedBooks} / {adminBooks.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Registered Users</p>
                <p className="font-mono-num mt-1 text-2xl font-bold text-slate-900">
                  {reports.summary.totalUsers}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-base font-semibold text-slate-900">Recent Security &amp; Publishing Audit Trail</h2>
              <div className="mt-3 space-y-2 text-xs">
                {auditLogs.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-mono-num font-semibold text-slate-800">{a.action}</span>
                      <span className="ml-2 text-slate-600">{a.details}</span>
                    </div>
                    <span className="font-mono-num text-slate-500">
                      {a.actorName} · {a.timestamp.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'books' && (
          <AdminBooksSection allBooks={adminBooks} bulkJobs={bulkJobs} onRefresh={refreshEverything} />
        )}

        {tab === 'taxonomies' && <AdminTaxonomiesSection onRefresh={refreshEverything} />}

        {tab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search students, parents, staff..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">All Roles</option>
                <option value="student">Student</option>
                <option value="parent">Parent</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Active Subs</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{u.name}</p>
                        <p className="text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 capitalize">{u.role.replace('_', ' ')}</td>
                      <td className="px-4 py-3 capitalize font-medium">{u.status}</td>
                      <td className="font-mono-num px-4 py-3 text-right">{u.subscriptionsCount}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleResetUserPassword(u.id)}
                            className="rounded border border-slate-300 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
                          >
                            Reset Password
                          </button>
                          {u.role !== 'super_admin' && (
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u)}
                              className="rounded border border-slate-300 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
                            >
                              {u.status === 'active' ? 'Suspend' : 'Restore'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Support Tickets & Content Issues */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Support Requests &amp; Content Issue Reports ({tickets.length})
              </h3>
              <div className="mt-3 space-y-2 text-xs">
                {tickets.map((tk) => (
                  <div key={tk.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="font-semibold text-slate-900">{tk.subject}</p>
                      <p className="text-slate-600">{tk.message}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {tk.userName} {tk.bookTitle ? `· ${tk.bookTitle}` : ''}
                      </p>
                    </div>
                    <select
                      aria-label={`Ticket status for ${tk.subject}`}
                      value={tk.status}
                      onChange={(e) => handleTicketStatus(tk.id, e.target.value as SupportTicket['status'])}
                      className="rounded border border-slate-300 px-2 py-1"
                    >
                      <option value="open">Open</option>
                      <option value="in_review">In Review</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'reports' && reports && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5" />
                <span>to</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5" />
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 font-medium text-white hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Payments CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-display text-base font-semibold text-slate-900">Popular Books (Reads)</h3>
                <div className="mt-3 space-y-2 text-xs">
                  {reports.popularBooks.map((pb) => (
                    <div key={pb.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-medium text-slate-900">{pb.title}</span>
                      <span className="font-mono-num text-slate-600">{pb.readCount} reads</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-display text-base font-semibold text-slate-900">Usage by Content Language &amp; Board</h3>
                <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-slate-600">By Language</p>
                    {Object.entries(reports.usageByLanguage).map(([k, v]) => (
                      <div key={k} className="mt-1 flex justify-between">
                        <span className="uppercase">{k}</span>
                        <span className="font-mono-num">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600">By Board</p>
                    {Object.entries(reports.usageByBoard).map(([k, v]) => (
                      <div key={k} className="mt-1 flex justify-between">
                        <span>{k}</span>
                        <span className="font-mono-num">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono-num px-4 py-3">{p.invoiceNumber}</td>
                      <td className="px-4 py-3">{p.userName}</td>
                      <td className="px-4 py-3">{p.planName}</td>
                      <td className="px-4 py-3">{p.provider}</td>
                      <td className="font-mono-num px-4 py-3 text-right">
                        {sym}
                        {p.totalAmount.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 font-semibold capitalize ${p.status === 'succeeded' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {p.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'config' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveConfig} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Platform Branding, Country Pricing &amp; Payment Provider
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-medium text-slate-700">App Name</label>
                  <input value={cfgAppName} onChange={(e) => setCfgAppName(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block font-medium text-slate-700">Target Country</label>
                  <select value={cfgCountry} onChange={(e) => setCfgCountry(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                    <option value="IN">India (IN)</option>
                    <option value="US">United States (US)</option>
                    <option value="AE">UAE (AE)</option>
                    <option value="GB">United Kingdom (GB)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700">Active Payment Provider</label>
                  <select value={cfgProvider} onChange={(e) => setCfgProvider(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                    {(config?.paymentProviders || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-medium text-slate-700">Currency Code</label>
                  <input value={cfgCurrency} onChange={(e) => setCfgCurrency(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block font-medium text-slate-700">Currency Symbol</label>
                  <input value={cfgSymbol} onChange={(e) => setCfgSymbol(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block font-medium text-slate-700">Tax Rate (%)</label>
                  <input type="number" value={cfgTaxRate} onChange={(e) => setCfgTaxRate(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700">Configurable Refund Policy</label>
                <textarea rows={2} value={cfgRefund} onChange={(e) => setCfgRefund(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="rounded-lg bg-blue-900 px-4 py-2 font-medium text-white">
                {cfgSaved ? 'Configuration Saved!' : 'Save App Configuration'}
              </button>
            </form>

            {/* Plans & Coupons */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 text-xs">
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <h3 className="font-display text-base font-semibold text-slate-900">Create Subscription Plan</h3>
                <div className="flex gap-2">
                  <input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="Plan Name" className="flex-1 rounded border border-slate-300 px-2.5 py-1.5" />
                  <input type="number" value={newPlanPrice} onChange={(e) => setNewPlanPrice(e.target.value)} className="w-24 rounded border border-slate-300 px-2.5 py-1.5" />
                  <button type="button" onClick={handleCreatePlan} className="rounded bg-slate-900 px-3 py-1.5 font-medium text-white">Add</button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <h3 className="font-display text-base font-semibold text-slate-900">Create Discount Coupon</h3>
                <div className="flex gap-2">
                  <input value={newCouponCode} onChange={(e) => setNewCouponCode(e.target.value)} placeholder="Code (FEST25)" className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 uppercase" />
                  <input type="number" value={newCouponPct} onChange={(e) => setNewCouponPct(e.target.value)} className="w-20 rounded border border-slate-300 px-2.5 py-1.5" />
                  <button type="button" onClick={handleCreateCoupon} className="rounded bg-slate-900 px-3 py-1.5 font-medium text-white">Add</button>
                </div>
              </div>
            </div>

            {/* Backup & Restore */}
            {can('backups.manage') && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-slate-900">Data Backup &amp; Restore</h3>
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Full Backup (JSON)</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={restoreText}
                  onChange={(e) => setRestoreText(e.target.value)}
                  placeholder="Paste JSON database snapshot here to restore..."
                  className="font-mono-num w-full rounded-lg border border-slate-300 p-2.5"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleRestoreBackup}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 font-medium text-white"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Restore Snapshot</span>
                  </button>
                  {restoreStatus && <span className="text-slate-700">{restoreStatus}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'architecture' && (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Phase-1 Architecture, Wireframes, MVP Roadmap &amp; Licensing Spec
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Built-in technical blueprint covering Section 11 deliverables.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">1. Database Entities (15 Core Tables)</h3>
                <p className="mt-1.5 leading-relaxed">
                  Users, RolePermissions, AppLanguages, ContentLanguages, Boards, Classes (Nursery–12), Subjects, Books (with EditionGroup links), LicenseRecords, SubscriptionPlans, Coupons, Subscriptions, PaymentTransactions, ReadingProgress, Bookmarks, Annotations (highlights/notes/pen strokes), Notifications, SupportTickets, BulkImportJobs, AuditLogs, AppConfig.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">2. Security &amp; Signed Book Delivery</h3>
                <p className="mt-1.5 leading-relaxed">
                  Book content is never exposed via static public URLs. Access requires `POST /api/books/:id/access-token` returning a 15-minute HMAC-signed token scoped to `userId + bookId + accessLevel`. Payment card details are never stored; only gateway invoice tokens and tax ledgers are persisted.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">3. MVP vs Phase 2</h3>
                <p className="mt-1.5 leading-relaxed">
                  <strong>MVP (Live Now):</strong> Multi-role auth, independent UI &amp; book languages, Nursery–12 catalog, full-screen interactive reader with swipe/keyboard/pen/notes/bookmarks/themes/offline PWA, 1-yr checkout &amp; invoices, Admin licensing &amp; bulk import.<br />
                  <strong>Phase 2:</strong> Live Razorpay/Stripe webhooks, native Android TWA/Capacitor APK wrapper, video/audio interactive lessons, and school bulk seat provisioning.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">4. Screen Wireframes</h3>
                <p className="mt-1.5 leading-relaxed">
                  <strong>Student Panel:</strong> 3-zone header → Hero split → 6-control filter bar → 3-col book cards.<br />
                  <strong>Book Reader:</strong> Top bar (book/language switch, bookmark, offline) → Center page + Canvas overlay → Bottom dock (nav, annotation tools, themes, zoom).<br />
                  <strong>Admin Panel:</strong> 240px sidebar → Tabular KPIs, Licensing-gated Publisher workflow, Reports &amp; CSV export.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
