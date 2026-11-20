import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { translate, type TranslationKey } from '../shared/i18n';
import type {
  AppConfig,
  AppLanguage,
  Board,
  ClassLevel,
  ContentLanguage,
  NotificationItem,
  Permission,
  ReadingProgress,
  RoleId,
  SafeUser,
  Subject,
  Subscription,
  SubscriptionPlan,
} from '../shared/types';
import { hasPermission } from '../shared/domainLogic';
import {
  apiFetch,
  type BootstrapResponse,
  type EnrichedBook,
  getOfflineBooks,
  getStoredToken,
  getStoredUiLang,
  type OfflineBookBundle,
  removeOfflineBook,
  saveOfflineBook,
  setStoredToken,
  setStoredUiLang,
} from '../utils/api';

export type ActiveTab =
  | 'library'
  | 'my_learning'
  | 'plans'
  | 'resources'
  | 'help'
  | 'parent'
  | 'teacher'
  | 'admin';

interface AppContextValue {
  loading: boolean;
  error: string | null;
  config: AppConfig | null;
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
  books: EnrichedBook[];
  offlineBooks: Record<string, OfflineBookBundle>;
  uiLang: string;
  activeTab: ActiveTab;
  showOnboarding: boolean;
  showAuthModal: boolean;
  readerBook: EnrichedBook | null;
  readerStartAudio: boolean;
  checkoutTarget: { plan?: SubscriptionPlan; book?: EnrichedBook } | null;
  setActiveTab: (tab: ActiveTab) => void;
  setShowOnboarding: (v: boolean) => void;
  setShowAuthModal: (v: boolean) => void;
  setUiLanguage: (langCode: string) => Promise<void>;
  t: (key: TranslationKey) => string;
  can: (perm: Permission) => boolean;
  refreshAll: () => Promise<void>;
  refreshBooks: (filters?: Record<string, string>) => Promise<void>;
  openReader: (book: EnrichedBook, options?: { startAudio?: boolean }) => void;
  closeReader: () => void;
  openCheckout: (target: { plan?: SubscriptionPlan; book?: EnrichedBook }) => void;
  closeCheckout: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Record<string, string>) => Promise<void>;
  demoSwitchRole: (role: RoleId) => Promise<void>;
  logout: () => void;
  toggleFavorite: (bookId: string) => Promise<void>;
  saveBookOffline: (bundle: OfflineBookBundle) => void;
  deleteBookOffline: (bookId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [books, setBooks] = useState<EnrichedBook[]>([]);
  const [offlineBooks, setOfflineBooks] = useState<Record<string, OfflineBookBundle>>(() => getOfflineBooks());
  const [uiLang, setUiLangState] = useState<string>(() => getStoredUiLang() || 'hi');
  const [activeTab, setActiveTab] = useState<ActiveTab>('library');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return false;
    return !getStoredUiLang();
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [readerBook, setReaderBook] = useState<EnrichedBook | null>(null);
  const [readerStartAudio, setReaderStartAudio] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<{ plan?: SubscriptionPlan; book?: EnrichedBook } | null>(null);

  const refreshBooks = useCallback(async (filters?: Record<string, string>) => {
    try {
      const qs = new URLSearchParams(filters || {}).toString();
      const res = await apiFetch<{ books: EnrichedBook[] }>(`/api/books${qs ? `?${qs}` : ''}`);
      setBooks(res.books);
    } catch (err) {
      console.error('Failed to load books:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<BootstrapResponse>('/api/bootstrap');
      setBootstrap(data);
      const storedLang = getStoredUiLang();
      if (data.user?.uiLanguageCode && !storedLang) {
        setUiLangState(data.user.uiLanguageCode);
      } else if (!storedLang && data.config.defaultUiLanguage) {
        setUiLangState(data.config.defaultUiLanguage);
      }
      await refreshBooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load platform data.');
    } finally {
      setLoading(false);
    }
  }, [refreshBooks]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const setUiLanguage = useCallback(
    async (langCode: string) => {
      setUiLangState(langCode);
      setStoredUiLang(langCode);
      if (bootstrap?.user && getStoredToken()) {
        try {
          await apiFetch('/api/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({ uiLanguageCode: langCode }),
          });
        } catch {
          // non-blocking
        }
      }
    },
    [bootstrap?.user]
  );

  const t = useCallback(
    (key: TranslationKey) => translate(uiLang, key, bootstrap?.config.customTranslations),
    [uiLang, bootstrap?.config.customTranslations]
  );

  const can = useCallback(
    (perm: Permission) => {
      if (!bootstrap?.user) return false;
      return hasPermission(bootstrap.user.role, bootstrap.rolePermissions, perm);
    },
    [bootstrap]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ token: string; user: SafeUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(res.token);
      setShowAuthModal(false);
      await refreshAll();
    },
    [refreshAll]
  );

  const register = useCallback(
    async (payload: Record<string, string>) => {
      const res = await apiFetch<{ token: string; user: SafeUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...payload, uiLanguageCode: uiLang }),
      });
      setStoredToken(res.token);
      setShowAuthModal(false);
      await refreshAll();
    },
    [refreshAll, uiLang]
  );

  const demoSwitchRole = useCallback(
    async (role: RoleId) => {
      const res = await apiFetch<{ token: string; user: SafeUser }>('/api/auth/demo-switch', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      setStoredToken(res.token);
      setShowAuthModal(false);
      await refreshAll();
      if (role === 'admin' || role === 'super_admin') setActiveTab('admin');
      else if (role === 'parent') setActiveTab('parent');
      else if (role === 'teacher') setActiveTab('teacher');
      else setActiveTab('library');
    },
    [refreshAll]
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setActiveTab('library');
    refreshAll();
  }, [refreshAll]);

  const toggleFavorite = useCallback(
    async (bookId: string) => {
      if (!bootstrap?.user) {
        setShowAuthModal(true);
        return;
      }
      await apiFetch('/api/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ bookId }),
      });
      await refreshAll();
    },
    [bootstrap?.user, refreshAll]
  );

  const saveBookOffline = useCallback((bundle: OfflineBookBundle) => {
    setOfflineBooks(saveOfflineBook(bundle));
  }, []);

  const deleteBookOffline = useCallback((bookId: string) => {
    setOfflineBooks(removeOfflineBook(bookId));
  }, []);

  return (
    <AppContext.Provider
      value={{
        loading,
        error,
        config: bootstrap?.config || null,
        uiLanguages: bootstrap?.uiLanguages || [],
        contentLanguages: bootstrap?.contentLanguages || [],
        boards: bootstrap?.boards || [],
        classes: bootstrap?.classes || [],
        subjects: bootstrap?.subjects || [],
        plans: bootstrap?.plans || [],
        rolePermissions: bootstrap?.rolePermissions || {
          super_admin: [],
          admin: [],
          student: [],
          parent: [],
          teacher: [],
        },
        user: bootstrap?.user || null,
        subscriptions: bootstrap?.subscriptions || [],
        readingProgress: bootstrap?.readingProgress || [],
        notifications: bootstrap?.notifications || [],
        books,
        offlineBooks,
        uiLang,
        activeTab,
        showOnboarding,
        showAuthModal,
        readerBook,
        readerStartAudio,
        checkoutTarget,
        setActiveTab,
        setShowOnboarding,
        setShowAuthModal,
        setUiLanguage,
        t,
        can,
        refreshAll,
        refreshBooks,
        openReader: (b, options) => {
          setReaderStartAudio(Boolean(options?.startAudio));
          setReaderBook(b);
        },
        closeReader: () => {
          setReaderBook(null);
          setReaderStartAudio(false);
          refreshAll();
        },
        openCheckout: (target) => {
          if (!bootstrap?.user) {
            setShowAuthModal(true);
            return;
          }
          setCheckoutTarget(target);
        },
        closeCheckout: () => {
          setCheckoutTarget(null);
          refreshAll();
        },
        login,
        register,
        demoSwitchRole,
        logout,
        toggleFavorite,
        saveBookOffline,
        deleteBookOffline,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
