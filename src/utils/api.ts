import type {
  Annotation,
  AppConfig,
  AppLanguage,
  AuditLogEntry,
  Board,
  Bookmark,
  BookSummary,
  BulkImportJob,
  ClassLevel,
  ContentLanguage,
  Coupon,
  NotificationItem,
  PaymentTransaction,
  Permission,
  ReadingProgress,
  RoleId,
  SafeUser,
  Subject,
  Subscription,
  SubscriptionPlan,
  SupportTicket,
} from '../shared/types';
import type { BookAccessResult } from '../shared/domainLogic';
import { handleNativeLocalApi } from './nativeLocalApi';

const TOKEN_KEY = 'vidyakosha_auth_token';
const UI_LANG_KEY = 'vidyakosha_ui_lang';
const OFFLINE_BOOKS_KEY = 'vidyakosha_offline_books_v1';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage quota errors
  }
}

export function getStoredUiLang(): string | null {
  try {
    return localStorage.getItem(UI_LANG_KEY);
  } catch {
    return null;
  }
}

export function setStoredUiLang(lang: string): void {
  try {
    localStorage.setItem(UI_LANG_KEY, lang);
  } catch {
    // ignore
  }
}

export interface OfflineBookBundle {
  book: EnrichedBook;
  pages: {
    pageNumber: number;
    chapterTitle: string;
    heading: string;
    body: string;
    keyPoints?: string[];
    diagramLabel?: string;
  }[];
  savedAt: string;
}

export function getOfflineBooks(): Record<string, OfflineBookBundle> {
  try {
    const raw = localStorage.getItem(OFFLINE_BOOKS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OfflineBookBundle>) : {};
  } catch {
    return {};
  }
}

export function saveOfflineBook(bundle: OfflineBookBundle): Record<string, OfflineBookBundle> {
  const current = getOfflineBooks();
  current[bundle.book.id] = bundle;
  try {
    localStorage.setItem(OFFLINE_BOOKS_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
  return current;
}

export function removeOfflineBook(bookId: string): Record<string, OfflineBookBundle> {
  const current = getOfflineBooks();
  delete current[bookId];
  try {
    localStorage.setItem(OFFLINE_BOOKS_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
  return current;
}

export interface LinkedEditionRef {
  bookId: string;
  contentLanguageCode: string;
  title: string;
  editionLabel: string;
}

export interface EnrichedBook extends BookSummary {
  linkedEditions: LinkedEditionRef[];
  access: BookAccessResult;
}

export interface BootstrapResponse {
  config: AppConfig;
  uiLanguages: AppLanguage[];
  contentLanguages: ContentLanguage[];
  boards: Board[];
  classes: ClassLevel[];
  subjects: Subject[];
  plans: SubscriptionPlan[];
  rolePermissions: Record<RoleId, Permission[]>;
  user: SafeUser | null;
  subscriptions: Subscription[];
  readingProgress: ReadingProgress[];
  notifications: NotificationItem[];
}

const API_BASE = (
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL) ||
  ''
).replace(/\/$/, '');

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  if (!API_BASE && isCapacitorNative() && url.startsWith('/api/')) {
    return handleNativeLocalApi<T>(url, options, token);
  }

  const targetUrl = API_BASE && url.startsWith('/') ? `${API_BASE}${url}` : url;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(targetUrl, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data?.error) msg = data.error;
    }
    throw new Error(msg);
  }
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export type {
  Annotation,
  AuditLogEntry,
  Bookmark,
  BulkImportJob,
  Coupon,
  PaymentTransaction,
  SupportTicket,
};
