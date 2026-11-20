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

const DEMO_PASSWORDS_BY_USER_ID: Record<string, string> = {
  'u-super-1': 'Admin@123',
  'u-admin-1': 'Manager@123',
  'u-stu-1': 'Student@123',
  'u-par-1': 'Parent@123',
  'u-tch-1': 'Teacher@123',
};

export function createSeedDatabase(): DatabaseSchema {
  const users: User[] = SEED_SAFE_USERS.map((safe) => {
    const rawPassword = DEMO_PASSWORDS_BY_USER_ID[safe.id] || 'Vidya@123';
    const { hash, salt } = hashPassword(rawPassword);
    return {
      ...structuredClone(safe),
      passwordHash: hash,
      salt,
    };
  });

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
