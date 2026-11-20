import {
  calculateCheckoutTotals,
  canPublishBook,
  checkBookAccess,
  filterBooksCatalog,
  hasPermission,
} from '../shared/domainLogic';
import {
  SEED_ANNOTATIONS,
  SEED_AUDIT_LOGS,
  SEED_BOARDS,
  SEED_BOOKMARKS,
  SEED_BOOKS,
  SEED_BULK_IMPORT_JOBS,
  SEED_CLASSES,
  SEED_CONFIG,
  SEED_CONTENT_LANGUAGES,
  SEED_COUPONS,
  SEED_NOTIFICATIONS,
  SEED_PAYMENTS,
  SEED_PLANS,
  SEED_READING_PROGRESS,
  SEED_ROLE_PERMISSIONS,
  SEED_SAFE_USERS,
  SEED_SUBJECTS,
  SEED_SUBSCRIPTIONS,
  SEED_TICKETS,
  SEED_UI_LANGUAGES,
} from '../shared/seedCatalog';
import type {
  Annotation,
  AppConfig,
  AppLanguage,
  AuditLogEntry,
  Board,
  Book,
  BookSummary,
  Bookmark,
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

const NATIVE_DB_KEY = 'vidyakosha_native_local_db_v1';

interface LocalUserRecord extends SafeUser {
  localSecret?: string;
}

interface NativeDb {
  users: LocalUserRecord[];
  rolePermissions: Record<RoleId, Permission[]>;
  uiLanguages: AppLanguage[];
  contentLanguages: ContentLanguage[];
  boards: Board[];
  classes: ClassLevel[];
  subjects: Subject[];
  books: Book[];
  plans: SubscriptionPlan[];
  coupons: Coupon[];
  subscriptions: Subscription[];
  payments: PaymentTransaction[];
  readingProgress: ReadingProgress[];
  bookmarks: Bookmark[];
  annotations: Annotation[];
  notifications: NotificationItem[];
  tickets: SupportTicket[];
  auditLogs: AuditLogEntry[];
  bulkImportJobs: BulkImportJob[];
  config: AppConfig;
}

const DEFAULT_DEMO_LOGIN_PASSWORDS: Record<string, string> = {
  'superadmin@vidyakosha.edu': 'Admin@123',
  'content@vidyakosha.edu': 'Manager@123',
  'aarav@student.vidyakosha.edu': 'Student@123',
  'parent@vidyakosha.edu': 'Parent@123',
  'teacher@vidyakosha.edu': 'Teacher@123',
};

let memoryFallbackStore: NativeDb | null = null;
const nativePdfBlobs = new Map<string, Uint8Array>();

export function storeNativePdfBytes(fileId: string, bytes: Uint8Array): void {
  nativePdfBlobs.set(fileId, bytes);
}

export function getNativePdfBytes(fileId?: string): Uint8Array | null {
  if (!fileId) return null;
  return nativePdfBlobs.get(fileId) || null;
}

function uid(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

function createInitialNativeDb(): NativeDb {
  return {
    users: structuredClone(SEED_SAFE_USERS),
    rolePermissions: structuredClone(SEED_ROLE_PERMISSIONS),
    uiLanguages: structuredClone(SEED_UI_LANGUAGES),
    contentLanguages: structuredClone(SEED_CONTENT_LANGUAGES),
    boards: structuredClone(SEED_BOARDS),
    classes: structuredClone(SEED_CLASSES),
    subjects: structuredClone(SEED_SUBJECTS),
    books: structuredClone(SEED_BOOKS),
    plans: structuredClone(SEED_PLANS),
    coupons: structuredClone(SEED_COUPONS),
    subscriptions: structuredClone(SEED_SUBSCRIPTIONS),
    payments: structuredClone(SEED_PAYMENTS),
    readingProgress: structuredClone(SEED_READING_PROGRESS),
    bookmarks: structuredClone(SEED_BOOKMARKS),
    annotations: structuredClone(SEED_ANNOTATIONS),
    notifications: structuredClone(SEED_NOTIFICATIONS),
    tickets: structuredClone(SEED_TICKETS),
    auditLogs: structuredClone(SEED_AUDIT_LOGS),
    bulkImportJobs: structuredClone(SEED_BULK_IMPORT_JOBS),
    config: structuredClone(SEED_CONFIG),
  };
}

function loadNativeDb(): NativeDb {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(NATIVE_DB_KEY);
      if (raw) {
        return JSON.parse(raw) as NativeDb;
      }
      const seed = createInitialNativeDb();
      localStorage.setItem(NATIVE_DB_KEY, JSON.stringify(seed));
      return seed;
    }
  } catch {
    // Fallback to in-memory store
  }
  if (!memoryFallbackStore) {
    memoryFallbackStore = createInitialNativeDb();
  }
  return memoryFallbackStore;
}

function saveNativeDb(db: NativeDb): void {
  memoryFallbackStore = db;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NATIVE_DB_KEY, JSON.stringify(db));
    }
  } catch {
    // ignore storage quota errors
  }
}

