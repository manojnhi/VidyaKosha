import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AuditLogEntry, DatabaseSchema, RoleId, SafeUser, User } from '../src/shared/types';
import { createSeedDatabase } from './seed';

const DATA_DIR = process.env.VIDYAKOSHA_DATA_DIR
  ? path.resolve(process.env.VIDYAKOSHA_DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SESSION_SECRET = process.env.SESSION_SECRET || 'vidyakosha-local-dev-signing-secret-2026';

export function getUploadsDir(): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
}

export function savePdfUpload(buffer: Buffer): string {
  const fileId = `pdf-${crypto.randomUUID().slice(0, 12)}`;
  const target = path.join(getUploadsDir(), `${fileId}.pdf`);
  fs.writeFileSync(target, buffer);
  return fileId;
}

export function getPdfUploadPath(fileId?: string): string | null {
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) return null;
  const target = path.join(getUploadsDir(), `${fileId}.pdf`);
  return fs.existsSync(target) ? target : null;
}

export function saveFileUpload(buffer: Buffer, originalName = 'book.bin'): string {
  const rawExt = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const safeExt = rawExt.length >= 2 && rawExt.length <= 10 ? rawExt : '.bin';
  const fileId = `file-${crypto.randomUUID().slice(0, 12)}${safeExt}`;
  const target = path.join(getUploadsDir(), fileId);
  fs.writeFileSync(target, buffer);
  return fileId;
}

export function getFileUploadPath(fileId?: string): string | null {
  if (!fileId || !/^[a-zA-Z0-9_-]+\.[a-z0-9]{1,10}$/.test(fileId)) return null;
  const target = path.join(getUploadsDir(), fileId);
  return fs.existsSync(target) ? target : null;
}

const LEGACY_DEMO_USER_IDS = new Set(['u-super-1', 'u-admin-1', 'u-stu-1', 'u-par-1', 'u-tch-1']);
const LEGACY_DEMO_USER_EMAILS = new Set([
  'superadmin@vidyakosha.edu',
  'content@vidyakosha.edu',
  'aarav@student.vidyakosha.edu',
  'parent@vidyakosha.edu',
  'teacher@vidyakosha.edu',
]);
const LEGACY_DEMO_BOOK_IDS = new Set([
  'bk-nursery-num-en', 'bk-math-10-hi', 'bk-math-10-en', 'bk-sci-8-en',
  'bk-sci-8-hi', 'bk-hindi-6-hi', 'bk-phy-12-en', 'bk-evs-5-mr', 'bk-draft-eng-3',
]);
const LEGACY_DEMO_PLAN_IDS = new Set(['plan-class10-cbse', 'plan-all-access', 'plan-sci-8']);

