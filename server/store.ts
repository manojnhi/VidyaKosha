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
    dbCache = JSON.parse(raw) as DatabaseSchema;
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
