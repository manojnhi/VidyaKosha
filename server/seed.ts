import crypto from 'node:crypto';
import type { DatabaseSchema, User } from '../src/shared/types';
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
} from '../src/shared/seedCatalog';

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (computed.length !== stored.length) return false;
  return crypto.timingSafeEqual(computed, stored);
}

export function createSeedDatabase(): DatabaseSchema {
  const users: User[] = SEED_SAFE_USERS.map((safe) => ({
    ...structuredClone(safe),
    passwordHash: '',
    salt: '',
  }));
  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (initialAdminEmail && initialAdminPassword && !users.some((user) => user.role === 'super_admin')) {
    const { hash, salt } = hashPassword(initialAdminPassword);
    users.push({
      id: `u-${crypto.randomUUID().slice(0, 8)}`,
      name: process.env.INITIAL_ADMIN_NAME?.trim() || 'VidyaKosha Administrator',
      email: initialAdminEmail,
      passwordHash: hash,
      salt,
      role: 'super_admin',
      status: 'active',
      uiLanguageCode: 'hi',
      preferredContentLanguageCode: 'hi',
      favoriteBookIds: [],
      createdAt: new Date().toISOString(),
    });
  }

  return {
    users,
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