function removeBundledDemoRecords(db: DatabaseSchema): boolean {
  const demoUserIds = new Set(db.users.filter((user) =>
    LEGACY_DEMO_USER_IDS.has(user.id) || LEGACY_DEMO_USER_EMAILS.has(user.email.toLowerCase())
  ).map((user) => user.id));
  let changed = false;
  const filterRows = <T>(rows: T[], keep: (row: T) => boolean): T[] => {
    const filtered = rows.filter(keep);
    if (filtered.length !== rows.length) changed = true;
    return filtered;
  };
  db.users = filterRows(db.users, (user) => !demoUserIds.has(user.id));
  db.books = filterRows(db.books, (book) => !LEGACY_DEMO_BOOK_IDS.has(book.id));
  db.plans = filterRows(db.plans, (plan) => !LEGACY_DEMO_PLAN_IDS.has(plan.id));
  db.coupons = filterRows(db.coupons, (coupon) => !['cpn-1', 'cpn-2'].includes(coupon.id));
  db.subscriptions = filterRows(db.subscriptions, (row) =>
    row.id !== 'sub-seed-1' && !demoUserIds.has(row.userId) && !LEGACY_DEMO_PLAN_IDS.has(row.planId)
  );
  db.payments = filterRows(db.payments, (row) =>
    !['pay-seed-1', 'pay-seed-2'].includes(row.id) && !demoUserIds.has(row.userId)
  );
  db.readingProgress = filterRows(db.readingProgress, (row) =>
    !demoUserIds.has(row.userId) && !LEGACY_DEMO_BOOK_IDS.has(row.bookId)
  );
  db.bookmarks = filterRows(db.bookmarks, (row) =>
    row.id !== 'bm-1' && !demoUserIds.has(row.userId) && !LEGACY_DEMO_BOOK_IDS.has(row.bookId)
  );
  db.annotations = filterRows(db.annotations, (row) =>
    row.id !== 'ann-1' && !demoUserIds.has(row.userId) && !LEGACY_DEMO_BOOK_IDS.has(row.bookId)
  );
  db.notifications = filterRows(db.notifications, (row) =>
    !['not-1', 'not-2'].includes(row.id) && (!row.userId || !demoUserIds.has(row.userId))
  );
  db.tickets = filterRows(db.tickets, (row) =>
    row.id !== 'tkt-1' && !demoUserIds.has(row.userId)
  );
  db.auditLogs = filterRows(db.auditLogs, (row) =>
    row.id !== 'aud-1' && !demoUserIds.has(row.actorId) && !LEGACY_DEMO_BOOK_IDS.has(row.targetId)
  );
  db.bulkImportJobs = filterRows(db.bulkImportJobs, (row) => row.id !== 'blk-1');
  for (const user of db.users) {
    if (user.linkedChildId && demoUserIds.has(user.linkedChildId)) {
      delete user.linkedChildId;
      changed = true;
    }
    const favorites = user.favoriteBookIds.filter((bookId) => !LEGACY_DEMO_BOOK_IDS.has(bookId));
    if (favorites.length !== user.favoriteBookIds.length) {
      user.favoriteBookIds = favorites;
      changed = true;
    }
  }
  const announcements = db.config.announcements.filter((announcement) => announcement.id !== 'ann-banner-1');
  if (announcements.length !== db.config.announcements.length) {
    db.config.announcements = announcements;
    changed = true;
  }
  const providers = db.config.paymentProviders.filter((provider) =>
    !['razorpay_in', 'stripe_global', 'paytabs_mena'].includes(provider.id)
  );
  if (providers.length !== db.config.paymentProviders.length) {
    db.config.paymentProviders = providers;
    changed = true;
  }
  if (['razorpay_in', 'stripe_global', 'paytabs_mena'].includes(db.config.activePaymentProvider)) {
    db.config.activePaymentProvider = '';
    changed = true;
  }
  if (db.config.legalPages.refundPolicy || db.config.legalPages.purchaseTerms || db.config.legalPages.privacyPolicy) {
    db.config.legalPages = { refundPolicy: '', purchaseTerms: '', privacyPolicy: '' };
    changed = true;
  }
  return changed;
}

let dbCache: DatabaseSchema | null = null;

export function loadDb(): DatabaseSchema {
  if (dbCache) return dbCache;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed = createSeedDatabase();
    saveDb(seed);
    dbCache = seed;
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(raw) as DatabaseSchema;
    let changed = removeBundledDemoRecords(db);
    if (!db.users.some((user) => user.role === 'super_admin') && process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
      const bootstrapUsers = createSeedDatabase().users;
      const initialAdmin = bootstrapUsers.find((user) => user.role === 'super_admin');
      if (initialAdmin && !db.users.some((user) => user.email === initialAdmin.email)) {
        db.users.push(initialAdmin);
        changed = true;
      }
    }
    if (changed) saveDb(db);
    dbCache = db;
    return dbCache;
  } catch {
    const seed = createSeedDatabase();
    saveDb(seed);
    dbCache = seed;
    return seed;
  }
}

export function saveDb(nextDb: DatabaseSchema): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(nextDb, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
  dbCache = nextDb;
}

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _ph, salt: _s, ...safe } = user;
  return safe;
}

export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string): (T & { exp: number }) | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as T & { exp: number };
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function appendAuditLog(
  db: DatabaseSchema,
  actor: { id: string; name: string; role: RoleId },
  action: string,
  targetType: string,
  targetId: string,
  details: string
): void {
  const entry: AuditLogEntry = {
    id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    targetType,
    targetId,
    details,
    timestamp: new Date().toISOString(),
  };
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
}