export function resetNativeLocalDb(): void {
  memoryFallbackStore = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(NATIVE_DB_KEY);
    }
  } catch {
    // ignore
  }
}

function toSafeUser(user: LocalUserRecord): SafeUser {
  const { localSecret: _s, ...safe } = user;
  return safe;
}

function summarizeBook(book: Book): BookSummary {
  const { pages, ...rest } = book;
  return { ...rest, pageCount: pages.length };
}

function appendAudit(
  db: NativeDb,
  actor: { id: string; name: string; role: RoleId },
  action: string,
  targetType: string,
  targetId: string,
  details: string
): void {
  db.auditLogs.unshift({
    id: uid('aud'),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    targetType,
    targetId,
    details,
    timestamp: new Date().toISOString(),
  });
}

function parseJsonBody(body?: BodyInit | null): Record<string, unknown> {
  if (!body || typeof body !== 'string') return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function resolveTokenUser(db: NativeDb, token: string | null): LocalUserRecord | null {
  if (!token) return null;
  if (token.startsWith('native:')) {
    const userId = token.slice('native:'.length);
    return db.users.find((u) => u.id === userId && u.status === 'active') || null;
  }
  return null;
}

export async function handleNativeLocalApi<T>(
  rawUrl: string,
  options: RequestInit = {},
  token: string | null = null
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const parsedUrl = new URL(rawUrl, 'https://vidyakosha.local');
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.searchParams;
  const body = parseJsonBody(options.body);
  const db = loadNativeDb();
  const authUser = resolveTokenUser(db, token);

  const requireAuthUser = (): LocalUserRecord => {
    if (!authUser) throw new Error('Authentication required.');
    return authUser;
  };

  const requirePermission = (perm: Permission): LocalUserRecord => {
    const user = requireAuthUser();
    if (!hasPermission(user.role, db.rolePermissions, perm)) {
      throw new Error(`Missing required permission: ${perm}`);
    }
    return user;
  };

  if (method === 'GET' && pathname === '/api/health') {
    return { ok: true, mode: 'native-offline' } as T;
  }

  if (method === 'GET' && pathname === '/api/bootstrap') {
    const safeUser = authUser ? toSafeUser(authUser) : null;
    const subscriptions = safeUser ? db.subscriptions.filter((s) => s.userId === safeUser.id) : [];
    const readingProgress = safeUser ? db.readingProgress.filter((p) => p.userId === safeUser.id) : [];
    const notifications = safeUser
      ? db.notifications.filter((n) => !n.userId || n.userId === safeUser.id || n.roleTarget === safeUser.role)
      : db.notifications.filter((n) => !n.userId && !n.roleTarget);
    return {
      config: db.config,
      uiLanguages: db.uiLanguages,
      contentLanguages: db.contentLanguages,
      boards: db.boards,
      classes: db.classes,
      subjects: db.subjects,
      plans: db.plans.filter((p) => p.active),
      rolePermissions: db.rolePermissions,
      user: safeUser,
      subscriptions,
      readingProgress,
      notifications,
    } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/demo-switch') {
    const role = String(body.role || '');
    const targetUser = db.users.find((u) => u.role === role && u.status === 'active');
    if (!targetUser) throw new Error('Demo user for role not found.');
    targetUser.lastLoginAt = new Date().toISOString();
    appendAudit(db, targetUser, 'DEMO_ROLE_SWITCH', 'user', targetUser.id, `Switched workspace to ${role}`);
    saveNativeDb(db);
    return { token: `native:${targetUser.id}`, user: toSafeUser(targetUser) } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    const valid =
      user &&
      ((user.localSecret && user.localSecret === password) ||
        DEFAULT_DEMO_LOGIN_PASSWORDS[email] === password);
    if (!user || !valid) throw new Error('Invalid email or password.');
    if (user.status === 'suspended') throw new Error('Account is suspended. Contact administrator.');
    user.lastLoginAt = new Date().toISOString();
    saveNativeDb(db);
    return { token: `native:${user.id}`, user: toSafeUser(user) } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/register') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (name.length < 2) throw new Error('Valid full name is required.');
    if (!email.includes('@')) throw new Error('Valid email address is required.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error('An account with this email already exists.');
    }
    const allowedRoles: RoleId[] = ['student', 'parent', 'teacher'];
    const targetRole: RoleId = allowedRoles.includes(body.role as RoleId) ? (body.role as RoleId) : 'student';
    const newUser: LocalUserRecord = {
      id: uid('u'),
      name,
      email,
      localSecret: password,
      role: targetRole,
      status: 'active',
      uiLanguageCode: String(body.uiLanguageCode || db.config.defaultUiLanguage || 'hi'),
      preferredContentLanguageCode: String(body.preferredContentLanguageCode || 'hi'),
      classId: String(body.classId || 'cls-10'),
      boardId: String(body.boardId || 'brd-cbse'),
      favoriteBookIds: [],
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    appendAudit(db, newUser, 'USER_REGISTERED', 'user', newUser.id, `Registered as ${targetRole}`);
    saveNativeDb(db);
    return { token: `native:${newUser.id}`, user: toSafeUser(newUser) } as T;
  }

  if (method === 'PATCH' && pathname === '/api/auth/profile') {
    const user = requireAuthUser();
    if (typeof body.name === 'string' && body.name.trim().length >= 2) user.name = body.name.trim();
    if (typeof body.uiLanguageCode === 'string') user.uiLanguageCode = body.uiLanguageCode;
    if (typeof body.preferredContentLanguageCode === 'string') {
      user.preferredContentLanguageCode = body.preferredContentLanguageCode;
    }
    if (typeof body.classId === 'string') user.classId = body.classId;
    if (typeof body.boardId === 'string') user.boardId = body.boardId;
    saveNativeDb(db);
    return { user: toSafeUser(user) } as T;
  }

  if (method === 'GET' && pathname === '/api/auth/export-data') {
    const user = requireAuthUser();
    return {
      exportedAt: new Date().toISOString(),
      profile: toSafeUser(user),
      subscriptions: db.subscriptions.filter((s) => s.userId === user.id),
      payments: db.payments.filter((p) => p.userId === user.id),
      readingProgress: db.readingProgress.filter((p) => p.userId === user.id),
      bookmarks: db.bookmarks.filter((b) => b.userId === user.id),
      annotations: db.annotations.filter((a) => a.userId === user.id),
      tickets: db.tickets.filter((t) => t.userId === user.id),
    } as T;
  }

  if (method === 'DELETE' && pathname === '/api/auth/account') {
    const user = requireAuthUser();
    if (user.role === 'super_admin') throw new Error('Super Admin account cannot be self-deleted.');
    db.users = db.users.filter((u) => u.id !== user.id);
    db.bookmarks = db.bookmarks.filter((b) => b.userId !== user.id);
    db.annotations = db.annotations.filter((a) => a.userId !== user.id);
    db.readingProgress = db.readingProgress.filter((p) => p.userId !== user.id);
    saveNativeDb(db);
    return { deleted: true } as T;
  }

  if (method === 'GET' && pathname === '/api/books') {
    const includeUnpublished =
      query.get('includeUnpublished') === '1' &&
      Boolean(authUser && hasPermission(authUser.role, db.rolePermissions, 'books.manage'));
    const filtered = filterBooksCatalog(db.books, {
      classId: query.get('classId') || undefined,
      boardId: query.get('boardId') || undefined,
      subjectId: query.get('subjectId') || undefined,
      contentLanguageCode: query.get('contentLanguageCode') || undefined,
      academicYear: query.get('academicYear') || undefined,
      search: query.get('search') || undefined,
      onlyFree: query.get('onlyFree') === '1',
      includeUnpublished,
    });
    const safeUser = authUser ? toSafeUser(authUser) : null;
    const enriched = filtered.map((book) => ({
      ...summarizeBook(book),
      linkedEditions: db.books
        .filter((other) => other.editionGroupId === book.editionGroupId && (includeUnpublished || other.status === 'published'))
        .map((other) => ({
          bookId: other.id,
          contentLanguageCode: other.contentLanguageCode,
          title: other.title,
          editionLabel: other.editionLabel,
        })),
      access: checkBookAccess(safeUser, book, db.subscriptions),
    }));
    return { books: enriched } as T;
  }

  const bookDetailMatch = pathname.match(/^\/api\/books\/([^/]+)$/);
  if (method === 'GET' && bookDetailMatch) {
    const book = db.books.find((b) => b.id === bookDetailMatch[1]);
    if (!book) throw new Error('Book not found.');
    const isAdmin = Boolean(authUser && hasPermission(authUser.role, db.rolePermissions, 'books.manage'));
    if (book.status !== 'published' && !isAdmin) throw new Error('Book not available.');
    const linkedEditions = db.books
      .filter((b) => b.editionGroupId === book.editionGroupId && (isAdmin || b.status === 'published'))
      .map((b) => ({
        bookId: b.id,
        contentLanguageCode: b.contentLanguageCode,
        title: b.title,
        editionLabel: b.editionLabel,
      }));
    const access = checkBookAccess(authUser ? toSafeUser(authUser) : null, book, db.subscriptions);
    return { book: summarizeBook(book), linkedEditions, access } as T;
  }

  const accessTokenMatch = pathname.match(/^\/api\/books\/([^/]+)\/access-token$/);
  if (method === 'POST' && accessTokenMatch) {
    const book = db.books.find((b) => b.id === accessTokenMatch[1]);
    if (!book) throw new Error('Book not found.');
    const access = checkBookAccess(authUser ? toSafeUser(authUser) : null, book, db.subscriptions);
    return {
      accessToken: `native-book:${book.id}:${access.accessLevel}:${access.allowedPages}`,
      expiresInSeconds: 900,
      access,
    } as T;
  }

  const contentMatch = pathname.match(/^\/api\/books\/([^/]+)\/content$/);
  if (method === 'GET' && contentMatch) {
    const book = db.books.find((b) => b.id === contentMatch[1]);
    if (!book) throw new Error('Book not found.');
    const access = checkBookAccess(authUser ? toSafeUser(authUser) : null, book, db.subscriptions);
    book.readCount += 1;
    saveNativeDb(db);
    const pages =
      access.accessLevel === 'full' ? book.pages : book.pages.slice(0, Math.max(1, access.allowedPages));
    const hasPdf = Boolean(book.pdfFileId && nativePdfBlobs.has(book.pdfFileId));
    return {
      bookId: book.id,
      accessLevel: access.accessLevel,
      totalPages: book.totalPages,
      allowedPages: pages.length,
      pages,
      hasPdf,
      pdfUrl: hasPdf ? `native-pdf://${book.pdfFileId}` : undefined,
      licensePermissions: {
        allowOfflineDownload: access.accessLevel === 'full' && book.license.allowOfflineDownload,
        allowPrinting: access.accessLevel === 'full' && book.license.allowPrinting,
      },
    } as T;
  }

  const readerStateMatch = pathname.match(/^\/api\/reader\/state\/([^/]+)$/);
  if (method === 'GET' && readerStateMatch) {
    const user = requireAuthUser();
    const bookId = readerStateMatch[1];
    return {
      progress: db.readingProgress.find((p) => p.userId === user.id && p.bookId === bookId) || null,
      bookmarks: db.bookmarks.filter((b) => b.userId === user.id && b.bookId === bookId),
      annotations: db.annotations.filter((a) => a.userId === user.id && a.bookId === bookId),
    } as T;
  }

  if (method === 'GET' && pathname === '/api/learning/overview') {
    const user = requireAuthUser();
    return {
      progress: db.readingProgress.filter((p) => p.userId === user.id),
      bookmarks: db.bookmarks.filter((b) => b.userId === user.id),
      annotations: db.annotations.filter((a) => a.userId === user.id),
      subscriptions: db.subscriptions.filter((s) => s.userId === user.id),
      payments: db.payments.filter((p) => p.userId === user.id),
      tickets: db.tickets.filter((t) => t.userId === user.id),
    } as T;
  }

  if (method === 'PUT' && pathname === '/api/reader/progress') {
    const user = requireAuthUser();
    const bookId = String(body.bookId || '');
    const book = db.books.find((b) => b.id === bookId);
    if (!book) throw new Error('Book not found.');
    const clampedPage = Math.max(1, Math.min(book.totalPages, Number(body.lastPage) || 1));
    const percentComplete = Math.round((clampedPage / Math.max(1, book.totalPages)) * 100);
    const nextItem: ReadingProgress = {
      userId: user.id,
      bookId,
      editionGroupId: book.editionGroupId,
      lastPage: clampedPage,
      totalPages: book.totalPages,
      percentComplete,
      updatedAt: new Date().toISOString(),
    };
    const idx = db.readingProgress.findIndex((p) => p.userId === user.id && p.bookId === bookId);
    if (idx >= 0) db.readingProgress[idx] = nextItem;
    else db.readingProgress.unshift(nextItem);
    saveNativeDb(db);
    return { progress: nextItem } as T;
  }

  if (method === 'POST' && pathname === '/api/reader/bookmarks') {
    const user = requireAuthUser();
    const bookId = String(body.bookId || '');
    const pageNumber = Number(body.pageNumber || 1);
    const existing = db.bookmarks.find((b) => b.userId === user.id && b.bookId === bookId && b.pageNumber === pageNumber);
    if (existing) return { bookmark: existing } as T;
    const bm: Bookmark = {
      id: uid('bm'),
      userId: user.id,
      bookId,
      pageNumber,
      chapterTitle: String(body.chapterTitle || `Page ${pageNumber}`),
      label: String(body.label || `Page ${pageNumber}`),
      createdAt: new Date().toISOString(),
    };
    db.bookmarks.unshift(bm);
    saveNativeDb(db);
    return { bookmark: bm } as T;
  }

  const bookmarkDeleteMatch = pathname.match(/^\/api\/reader\/bookmarks\/([^/]+)$/);
  if (method === 'DELETE' && bookmarkDeleteMatch) {
    const user = requireAuthUser();
    db.bookmarks = db.bookmarks.filter((b) => !(b.id === bookmarkDeleteMatch[1] && b.userId === user.id));
    saveNativeDb(db);
    return { deleted: true } as T;
  }

  if (method === 'POST' && pathname === '/api/reader/annotations') {
    const user = requireAuthUser();
    const bookId = String(body.bookId || '');
    const pageNumber = Number(body.pageNumber || 1);
    const type = body.type as Annotation['type'];
    const now = new Date().toISOString();
    if (type === 'pen') {
      db.annotations = db.annotations.filter(
        (a) => !(a.userId === user.id && a.bookId === bookId && a.pageNumber === pageNumber && a.type === 'pen')
      );
      if (!Array.isArray(body.strokes) || body.strokes.length === 0) {
        saveNativeDb(db);
        return { annotation: null, cleared: true } as T;
      }
    }
    const ann: Annotation = {
      id: uid('ann'),
      userId: user.id,
      bookId,
      pageNumber,
      type,
      color: String(body.color || '#FEF08A'),
      textSelection: body.textSelection ? String(body.textSelection) : undefined,
      noteText: body.noteText ? String(body.noteText) : undefined,
      strokes: Array.isArray(body.strokes) ? body.strokes : undefined,
      createdAt: now,
      updatedAt: now,
    };
    db.annotations.unshift(ann);
    saveNativeDb(db);
    return { annotation: ann } as T;
  }

  const annotationDeleteMatch = pathname.match(/^\/api\/reader\/annotations\/([^/]+)$/);
  if (method === 'DELETE' && annotationDeleteMatch) {
    const user = requireAuthUser();
    db.annotations = db.annotations.filter((a) => !(a.id === annotationDeleteMatch[1] && a.userId === user.id));
    saveNativeDb(db);
    return { deleted: true } as T;
  }

  if (method === 'POST' && pathname === '/api/favorites/toggle') {
    const user = requireAuthUser();
    const bookId = String(body.bookId || '');
    const idx = user.favoriteBookIds.indexOf(bookId);
    if (idx >= 0) user.favoriteBookIds.splice(idx, 1);
    else user.favoriteBookIds.push(bookId);
    saveNativeDb(db);
    return { favoriteBookIds: user.favoriteBookIds } as T;
  }

  if (method === 'POST' && pathname === '/api/checkout/preview') {
    requireAuthUser();
    const plan = body.planId ? db.plans.find((p) => p.id === body.planId && p.active) : undefined;
    const book = !plan && body.bookId ? db.books.find((b) => b.id === body.bookId && b.status === 'published') : undefined;
    if (!plan && !book) throw new Error('Plan or book not found.');
    const basePrice = plan ? plan.price : book!.price;
    const taxRate = plan ? plan.taxRatePercent : db.config.taxRatePercent;
    const itemTitle = plan ? plan.name : `${book!.title} (1-Year Access)`;
    const coupon = body.couponCode
      ? db.coupons.find((c) => c.code.toUpperCase() === String(body.couponCode).trim().toUpperCase())
      : null;
    if (body.couponCode && !coupon) {
      return { ...calculateCheckoutTotals(basePrice, null, taxRate), itemTitle, couponError: 'COUPON_NOT_FOUND' } as T;
    }
    return { ...calculateCheckoutTotals(basePrice, coupon || null, taxRate), itemTitle } as T;
  }

  if (method === 'POST' && pathname === '/api/checkout/pay') {
    const user = requireAuthUser();
    const plan = body.planId ? db.plans.find((p) => p.id === body.planId && p.active) : undefined;
    const book = !plan && body.bookId ? db.books.find((b) => b.id === body.bookId && b.status === 'published') : undefined;
    if (!plan && !book) throw new Error('Plan or book not found.');
    const basePrice = plan ? plan.price : book!.price;
    const taxRate = plan ? plan.taxRatePercent : db.config.taxRatePercent;
    const coupon = body.couponCode
      ? db.coupons.find((c) => c.code.toUpperCase() === String(body.couponCode).trim().toUpperCase())
      : null;
    const totals = calculateCheckoutTotals(basePrice, coupon || null, taxRate);
    const now = new Date();
    const paymentId = uid('pay');
    const invoiceNumber = `INV-2026-${String(db.payments.length + 1).padStart(4, '0')}`;
    const planName = plan ? plan.name : `${book!.title} (1-Year License)`;
    const resolvedPlanId = plan ? plan.id : `book-plan-${book!.id}`;
    const provider =
      db.config.paymentProviders.find((p) => p.id === (body.providerId || db.config.activePaymentProvider))?.name ||
      db.config.activePaymentProvider;

    if (body.simulateFailure) {
      const failedTx: PaymentTransaction = {
        id: paymentId,
        invoiceNumber,
        userId: user.id,
        userName: user.name,
        planId: resolvedPlanId,
        planName,
        provider,
        countryCode: db.config.targetCountry,
        ...totals,
        currency: db.config.currency,
        couponCode: totals.couponApplied ? coupon?.code : undefined,
        status: 'failed',
        failureReason: 'Simulated gateway decline for testing failure handling.',
        createdAt: now.toISOString(),
      };
      db.payments.unshift(failedTx);
      saveNativeDb(db);
      throw new Error(failedTx.failureReason);
    }

    const tx: PaymentTransaction = {
      id: paymentId,
      invoiceNumber,
      userId: user.id,
      userName: user.name,
      planId: resolvedPlanId,
      planName,
      provider,
      countryCode: db.config.targetCountry,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      currency: db.config.currency,
      couponCode: totals.couponApplied ? coupon?.code : undefined,
      status: 'succeeded',
      createdAt: now.toISOString(),
    };
    db.payments.unshift(tx);
    const expires = new Date(now.getTime() + 365 * 86400000);
    const subscription: Subscription = {
      id: uid('sub'),
      userId: user.id,
      planId: resolvedPlanId,
      planName,
      scopeType: plan ? plan.scopeType : 'book',
      boardId: plan?.boardId,
      classId: plan?.classId,
      subjectId: plan?.subjectId,
      bookId: book?.id,
      status: 'active',
      startsAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      autoRenew: true,
      paymentId,
    };
    db.subscriptions.unshift(subscription);
    saveNativeDb(db);
    return { transaction: tx, subscription } as T;
  }

  if (method === 'POST' && pathname === '/api/support/tickets') {
    const user = requireAuthUser();
    const ticket: SupportTicket = {
      id: uid('tkt'),
      userId: user.id,
      userName: user.name,
      type: (['support', 'content_issue', 'feedback'].includes(String(body.type))
        ? body.type
        : 'support') as SupportTicket['type'],
      bookId: body.bookId ? String(body.bookId) : undefined,
      subject: String(body.subject || ''),
      message: String(body.message || ''),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    db.tickets.unshift(ticket);
    saveNativeDb(db);
    return { ticket } as T;
  }

  if (method === 'POST' && pathname === '/api/notifications/read') {
    const user = requireAuthUser();
    db.notifications.forEach((n) => {
      if (!n.userId || n.userId === user.id || n.roleTarget === user.role) n.read = true;
    });
    saveNativeDb(db);
    return { ok: true } as T;
  }

  if (method === 'GET' && pathname === '/api/parent/overview') {
    const user = requirePermission('parent.monitor');
    const childId = user.linkedChildId || 'u-stu-1';
    const child = db.users.find((u) => u.id === childId);
    return {
      child: child ? toSafeUser(child) : null,
      progress: db.readingProgress.filter((p) => p.userId === childId),
      subscriptions: db.subscriptions.filter((s) => s.userId === childId),
      bookmarks: db.bookmarks.filter((b) => b.userId === childId),
      books: db.books.filter((b) => b.status === 'published').map(summarizeBook),
    } as T;
  }

  if (method === 'GET' && pathname === '/api/teacher/overview') {
    requirePermission('teacher.assign');
    return {
      students: db.users.filter((u) => u.role === 'student').map(toSafeUser),
      studentProgress: db.readingProgress,
      books: db.books.filter((b) => b.status === 'published').map(summarizeBook),
    } as T;
  }

  // Admin routes
  if (method === 'POST' && pathname === '/api/admin/books') {
    const actor = requirePermission('books.manage');
    const payload = body as Partial<Book>;
    const now = new Date().toISOString();
    const requestedTotal = Math.max(1, Number(payload.totalPages || 1));
    const pages =
      Array.isArray(payload.pages) && payload.pages.length > 0
        ? payload.pages
        : Array.from({ length: payload.pdfFileId ? requestedTotal : 1 }, (_, idx) => ({
            pageNumber: idx + 1,
            chapterTitle: `Page ${idx + 1}`,
            heading: idx === 0 ? payload.title || 'Introduction' : `Page ${idx + 1}`,
            body: idx === 0 ? payload.description || '' : `PDF Page ${idx + 1}`,
          }));
    const draftBook: Book = {
      id: uid('bk'),
      editionGroupId: payload.editionGroupId || uid('grp'),
      title: String(payload.title || '').trim(),
      subtitle: String(payload.subtitle || '').trim(),
      author: String(payload.author || 'Editorial Team').trim(),
      publisher: String(payload.publisher || 'VidyaKosha Press').trim(),
      editionLabel: String(payload.editionLabel || '2026 Edition').trim(),
      academicYear: String(payload.academicYear || '2026-27').trim(),
      isbn: String(payload.isbn || `978-93-${Math.floor(100000 + Math.random() * 899999)}`),
      description: String(payload.description || '').trim(),
      coverUrl: payload.coverUrl || '/src/assets/images/cover_mathematics_1795146975787.jpg',
      format: payload.pdfFileId ? 'pdf' : payload.format || 'reflowable',
      classId: payload.classId || 'cls-10',
      boardId: payload.boardId || 'brd-cbse',
      subjectId: payload.subjectId || 'sub-math',
      contentLanguageCode: payload.contentLanguageCode || 'hi',
      status: payload.status || 'draft',
      isFree: Boolean(payload.isFree),
      price: payload.isFree ? 0 : Number(payload.price || 199),
      currency: db.config.currency,
      previewPagesCount: Math.max(1, Number(payload.previewPagesCount || 2)),
      totalPages: pages.length,
      pages,
      pdfFileId: payload.pdfFileId || undefined,
      pdfFileName: payload.pdfFileName || undefined,
      pdfFileSizeBytes: typeof payload.pdfFileSizeBytes === 'number' ? payload.pdfFileSizeBytes : undefined,
      license: payload.license || {
        rightsHolder: '',
        licenseType: 'publisher_direct',
        licenseNumber: '',
        distributionPermissionGranted: false,
        validFrom: now,
        validUntil: new Date(Date.now() + 365 * 86400000).toISOString(),
        allowOfflineDownload: false,
        allowPrinting: false,
        territoryCountries: [db.config.targetCountry],
      },
      learningResources: payload.learningResources || [],
      readCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (draftBook.status === 'published' || draftBook.status === 'scheduled') {
      const check = canPublishBook(draftBook);
      if (!check.allowed) throw new Error(check.reasons.join(' '));
      draftBook.license.verifiedByAdminId = actor.id;
      draftBook.license.verifiedAt = now;
    }
    db.books.unshift(draftBook);
    appendAudit(db, actor, 'BOOK_CREATED', 'book', draftBook.id, `Created "${draftBook.title}"`);
    saveNativeDb(db);
    return { book: summarizeBook(draftBook) } as T;
  }

  const adminBookMatch = pathname.match(/^\/api\/admin\/books\/([^/]+)$/);
  if (adminBookMatch && method === 'PUT') {
    const actor = requirePermission('books.manage');
    const idx = db.books.findIndex((b) => b.id === adminBookMatch[1]);
    if (idx < 0) throw new Error('Book not found.');
    const existing = db.books[idx];
    const patch = body as Partial<Book>;
    const updated: Book = {
      ...existing,
      ...patch,
      id: existing.id,
      pages: Array.isArray(patch.pages) && patch.pages.length > 0 ? patch.pages : existing.pages,
      pdfFileId: patch.pdfFileId === null ? undefined : patch.pdfFileId ?? existing.pdfFileId,
      pdfFileName: patch.pdfFileName === null ? undefined : patch.pdfFileName ?? existing.pdfFileName,
      pdfFileSizeBytes:
        patch.pdfFileSizeBytes === null ? undefined : patch.pdfFileSizeBytes ?? existing.pdfFileSizeBytes,
      license: patch.license ? { ...existing.license, ...patch.license } : existing.license,
      updatedAt: new Date().toISOString(),
    };
    updated.totalPages = updated.pages.length;
    if (updated.status === 'published' || updated.status === 'scheduled') {
      const check = canPublishBook(updated);
      if (!check.allowed) throw new Error(check.reasons.join(' '));
    }
    db.books[idx] = updated;
    appendAudit(db, actor, 'BOOK_UPDATED', 'book', updated.id, `Updated "${updated.title}"`);
    saveNativeDb(db);
    return { book: summarizeBook(updated) } as T;
  }

  if (adminBookMatch && method === 'DELETE') {
    const actor = requirePermission('books.manage');
    db.books = db.books.filter((b) => b.id !== adminBookMatch[1]);
    appendAudit(db, actor, 'BOOK_DELETED', 'book', adminBookMatch[1], 'Deleted book');
    saveNativeDb(db);
    return { deleted: true } as T;
  }

  if (method === 'POST' && pathname === '/api/admin/edition-groups/link') {
    requirePermission('books.manage');
    const src = db.books.find((b) => b.id === body.sourceBookId);
    const tgt = db.books.find((b) => b.id === body.targetBookId);
    if (!src || !tgt) throw new Error('Both books must exist.');
    tgt.editionGroupId = src.editionGroupId;
    saveNativeDb(db);
    return { editionGroupId: src.editionGroupId } as T;
  }

  const taxPostMatch = pathname.match(/^\/api\/admin\/taxonomies\/([^/]+)$/);
  if (method === 'POST' && taxPostMatch) {
    requirePermission('taxonomies.manage');
    const type = taxPostMatch[1];
    if (type === 'boards') {
      const item = {
        id: uid('brd'),
        code: String(body.code || '').toUpperCase().trim(),
        name: String(body.name || '').trim(),
        country: String(body.country || db.config.targetCountry),
        enabled: true,
      };
      db.boards.push(item);
      saveNativeDb(db);
      return { item } as T;
    }
    if (type === 'classes') {
      const item = {
        id: uid('cls'),
        code: String(body.code || '').toUpperCase().trim(),
        name: String(body.name || '').trim(),
        order: Number(body.order || db.classes.length + 1),
        enabled: true,
      };
      db.classes.push(item);
      saveNativeDb(db);
      return { item } as T;
    }
    if (type === 'subjects') {
      const item = { id: uid('sub'), name: String(body.name || '').trim(), category: String(body.category || 'Core'), enabled: true };
      db.subjects.push(item);
      saveNativeDb(db);
      return { item } as T;
    }
    if (type === 'contentLanguages' || type === 'uiLanguages') {
      const item = {
        code: String(body.code || '').toLowerCase().trim(),
        name: String(body.name || '').trim(),
        nativeName: String(body.nativeName || body.name || '').trim(),
        enabled: true,
      };
      if (type === 'contentLanguages') db.contentLanguages.push(item);
      else db.uiLanguages.push(item);
      saveNativeDb(db);
      return { item } as T;
    }
  }

  const taxPatchMatch = pathname.match(/^\/api\/admin\/taxonomies\/([^/]+)\/([^/]+)$/);
  if (method === 'PATCH' && taxPatchMatch) {
    requirePermission('taxonomies.manage');
    const [, type, id] = taxPatchMatch;
    const enabled = Boolean(body.enabled);
    if (type === 'boards') db.boards.filter((x) => x.id === id).forEach((x) => (x.enabled = enabled));
    if (type === 'classes') db.classes.filter((x) => x.id === id).forEach((x) => (x.enabled = enabled));
    if (type === 'subjects') db.subjects.filter((x) => x.id === id).forEach((x) => (x.enabled = enabled));
    if (type === 'contentLanguages') db.contentLanguages.filter((x) => x.code === id).forEach((x) => (x.enabled = enabled));
    if (type === 'uiLanguages') db.uiLanguages.filter((x) => x.code === id).forEach((x) => (x.enabled = enabled));
    saveNativeDb(db);
    return { ok: true } as T;
  }

  if (method === 'GET' && pathname === '/api/admin/users') {
    requirePermission('users.manage');
    return {
      users: db.users.map((u) => ({
        ...toSafeUser(u),
        subscriptionsCount: db.subscriptions.filter((s) => s.userId === u.id && s.status === 'active').length,
        totalSpent: db.payments.filter((p) => p.userId === u.id && p.status === 'succeeded').reduce((a, p) => a + p.totalAmount, 0),
      })),
      rolePermissions: db.rolePermissions,
      tickets: db.tickets,
      bulkImportJobs: db.bulkImportJobs,
    } as T;
  }

  const userStatusMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/status$/);
  if (method === 'PATCH' && userStatusMatch) {
    requirePermission('users.manage');
    const u = db.users.find((x) => x.id === userStatusMatch[1]);
    if (!u) throw new Error('User not found.');
    u.status = body.status === 'suspended' ? 'suspended' : 'active';
    saveNativeDb(db);
    return { user: toSafeUser(u) } as T;
  }

  if (method === 'GET' && pathname === '/api/admin/audit-logs') {
    requirePermission('audit.view');
    return { auditLogs: db.auditLogs } as T;
  }

  if (method === 'GET' && pathname === '/api/admin/reports') {
    requirePermission('reports.view');
    const succeeded = db.payments.filter((p) => p.status === 'succeeded');
    const failed = db.payments.filter((p) => p.status === 'failed');
    const usageByLanguage: Record<string, number> = {};
    const usageByBoard: Record<string, number> = {};
    db.books.forEach((b) => {
      usageByLanguage[b.contentLanguageCode] = (usageByLanguage[b.contentLanguageCode] || 0) + b.readCount;
      usageByBoard[b.boardId] = (usageByBoard[b.boardId] || 0) + b.readCount;
    });
    return {
      summary: {
        totalRevenue: Math.round(succeeded.reduce((a, p) => a + p.totalAmount, 0) * 100) / 100,
        succeededCount: succeeded.length,
        failedCount: failed.length,
        activeSubscriptions: db.subscriptions.filter((s) => s.status === 'active').length,
        expiringSoon: 0,
        publishedBooks: db.books.filter((b) => b.status === 'published').length,
        totalUsers: db.users.length,
      },
      payments: db.payments,
      popularBooks: [...db.books]
        .filter((b) => b.status === 'published')
        .sort((a, b) => b.readCount - a.readCount)
        .slice(0, 6)
        .map((b) => ({
          id: b.id,
          title: b.title,
          contentLanguageCode: b.contentLanguageCode,
          boardId: b.boardId,
          readCount: b.readCount,
        })),
      usageByLanguage,
      usageByBoard,
      coupons: db.coupons,
      plans: db.plans,
    } as T;
  }

  if (method === 'GET' && pathname === '/api/admin/reports/export.csv') {
    requirePermission('reports.view');
    const header = 'Invoice,Date,User,Plan,Provider,Subtotal,Discount,Tax,Total,Currency,Status';
    const lines = db.payments.map((p) =>
      [p.invoiceNumber, p.createdAt.slice(0, 10), `"${p.userName}"`, `"${p.planName}"`, `"${p.provider}"`, p.subtotal, p.discountAmount, p.taxAmount, p.totalAmount, p.currency, p.status].join(',')
    );
    return [header, ...lines].join('\n') as unknown as T;
  }

  if (method === 'PATCH' && pathname === '/api/admin/config') {
    requirePermission('config.manage');
    db.config = { ...db.config, ...(body as Partial<AppConfig>) };
    saveNativeDb(db);
    return { config: db.config } as T;
  }

  if (method === 'GET' && pathname === '/api/admin/backup') {
    requirePermission('backups.manage');
    return db as unknown as T;
  }

  throw new Error(`Unsupported offline route: ${method} ${pathname}`);
}
