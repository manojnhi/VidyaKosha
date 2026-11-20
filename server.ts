import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  calculateCheckoutTotals,
  canPublishBook,
  checkBookAccess,
  filterBooksCatalog,
  hasPermission,
} from './src/shared/domainLogic';
import type {
  Annotation,
  Book,
  BookSummary,
  Coupon,
  DatabaseSchema,
  Permission,
  RoleId,
  Subscription,
  SubscriptionPlan,
  User,
} from './src/shared/types';
import { PDFDocument } from 'pdf-lib';
import { hashPassword, verifyPassword } from './server/seed';
import {
  appendAuditLog,
  getPdfUploadPath,
  loadDb,
  saveDb,
  savePdfUpload,
  signToken,
  toSafeUser,
  verifyToken,
} from './server/store';

interface AuthedRequest extends Request {
  authUser?: User;
}

const PORT = Number(process.env.PORT || 3000);

function summarizeBook(book: Book): BookSummary {
  const { pages, ...rest } = book;
  return { ...rest, pageCount: pages.length };
}

function attachAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const rawToken =
    (header && header.startsWith('Bearer ') ? header.slice(7).trim() : null) ||
    (typeof req.query.auth === 'string' ? req.query.auth : null);

  if (rawToken) {
    const payload = verifyToken<{ userId: string }>(rawToken);
    if (payload) {
      const db = loadDb();
      const user = db.users.find((u) => u.id === payload.userId);
      if (user && user.status === 'active') {
        req.authUser = user;
      }
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
}

function requirePerm(permission: Permission) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const db = loadDb();
    if (!hasPermission(req.authUser.role, db.rolePermissions, permission)) {
      res.status(403).json({ error: `Missing required permission: ${permission}` });
      return;
    }
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(attachAuth);

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Bootstrap public config, taxonomies, plans, and current user state
  app.get('/api/bootstrap', (req: AuthedRequest, res) => {
    const db = loadDb();
    const user = req.authUser ? toSafeUser(req.authUser) : null;
    const subscriptions = user ? db.subscriptions.filter((s) => s.userId === user.id) : [];
    const readingProgress = user ? db.readingProgress.filter((p) => p.userId === user.id) : [];
    const notifications = user
      ? db.notifications.filter((n) => !n.userId || n.userId === user.id || n.roleTarget === user.role)
      : db.notifications.filter((n) => !n.userId && !n.roleTarget);

    res.json({
      config: db.config,
      uiLanguages: db.uiLanguages,
      contentLanguages: db.contentLanguages,
      boards: db.boards,
      classes: db.classes,
      subjects: db.subjects,
      plans: db.plans.filter((p) => p.active),
      rolePermissions: db.rolePermissions,
      user,
      subscriptions,
      readingProgress,
      notifications,
    });
  });

  // Auth: Register
  app.post('/api/auth/register', (req: AuthedRequest, res) => {
    const db = loadDb();
    const { name, email, password, classId, boardId, uiLanguageCode, preferredContentLanguageCode, role } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Valid full name is required.' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    const allowedSelfRoles: RoleId[] = ['student', 'parent', 'teacher'];
    const targetRole: RoleId = allowedSelfRoles.includes(role) ? role : 'student';
    const { hash, salt } = hashPassword(password);
    const newUser: User = {
      id: `u-${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hash,
      salt,
      role: targetRole,
      status: 'active',
      uiLanguageCode: uiLanguageCode || db.config.defaultUiLanguage || 'hi',
      preferredContentLanguageCode: preferredContentLanguageCode || 'hi',
      classId: classId || 'cls-10',
      boardId: boardId || 'brd-cbse',
      favoriteBookIds: [],
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    appendAuditLog(db, newUser, 'USER_REGISTERED', 'user', newUser.id, `Registered as ${targetRole}`);
    saveDb(db);
    const token = signToken({ userId: newUser.id }, 60 * 60 * 24 * 7);
    res.status(201).json({ token, user: toSafeUser(newUser) });
  });

  // Auth: Login
  app.post('/api/auth/login', (req: AuthedRequest, res) => {
    const db = loadDb();
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const user = db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user || !verifyPassword(String(password), user.passwordHash, user.salt)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Account is suspended. Contact administrator.' });
      return;
    }
    user.lastLoginAt = new Date().toISOString();
    appendAuditLog(db, user, 'USER_LOGIN', 'user', user.id, 'Authenticated via email & password');
    saveDb(db);
    const token = signToken({ userId: user.id }, 60 * 60 * 24 * 7);
    res.json({ token, user: toSafeUser(user) });
  });

  // Auth: Demo role switcher (for evaluating all 5 roles smoothly)
  app.post('/api/auth/demo-switch', (req: AuthedRequest, res) => {
    const db = loadDb();
    const { role } = req.body || {};
    const targetUser = db.users.find((u) => u.role === role && u.status === 'active');
    if (!targetUser) {
      res.status(404).json({ error: 'Demo user for role not found.' });
      return;
    }
    targetUser.lastLoginAt = new Date().toISOString();
    appendAuditLog(db, targetUser, 'DEMO_ROLE_SWITCH', 'user', targetUser.id, `Switched demo workspace to ${role}`);
    saveDb(db);
    const token = signToken({ userId: targetUser.id }, 60 * 60 * 24 * 7);
    res.json({ token, user: toSafeUser(targetUser) });
  });

  // Auth: Profile update
  app.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { name, uiLanguageCode, preferredContentLanguageCode, classId, boardId } = req.body || {};
    if (typeof name === 'string' && name.trim().length >= 2) user.name = name.trim();
    if (typeof uiLanguageCode === 'string') user.uiLanguageCode = uiLanguageCode;
    if (typeof preferredContentLanguageCode === 'string') {
      user.preferredContentLanguageCode = preferredContentLanguageCode;
    }
    if (typeof classId === 'string') user.classId = classId;
    if (typeof boardId === 'string') user.boardId = boardId;
    saveDb(db);
    res.json({ user: toSafeUser(user) });
  });

  // Privacy: Export personal data
  app.get('/api/auth/export-data', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: toSafeUser(req.authUser!),
      subscriptions: db.subscriptions.filter((s) => s.userId === uid),
      payments: db.payments.filter((p) => p.userId === uid),
      readingProgress: db.readingProgress.filter((p) => p.userId === uid),
      bookmarks: db.bookmarks.filter((b) => b.userId === uid),
      annotations: db.annotations.filter((a) => a.userId === uid),
      tickets: db.tickets.filter((t) => t.userId === uid),
    };
    appendAuditLog(db, req.authUser!, 'PRIVACY_DATA_EXPORT', 'user', uid, 'User exported personal data JSON');
    saveDb(db);
    res.json(payload);
  });

  // Privacy: Self account deletion
  app.delete('/api/auth/account', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    if (req.authUser!.role === 'super_admin') {
      res.status(400).json({ error: 'Super Admin account cannot be self-deleted.' });
      return;
    }
    db.users = db.users.filter((u) => u.id !== uid);
    db.bookmarks = db.bookmarks.filter((b) => b.userId !== uid);
    db.annotations = db.annotations.filter((a) => a.userId !== uid);
    db.readingProgress = db.readingProgress.filter((p) => p.userId !== uid);
    appendAuditLog(db, req.authUser!, 'ACCOUNT_DELETED', 'user', uid, 'Self-service account deletion completed');
    saveDb(db);
    res.json({ deleted: true });
  });

  // Books catalog (without leaking full book text pages!)
  app.get('/api/books', (req: AuthedRequest, res) => {
    const db = loadDb();
    const includeUnpublished =
      req.query.includeUnpublished === '1' &&
      Boolean(req.authUser && hasPermission(req.authUser.role, db.rolePermissions, 'books.manage'));

    const filtered = filterBooksCatalog(db.books, {
      classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
      boardId: typeof req.query.boardId === 'string' ? req.query.boardId : undefined,
      subjectId: typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined,
      contentLanguageCode:
        typeof req.query.contentLanguageCode === 'string' ? req.query.contentLanguageCode : undefined,
      academicYear: typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      onlyFree: req.query.onlyFree === '1',
      includeUnpublished,
    });

    const userSafe = req.authUser ? toSafeUser(req.authUser) : null;
    const enriched = filtered.map((book) => {
      const linkedEditions = db.books
        .filter(
          (other) =>
            other.editionGroupId === book.editionGroupId &&
            (includeUnpublished || other.status === 'published')
        )
        .map((other) => ({
          bookId: other.id,
          contentLanguageCode: other.contentLanguageCode,
          title: other.title,
          editionLabel: other.editionLabel,
        }));

      const access = checkBookAccess(userSafe, book, db.subscriptions);
      return {
        ...summarizeBook(book),
        linkedEditions,
        access,
      };
    });

    res.json({ books: enriched });
  });

  // Single book details
  app.get('/api/books/:id', (req: AuthedRequest, res) => {
    const db = loadDb();
    const book = db.books.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }
    const isAdmin = Boolean(req.authUser && hasPermission(req.authUser.role, db.rolePermissions, 'books.manage'));
    if (book.status !== 'published' && !isAdmin) {
      res.status(404).json({ error: 'Book not available.' });
      return;
    }
    const linkedEditions = db.books
      .filter((b) => b.editionGroupId === book.editionGroupId && (isAdmin || b.status === 'published'))
      .map((b) => ({
        bookId: b.id,
        contentLanguageCode: b.contentLanguageCode,
        title: b.title,
        editionLabel: b.editionLabel,
      }));
    const access = checkBookAccess(req.authUser ? toSafeUser(req.authUser) : null, book, db.subscriptions);
    res.json({ book: summarizeBook(book), linkedEditions, access });
  });

  // Issue short-lived signed temporary token for authorized book reading (never raw public file URLs)
  app.post('/api/books/:id/access-token', (req: AuthedRequest, res) => {
    const db = loadDb();
    const book = db.books.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }
    const isAdmin = Boolean(req.authUser && hasPermission(req.authUser.role, db.rolePermissions, 'books.manage'));
    if (book.status !== 'published' && !isAdmin) {
      res.status(403).json({ error: 'Book is not published.' });
      return;
    }
    const access = checkBookAccess(req.authUser ? toSafeUser(req.authUser) : null, book, db.subscriptions);
    const token = signToken(
      {
        bookId: book.id,
        userId: req.authUser?.id || 'guest',
        accessLevel: access.accessLevel,
        allowedPages: access.allowedPages,
      },
      900
    );
    res.json({ accessToken: token, expiresInSeconds: 900, access });
  });

  // Serve authorized book pages strictly via signed access token
  app.get('/api/books/:id/content', (req: AuthedRequest, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const decoded = verifyToken<{
      bookId: string;
      userId: string;
      accessLevel: 'full' | 'preview_only';
      allowedPages: number;
    }>(token);
    if (!decoded || decoded.bookId !== req.params.id) {
      res.status(403).json({ error: 'Invalid or expired book access token.' });
      return;
    }
    const db = loadDb();
    const book = db.books.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }

    book.readCount += 1;
    saveDb(db);

    const pages =
      decoded.accessLevel === 'full' ? book.pages : book.pages.slice(0, Math.max(1, decoded.allowedPages));

    const hasPdf = Boolean(book.pdfFileId && getPdfUploadPath(book.pdfFileId));
    res.json({
      bookId: book.id,
      accessLevel: decoded.accessLevel,
      totalPages: book.totalPages,
      allowedPages: pages.length,
      pages,
      hasPdf,
      pdfUrl: hasPdf ? `/api/books/${book.id}/pdf?token=${encodeURIComponent(token)}` : undefined,
      licensePermissions: {
        allowOfflineDownload: decoded.accessLevel === 'full' && book.license.allowOfflineDownload,
        allowPrinting: decoded.accessLevel === 'full' && book.license.allowPrinting,
      },
    });
  });

  // Stream authorized PDF (sliced strictly to previewPagesCount for preview_only access)
  app.get('/api/books/:id/pdf', async (req: AuthedRequest, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const decoded = verifyToken<{
      bookId: string;
      userId: string;
      accessLevel: 'full' | 'preview_only';
      allowedPages: number;
    }>(token);
    if (!decoded || decoded.bookId !== req.params.id) {
      res.status(403).json({ error: 'Invalid or expired book access token.' });
      return;
    }
    const db = loadDb();
    const book = db.books.find((b) => b.id === req.params.id);
    const pdfPath = book ? getPdfUploadPath(book.pdfFileId) : null;
    if (!book || !pdfPath) {
      res.status(404).json({ error: 'PDF file not found for this book.' });
      return;
    }

    try {
      const rawBytes = fs.readFileSync(pdfPath);
      let outBytes: Buffer | Uint8Array = rawBytes;

      if (decoded.accessLevel === 'preview_only') {
        const srcDoc = await PDFDocument.load(rawBytes, { ignoreEncryption: true });
        const maxPages = Math.max(1, Math.min(srcDoc.getPageCount(), decoded.allowedPages || book.previewPagesCount));
        if (maxPages < srcDoc.getPageCount()) {
          const previewDoc = await PDFDocument.create();
          const indices = Array.from({ length: maxPages }, (_, idx) => idx);
          const copied = await previewDoc.copyPages(srcDoc, indices);
          copied.forEach((p) => previewDoc.addPage(p));
          outBytes = await previewDoc.save();
        }
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(Buffer.from(outBytes));
    } catch (err) {
      console.error('Error serving PDF:', err);
      res.status(500).json({ error: 'Unable to process PDF file.' });
    }
  });

  // Reader state: progress, bookmarks, annotations
  app.get('/api/reader/state/:bookId', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    const bookId = req.params.bookId;
    res.json({
      progress: db.readingProgress.find((p) => p.userId === uid && p.bookId === bookId) || null,
      bookmarks: db.bookmarks.filter((b) => b.userId === uid && b.bookId === bookId),
      annotations: db.annotations.filter((a) => a.userId === uid && a.bookId === bookId),
    });
  });

  app.get('/api/learning/overview', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    res.json({
      progress: db.readingProgress.filter((p) => p.userId === uid),
      bookmarks: db.bookmarks.filter((b) => b.userId === uid),
      annotations: db.annotations.filter((a) => a.userId === uid),
      subscriptions: db.subscriptions.filter((s) => s.userId === uid),
      payments: db.payments.filter((p) => p.userId === uid),
      tickets: db.tickets.filter((t) => t.userId === uid),
    });
  });

  app.put('/api/reader/progress', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    const { bookId, lastPage } = req.body || {};
    const book = db.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }
    const clampedPage = Math.max(1, Math.min(book.totalPages, Number(lastPage) || 1));
    const percentComplete = Math.round((clampedPage / Math.max(1, book.totalPages)) * 100);
    const existingIdx = db.readingProgress.findIndex((p) => p.userId === uid && p.bookId === bookId);
    const nextItem = {
      userId: uid,
      bookId,
      editionGroupId: book.editionGroupId,
      lastPage: clampedPage,
      totalPages: book.totalPages,
      percentComplete,
      updatedAt: new Date().toISOString(),
    };
    if (existingIdx >= 0) db.readingProgress[existingIdx] = nextItem;
    else db.readingProgress.unshift(nextItem);
    saveDb(db);
    res.json({ progress: nextItem });
  });

  app.post('/api/reader/bookmarks', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    const { bookId, pageNumber, chapterTitle, label } = req.body || {};
    if (!bookId || !pageNumber) {
      res.status(400).json({ error: 'bookId and pageNumber are required.' });
      return;
    }
    const existing = db.bookmarks.find(
      (b) => b.userId === uid && b.bookId === bookId && b.pageNumber === Number(pageNumber)
    );
    if (existing) {
      res.json({ bookmark: existing });
      return;
    }
    const bm = {
      id: `bm-${crypto.randomUUID().slice(0, 8)}`,
      userId: uid,
      bookId,
      pageNumber: Number(pageNumber),
      chapterTitle: String(chapterTitle || `Page ${pageNumber}`),
      label: String(label || `Page ${pageNumber}`),
      createdAt: new Date().toISOString(),
    };
    db.bookmarks.unshift(bm);
    saveDb(db);
    res.status(201).json({ bookmark: bm });
  });

  app.delete('/api/reader/bookmarks/:id', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    db.bookmarks = db.bookmarks.filter((b) => !(b.id === req.params.id && b.userId === uid));
    saveDb(db);
    res.json({ deleted: true });
  });

  app.post('/api/reader/annotations', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    const { bookId, pageNumber, type, color, textSelection, noteText, strokes } = req.body || {};
    if (!bookId || !pageNumber || !type) {
      res.status(400).json({ error: 'bookId, pageNumber, and type are required.' });
      return;
    }
    const now = new Date().toISOString();
    // If pen strokes for the same page exist, replace cleanly so undo/redo + save stays atomic
    if (type === 'pen') {
      db.annotations = db.annotations.filter(
        (a) => !(a.userId === uid && a.bookId === bookId && a.pageNumber === Number(pageNumber) && a.type === 'pen')
      );
      if (!Array.isArray(strokes) || strokes.length === 0) {
        saveDb(db);
        res.json({ annotation: null, cleared: true });
        return;
      }
    }
    const ann: Annotation = {
      id: `ann-${crypto.randomUUID().slice(0, 8)}`,
      userId: uid,
      bookId,
      pageNumber: Number(pageNumber),
      type,
      color: String(color || '#FEF08A'),
      textSelection: textSelection ? String(textSelection) : undefined,
      noteText: noteText ? String(noteText) : undefined,
      strokes: Array.isArray(strokes) ? strokes : undefined,
      createdAt: now,
      updatedAt: now,
    };
    db.annotations.unshift(ann);
    saveDb(db);
    res.status(201).json({ annotation: ann });
  });

  app.delete('/api/reader/annotations/:id', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    db.annotations = db.annotations.filter((a) => !(a.id === req.params.id && a.userId === uid));
    saveDb(db);
    res.json({ deleted: true });
  });

  app.post('/api/favorites/toggle', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    const { bookId } = req.body || {};
    if (!user || !bookId) {
      res.status(400).json({ error: 'bookId required.' });
      return;
    }
    const idx = user.favoriteBookIds.indexOf(bookId);
    if (idx >= 0) user.favoriteBookIds.splice(idx, 1);
    else user.favoriteBookIds.push(bookId);
    saveDb(db);
    res.json({ favoriteBookIds: user.favoriteBookIds });
  });

  // Checkout preview & payment (no card storage)
  app.post('/api/checkout/preview', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const { planId, bookId, couponCode } = req.body || {};
    let basePrice = 0;
    let taxRate = db.config.taxRatePercent;
    let itemTitle = '';

    if (planId) {
      const plan = db.plans.find((p) => p.id === planId && p.active);
      if (!plan) {
        res.status(404).json({ error: 'Subscription plan not found.' });
        return;
      }
      basePrice = plan.price;
      taxRate = plan.taxRatePercent;
      itemTitle = plan.name;
    } else if (bookId) {
      const book = db.books.find((b) => b.id === bookId && b.status === 'published');
      if (!book) {
        res.status(404).json({ error: 'Book not found.' });
        return;
      }
      basePrice = book.price;
      itemTitle = `${book.title} (1-Year Access)`;
    } else {
      res.status(400).json({ error: 'planId or bookId is required.' });
      return;
    }

    const coupon = couponCode
      ? db.coupons.find((c) => c.code.toUpperCase() === String(couponCode).trim().toUpperCase())
      : null;
    if (couponCode && !coupon) {
      const calc = calculateCheckoutTotals(basePrice, null, taxRate);
      res.json({ ...calc, itemTitle, couponError: 'COUPON_NOT_FOUND' });
      return;
    }
    const calc = calculateCheckoutTotals(basePrice, coupon, taxRate);
    res.json({ ...calc, itemTitle });
  });

  app.post('/api/checkout/pay', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const user = req.authUser!;
    const { planId, bookId, couponCode, providerId, simulateFailure } = req.body || {};

    let basePrice = 0;
    let taxRate = db.config.taxRatePercent;
    let scopeType: SubscriptionPlan['scopeType'] = 'book';
    let planName = '';
    let boardId: string | undefined;
    let classId: string | undefined;
    let subjectId: string | undefined;
    let resolvedPlanId = '';
    let resolvedBookId: string | undefined;

    if (planId) {
      const plan = db.plans.find((p) => p.id === planId && p.active);
      if (!plan) {
        res.status(404).json({ error: 'Plan not found.' });
        return;
      }
      basePrice = plan.price;
      taxRate = plan.taxRatePercent;
      scopeType = plan.scopeType;
      planName = plan.name;
      boardId = plan.boardId;
      classId = plan.classId;
      subjectId = plan.subjectId;
      resolvedPlanId = plan.id;
    } else if (bookId) {
      const book = db.books.find((b) => b.id === bookId && b.status === 'published');
      if (!book) {
        res.status(404).json({ error: 'Book not found.' });
        return;
      }
      basePrice = book.price;
      scopeType = 'book';
      planName = `${book.title} (1-Year License)`;
      resolvedPlanId = `book-plan-${book.id}`;
      resolvedBookId = book.id;
    } else {
      res.status(400).json({ error: 'planId or bookId is required.' });
      return;
    }

    const coupon = couponCode
      ? db.coupons.find((c) => c.code.toUpperCase() === String(couponCode).trim().toUpperCase())
      : null;
    const totals = calculateCheckoutTotals(basePrice, coupon, taxRate);
    const provider =
      db.config.paymentProviders.find((p) => p.id === (providerId || db.config.activePaymentProvider))?.name ||
      db.config.activePaymentProvider;

    const paymentId = `pay-${crypto.randomUUID().slice(0, 8)}`;
    const invoiceNumber = `INV-2026-${String(db.payments.length + 1).padStart(4, '0')}`;
    const now = new Date();

    if (simulateFailure) {
      const failedTx = {
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
        status: 'failed' as const,
        failureReason: 'Simulated gateway decline for testing failure handling.',
        createdAt: now.toISOString(),
      };
      db.payments.unshift(failedTx);
      saveDb(db);
      res.status(402).json({ error: failedTx.failureReason, transaction: failedTx });
      return;
    }

    const tx = {
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
      status: 'succeeded' as const,
      createdAt: now.toISOString(),
    };
    db.payments.unshift(tx);

    const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const subscription: Subscription = {
      id: `sub-${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      planId: resolvedPlanId,
      planName,
      scopeType,
      boardId,
      classId,
      subjectId,
      bookId: resolvedBookId,
      status: 'active',
      startsAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      autoRenew: true,
      paymentId,
    };
    db.subscriptions.unshift(subscription);

    db.notifications.unshift({
      id: `not-${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      title: 'Subscription Activated',
      message: `${planName} is active until ${expires.toISOString().slice(0, 10)}. Invoice: ${invoiceNumber}`,
      category: 'payment',
      read: false,
      createdAt: now.toISOString(),
    });
    appendAuditLog(db, user, 'PAYMENT_SUCCEEDED', 'subscription', subscription.id, `${invoiceNumber} (${totals.totalAmount} ${db.config.currency})`);
    saveDb(db);
    res.status(201).json({ transaction: tx, subscription });
  });

  // Support / content issue tickets & notifications
  app.post('/api/support/tickets', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const { type, bookId, subject, message } = req.body || {};
    if (!subject || !message) {
      res.status(400).json({ error: 'Subject and message are required.' });
      return;
    }
    const book = bookId ? db.books.find((b) => b.id === bookId) : undefined;
    const ticket = {
      id: `tkt-${crypto.randomUUID().slice(0, 8)}`,
      userId: req.authUser!.id,
      userName: req.authUser!.name,
      type: (['support', 'content_issue', 'feedback'].includes(type) ? type : 'support') as
        | 'support'
        | 'content_issue'
        | 'feedback',
      bookId: book?.id,
      bookTitle: book?.title,
      subject: String(subject).trim(),
      message: String(message).trim(),
      status: 'open' as const,
      createdAt: new Date().toISOString(),
    };
    db.tickets.unshift(ticket);
    saveDb(db);
    res.status(201).json({ ticket });
  });

  app.post('/api/notifications/read', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const uid = req.authUser!.id;
    db.notifications.forEach((n) => {
      if (!n.userId || n.userId === uid || n.roleTarget === req.authUser!.role) {
        n.read = true;
      }
    });
    saveDb(db);
    res.json({ ok: true });
  });

  // Parent & Teacher dedicated overviews
  app.get('/api/parent/overview', requirePerm('parent.monitor'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const childId = req.authUser!.linkedChildId || 'u-stu-1';
    const child = db.users.find((u) => u.id === childId);
    res.json({
      child: child ? toSafeUser(child) : null,
      progress: db.readingProgress.filter((p) => p.userId === childId),
      subscriptions: db.subscriptions.filter((s) => s.userId === childId),
      bookmarks: db.bookmarks.filter((b) => b.userId === childId),
      books: db.books.filter((b) => b.status === 'published').map(summarizeBook),
    });
  });

  app.get('/api/teacher/overview', requirePerm('teacher.assign'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const students = db.users.filter((u) => u.role === 'student').map(toSafeUser);
    res.json({
      students,
      studentProgress: db.readingProgress,
      books: db.books.filter((b) => b.status === 'published').map(summarizeBook),
    });
  });

  // ================= ADMIN ENDPOINTS =================

  app.post(
    '/api/admin/books/upload-pdf',
    requirePerm('books.manage'),
    express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '50mb' }),
    async (req: AuthedRequest, res) => {
      try {
        const buf = req.body as Buffer;
        if (!Buffer.isBuffer(buf) || buf.length < 16) {
          res.status(400).json({ error: 'Empty or missing PDF upload.' });
          return;
        }
        if (buf.subarray(0, 5).toString('ascii') !== '%PDF-') {
          res.status(400).json({ error: 'Invalid file format. Only valid PDF files are accepted.' });
          return;
        }
        let pageCount = 1;
        try {
          const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
          pageCount = Math.max(1, doc.getPageCount());
        } catch {
          res.status(400).json({ error: 'Corrupted or unreadable PDF document.' });
          return;
        }
        const pdfFileId = savePdfUpload(buf);
        const rawName = typeof req.headers['x-file-name'] === 'string' ? decodeURIComponent(req.headers['x-file-name']) : 'textbook.pdf';
        appendAuditLog(loadDb(), req.authUser!, 'PDF_UPLOADED', 'book', pdfFileId, `Uploaded ${rawName} (${pageCount} pages)`);
        res.status(201).json({
          pdfFileId,
          fileName: rawName,
          sizeBytes: buf.length,
          pageCount,
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'PDF upload failed.' });
      }
    }
  );

  app.post('/api/admin/books', requirePerm('books.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const payload = req.body as Partial<Book>;
    const now = new Date().toISOString();
    const requestedTotal = Math.max(1, Number(payload.totalPages || 1));
    const pages = Array.isArray(payload.pages) && payload.pages.length > 0
      ? payload.pages
      : Array.from({ length: payload.pdfFileId ? requestedTotal : 1 }, (_, idx) => ({
          pageNumber: idx + 1,
          chapterTitle: `Page ${idx + 1}`,
          heading: idx === 0 ? payload.title || 'Introduction' : `Page ${idx + 1}`,
          body: idx === 0 ? payload.description || 'Sample content page.' : `PDF Page ${idx + 1}`,
        }));

    const draftBook: Book = {
      id: `bk-${crypto.randomUUID().slice(0, 8)}`,
      editionGroupId: payload.editionGroupId || `grp-${crypto.randomUUID().slice(0, 6)}`,
      title: String(payload.title || '').trim(),
      subtitle: String(payload.subtitle || '').trim(),
      author: String(payload.author || 'Editorial Team').trim(),
      publisher: String(payload.publisher || 'VidyaKosha Press').trim(),
      editionLabel: String(payload.editionLabel || '2026 Edition').trim(),
      academicYear: String(payload.academicYear || '2026-27').trim(),
      isbn: String(payload.isbn || `978-93-${Math.floor(100000 + Math.random() * 899999)}`).trim(),
      description: String(payload.description || '').trim(),
      coverUrl: payload.coverUrl || '/src/assets/images/cover_mathematics_1795146975787.jpg',
      format: payload.pdfFileId ? 'pdf' : payload.format || 'reflowable',
      classId: payload.classId || 'cls-10',
      boardId: payload.boardId || 'brd-cbse',
      subjectId: payload.subjectId || 'sub-math',
      contentLanguageCode: payload.contentLanguageCode || 'hi',
      status: payload.status || 'draft',
      scheduledPublishAt: payload.scheduledPublishAt,
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
      if (!hasPermission(req.authUser!.role, db.rolePermissions, 'books.publish')) {
        res.status(403).json({ error: 'Missing books.publish permission.' });
        return;
      }
      const check = canPublishBook(draftBook);
      if (!check.allowed) {
        res.status(400).json({ error: check.reasons.join(' ') });
        return;
      }
      draftBook.license.verifiedByAdminId = req.authUser!.id;
      draftBook.license.verifiedAt = now;
    }

    db.books.unshift(draftBook);
    appendAuditLog(db, req.authUser!, 'BOOK_CREATED', 'book', draftBook.id, `Created "${draftBook.title}" (${draftBook.status})`);
    saveDb(db);
    res.status(201).json({ book: summarizeBook(draftBook) });
  });

  app.put('/api/admin/books/:id', requirePerm('books.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const idx = db.books.findIndex((b) => b.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }
    const existing = db.books[idx];
    const patch = req.body as Partial<Book>;
    const now = new Date().toISOString();
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
      updatedAt: now,
    };
    updated.totalPages = updated.pages.length;

    if (updated.status === 'published' || updated.status === 'scheduled') {
      const check = canPublishBook(updated);
      if (!check.allowed) {
        res.status(400).json({ error: check.reasons.join(' ') });
        return;
      }
      updated.license.verifiedByAdminId = req.authUser!.id;
      updated.license.verifiedAt = now;
    }

    db.books[idx] = updated;
    appendAuditLog(db, req.authUser!, 'BOOK_UPDATED', 'book', updated.id, `Updated "${updated.title}" -> status: ${updated.status}`);
    saveDb(db);
    res.json({ book: summarizeBook(updated) });
  });

  app.delete('/api/admin/books/:id', requirePerm('books.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const target = db.books.find((b) => b.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }
    db.books = db.books.filter((b) => b.id !== req.params.id);
    appendAuditLog(db, req.authUser!, 'BOOK_DELETED', 'book', target.id, `Deleted "${target.title}"`);
    saveDb(db);
    res.json({ deleted: true });
  });

  app.post('/api/admin/edition-groups/link', requirePerm('books.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const { sourceBookId, targetBookId } = req.body || {};
    const src = db.books.find((b) => b.id === sourceBookId);
    const tgt = db.books.find((b) => b.id === targetBookId);
    if (!src || !tgt) {
      res.status(404).json({ error: 'Both books must exist to link editions.' });
      return;
    }
    tgt.editionGroupId = src.editionGroupId;
    tgt.updatedAt = new Date().toISOString();
    appendAuditLog(db, req.authUser!, 'EDITIONS_LINKED', 'book', tgt.id, `Linked "${tgt.title}" into group ${src.editionGroupId}`);
    saveDb(db);
    res.json({ editionGroupId: src.editionGroupId });
  });

  // Bulk CSV/JSON metadata import with progress & error report
  app.post('/api/admin/books/bulk-import', requirePerm('books.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'Provide an array of book metadata rows.' });
      return;
    }
    const errors: { row: number; message: string }[] = [];
    let successCount = 0;
    const now = new Date().toISOString();

    rows.forEach((row: Record<string, unknown>, idx: number) => {
      const title = String(row.title || '').trim();
      const isbn = String(row.isbn || '').trim();
      const rightsHolder = String(row.rightsHolder || '').trim();
      const licenseNumber = String(row.licenseNumber || '').trim();
      if (!title || !isbn) {
        errors.push({ row: idx + 1, message: 'Missing required title or ISBN.' });
        return;
      }
      if (!rightsHolder || !licenseNumber) {
        errors.push({ row: idx + 1, message: 'Missing rightsHolder or licenseNumber (imported blocked).' });
        return;
      }
      const newBook: Book = {
        id: `bk-${crypto.randomUUID().slice(0, 8)}`,
        editionGroupId: String(row.editionGroupId || `grp-${crypto.randomUUID().slice(0, 6)}`),
        title,
        subtitle: String(row.subtitle || 'Imported Curriculum Edition'),
        author: String(row.author || 'Curriculum Board'),
        publisher: rightsHolder,
        editionLabel: String(row.editionLabel || '2026 Edition'),
        academicYear: String(row.academicYear || '2026-27'),
        isbn,
        description: String(row.description || 'Imported via admin bulk metadata pipeline.'),
        coverUrl: '/src/assets/images/cover_literature_1795146976453.jpg',
        format: 'reflowable',
        classId: String(row.classId || 'cls-10'),
        boardId: String(row.boardId || 'brd-cbse'),
        subjectId: String(row.subjectId || 'sub-math'),
        contentLanguageCode: String(row.contentLanguageCode || 'hi'),
        status: 'draft',
        isFree: Boolean(row.isFree ?? true),
        price: Number(row.price || 0),
        currency: db.config.currency,
        previewPagesCount: 2,
        totalPages: 1,
        pages: [
          {
            pageNumber: 1,
            chapterTitle: 'Chapter 1: Overview',
            heading: title,
            body: String(row.sampleContent || `Curriculum material for ${title}.`),
          },
        ],
        license: {
          rightsHolder,
          licenseType: 'publisher_direct',
          licenseNumber,
          distributionPermissionGranted: Boolean(row.distributionPermissionGranted),
          validFrom: now,
          validUntil: new Date(Date.now() + 365 * 86400000).toISOString(),
          allowOfflineDownload: Boolean(row.allowOfflineDownload),
          allowPrinting: false,
          territoryCountries: [db.config.targetCountry],
        },
        learningResources: [],
        readCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.books.unshift(newBook);
      successCount += 1;
    });

    const job = {
      id: `blk-${crypto.randomUUID().slice(0, 8)}`,
      createdBy: req.authUser!.name,
      totalRows: rows.length,
      processedRows: rows.length,
      successCount,
      errorCount: errors.length,
      errors,
      status: (errors.length > 0 ? 'partial_error' : 'completed') as 'completed' | 'partial_error',
      createdAt: now,
    };
    db.bulkImportJobs.unshift(job);
    appendAuditLog(db, req.authUser!, 'BULK_IMPORT', 'book', job.id, `Imported ${successCount}/${rows.length} rows`);
    saveDb(db);
    res.status(201).json({ job });
  });

  // Taxonomies (Boards, Classes, Subjects, Content Languages, UI Languages)
  app.post('/api/admin/taxonomies/:type', requirePerm('taxonomies.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const { type } = req.params;
    const body = req.body || {};
    if (type === 'boards') {
      const item = {
        id: `brd-${crypto.randomUUID().slice(0, 6)}`,
        code: String(body.code || '').toUpperCase().trim(),
        name: String(body.name || '').trim(),
        country: String(body.country || db.config.targetCountry),
        enabled: true,
      };
      if (!item.code || !item.name) return void res.status(400).json({ error: 'Code and name required.' });
      db.boards.push(item);
      saveDb(db);
      return void res.status(201).json({ item });
    }
    if (type === 'classes') {
      const item = {
        id: `cls-${crypto.randomUUID().slice(0, 6)}`,
        code: String(body.code || '').toUpperCase().trim(),
        name: String(body.name || '').trim(),
        order: Number(body.order || db.classes.length + 1),
        enabled: true,
      };
      if (!item.code || !item.name) return void res.status(400).json({ error: 'Code and name required.' });
      db.classes.push(item);
      saveDb(db);
      return void res.status(201).json({ item });
    }
    if (type === 'subjects') {
      const item = {
        id: `sub-${crypto.randomUUID().slice(0, 6)}`,
        name: String(body.name || '').trim(),
        category: String(body.category || 'Core'),
        enabled: true,
      };
      if (!item.name) return void res.status(400).json({ error: 'Subject name required.' });
      db.subjects.push(item);
      saveDb(db);
      return void res.status(201).json({ item });
    }
    if (type === 'contentLanguages') {
      const item = {
        code: String(body.code || '').toLowerCase().trim(),
        name: String(body.name || '').trim(),
        nativeName: String(body.nativeName || body.name || '').trim(),
        enabled: true,
      };
      if (!item.code || !item.name) return void res.status(400).json({ error: 'Code and name required.' });
      db.contentLanguages.push(item);
      saveDb(db);
      return void res.status(201).json({ item });
    }
    if (type === 'uiLanguages') {
      const item = {
        code: String(body.code || '').toLowerCase().trim(),
        name: String(body.name || '').trim(),
        nativeName: String(body.nativeName || body.name || '').trim(),
        enabled: true,
      };
      if (!item.code || !item.name) return void res.status(400).json({ error: 'Code and name required.' });
      db.uiLanguages.push(item);
      saveDb(db);
      return void res.status(201).json({ item });
    }
    res.status(400).json({ error: 'Unknown taxonomy type.' });
  });

  app.patch('/api/admin/taxonomies/:type/:id', requirePerm('taxonomies.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const { type, id } = req.params;
    const { enabled } = req.body || {};
    const toggle = <T extends { enabled: boolean }>(arr: T[], finder: (item: T) => boolean) => {
      const found = arr.find(finder);
      if (!found) return false;
      found.enabled = Boolean(enabled);
      return true;
    };
    let ok = false;
    if (type === 'boards') ok = toggle(db.boards, (x) => x.id === id);
    else if (type === 'classes') ok = toggle(db.classes, (x) => x.id === id);
    else if (type === 'subjects') ok = toggle(db.subjects, (x) => x.id === id);
    else if (type === 'contentLanguages') ok = toggle(db.contentLanguages, (x) => x.code === id);
    else if (type === 'uiLanguages') ok = toggle(db.uiLanguages, (x) => x.code === id);
    if (!ok) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }
    saveDb(db);
    res.json({ ok: true });
  });

  // Users, Roles, Tickets & Audit Logs
  app.get('/api/admin/users', requirePerm('users.manage'), (_req, res) => {
    const db = loadDb();
    const users = db.users.map((u) => ({
      ...toSafeUser(u),
      subscriptionsCount: db.subscriptions.filter((s) => s.userId === u.id && s.status === 'active').length,
      totalSpent: db.payments
        .filter((p) => p.userId === u.id && p.status === 'succeeded')
        .reduce((acc, p) => acc + p.totalAmount, 0),
    }));
    res.json({ users, rolePermissions: db.rolePermissions, tickets: db.tickets, bulkImportJobs: db.bulkImportJobs });
  });

  app.patch('/api/admin/users/:id/status', requirePerm('users.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (user.role === 'super_admin') {
      res.status(400).json({ error: 'Cannot suspend Super Admin.' });
      return;
    }
    user.status = req.body.status === 'suspended' ? 'suspended' : 'active';
    appendAuditLog(db, req.authUser!, 'USER_STATUS_CHANGED', 'user', user.id, `Status set to ${user.status}`);
    saveDb(db);
    res.json({ user: toSafeUser(user) });
  });

  app.post('/api/admin/users/:id/reset-password', requirePerm('users.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const newPassword = String(req.body.newPassword || 'Reset@2026');
    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    appendAuditLog(db, req.authUser!, 'PASSWORD_RESET', 'user', user.id, 'Admin initiated password reset');
    saveDb(db);
    res.json({ ok: true });
  });

  app.patch('/api/admin/roles/:roleId', requirePerm('roles.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const roleId = req.params.roleId as RoleId;
    if (!db.rolePermissions[roleId]) {
      res.status(404).json({ error: 'Role not found.' });
      return;
    }
    const permissions = Array.isArray(req.body.permissions) ? (req.body.permissions as Permission[]) : [];
    db.rolePermissions[roleId] = permissions;
    appendAuditLog(db, req.authUser!, 'ROLE_PERMISSIONS_UPDATED', 'role', roleId, `Updated permissions (${permissions.length})`);
    saveDb(db);
    res.json({ rolePermissions: db.rolePermissions });
  });

  app.patch('/api/admin/tickets/:id', requirePerm('users.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const ticket = db.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    if (['open', 'in_review', 'resolved'].includes(req.body.status)) {
      ticket.status = req.body.status;
    }
    saveDb(db);
    res.json({ ticket });
  });

  app.get('/api/admin/audit-logs', requirePerm('audit.view'), (_req, res) => {
    const db = loadDb();
    res.json({ auditLogs: db.auditLogs });
  });

  // Business Reports & CSV Export
  app.get('/api/admin/reports', requirePerm('reports.view'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const from = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : null;
    const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : null;

    const payments = db.payments.filter((p) => {
      const d = new Date(p.createdAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    const succeeded = payments.filter((p) => p.status === 'succeeded');
    const failed = payments.filter((p) => p.status === 'failed');
    const totalRevenue = succeeded.reduce((acc, p) => acc + p.totalAmount, 0);
    const activeSubscriptions = db.subscriptions.filter((s) => s.status === 'active').length;
    const expiringSoon = db.subscriptions.filter((s) => {
      const days = (new Date(s.expiresAt).getTime() - Date.now()) / 86400000;
      return s.status === 'active' && days <= 45;
    }).length;

    const usageByLanguage: Record<string, number> = {};
    const usageByBoard: Record<string, number> = {};
    db.books.forEach((b) => {
      usageByLanguage[b.contentLanguageCode] = (usageByLanguage[b.contentLanguageCode] || 0) + b.readCount;
      usageByBoard[b.boardId] = (usageByBoard[b.boardId] || 0) + b.readCount;
    });

    const popularBooks = [...db.books]
      .filter((b) => b.status === 'published')
      .sort((a, b) => b.readCount - a.readCount)
      .slice(0, 6)
      .map((b) => ({
        id: b.id,
        title: b.title,
        contentLanguageCode: b.contentLanguageCode,
        boardId: b.boardId,
        readCount: b.readCount,
      }));

    res.json({
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        succeededCount: succeeded.length,
        failedCount: failed.length,
        activeSubscriptions,
        expiringSoon,
        publishedBooks: db.books.filter((b) => b.status === 'published').length,
        totalUsers: db.users.length,
      },
      payments,
      popularBooks,
      usageByLanguage,
      usageByBoard,
      coupons: db.coupons,
      plans: db.plans,
    });
  });

  app.get('/api/admin/reports/export.csv', requirePerm('reports.view'), (_req, res) => {
    const db = loadDb();
    const header = 'Invoice,Date,User,Plan,Provider,Subtotal,Discount,Tax,Total,Currency,Status';
    const lines = db.payments.map((p) =>
      [
        p.invoiceNumber,
        p.createdAt.slice(0, 10),
        `"${p.userName.replace(/"/g, '""')}"`,
        `"${p.planName.replace(/"/g, '""')}"`,
        `"${p.provider.replace(/"/g, '""')}"`,
        p.subtotal,
        p.discountAmount,
        p.taxAmount,
        p.totalAmount,
        p.currency,
        p.status,
      ].join(',')
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vidyakosha-payments-report.csv"');
    res.send([header, ...lines].join('\n'));
  });

  // App Configuration, Plans, Coupons, Backups
  app.patch('/api/admin/config', requirePerm('config.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const patch = req.body || {};
    db.config = {
      ...db.config,
      ...patch,
      legalPages: patch.legalPages ? { ...db.config.legalPages, ...patch.legalPages } : db.config.legalPages,
    };
    appendAuditLog(db, req.authUser!, 'CONFIG_UPDATED', 'config', 'app', 'Updated platform branding/pricing/legal config');
    saveDb(db);
    res.json({ config: db.config });
  });

  app.post('/api/admin/plans', requirePerm('config.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const body = req.body || {};
    const plan: SubscriptionPlan = {
      id: `plan-${crypto.randomUUID().slice(0, 6)}`,
      name: String(body.name || '').trim(),
      description: String(body.description || '').trim(),
      scopeType: body.scopeType || 'board_class',
      boardId: body.boardId || undefined,
      classId: body.classId || undefined,
      subjectId: body.subjectId || undefined,
      durationDays: Number(body.durationDays || 365),
      price: Number(body.price || 499),
      currency: db.config.currency,
      taxRatePercent: Number(body.taxRatePercent ?? db.config.taxRatePercent),
      features: Array.isArray(body.features) ? body.features : ['1-Year Full Access', 'Synced Annotations'],
      active: true,
    };
    if (!plan.name) {
      res.status(400).json({ error: 'Plan name required.' });
      return;
    }
    db.plans.push(plan);
    saveDb(db);
    res.status(201).json({ plan });
  });

  app.post('/api/admin/coupons', requirePerm('config.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const body = req.body || {};
    const coupon: Coupon = {
      id: `cpn-${crypto.randomUUID().slice(0, 6)}`,
      code: String(body.code || '').toUpperCase().trim(),
      discountPercent: Number(body.discountPercent || 10),
      maxDiscountAmount: Number(body.maxDiscountAmount || 200),
      active: true,
      expiresAt: String(body.expiresAt || '2028-12-31T23:59:59.000Z'),
    };
    if (!coupon.code) {
      res.status(400).json({ error: 'Coupon code required.' });
      return;
    }
    db.coupons.push(coupon);
    saveDb(db);
    res.status(201).json({ coupon });
  });

  app.get('/api/admin/backup', requirePerm('backups.manage'), (req: AuthedRequest, res) => {
    const db = loadDb();
    appendAuditLog(db, req.authUser!, 'BACKUP_EXPORTED', 'system', 'db.json', 'Exported full database snapshot');
    saveDb(db);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="vidyakosha-backup.json"');
    res.send(JSON.stringify(db, null, 2));
  });

  app.post('/api/admin/restore', requirePerm('backups.manage'), (req: AuthedRequest, res) => {
    const candidate = req.body as DatabaseSchema;
    if (!candidate || !Array.isArray(candidate.users) || !Array.isArray(candidate.books) || !candidate.config) {
      res.status(400).json({ error: 'Invalid backup snapshot structure.' });
      return;
    }
    appendAuditLog(candidate, req.authUser!, 'BACKUP_RESTORED', 'system', 'db.json', 'Restored full database snapshot');
    saveDb(candidate);
    res.json({ restored: true });
  });

  // Vite / Static Frontend Serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.VIDYAKOSHA_DIST_DIR
      ? path.resolve(process.env.VIDYAKOSHA_DIST_DIR)
      : path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const host = process.env.HOST || '0.0.0.0';
  app.listen(PORT, host, () => {
    console.log(`VidyaKosha server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
