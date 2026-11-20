import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCheckoutTotals,
  canPublishBook,
  checkBookAccess,
  filterBooksCatalog,
  hasPermission,
  resolveEditionSwitch,
} from './domainLogic';
import {
  estimateSegmentDurationMs,
  getNextAudioTarget,
  getSpeechLocale,
  pickPreferredVoice,
  splitPageIntoAudioSegments,
} from './audioUtils';
import type { Book, Coupon, Permission, RoleId, Subscription } from './types';
import { handleNativeLocalApi, resetNativeLocalDb } from '../utils/nativeLocalApi';
import { SEED_BOOKS } from './seedCatalog';

function makeSampleBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    editionGroupId: 'grp-math-10',
    title: 'Mathematics Class 10',
    subtitle: 'CBSE Core Textbook',
    author: 'Dr. R. K. Verma',
    publisher: 'VidyaKosha Academic Press',
    editionLabel: '2026 Edition',
    academicYear: '2026-27',
    isbn: '978-93-00001-01-1',
    description: 'Comprehensive curriculum textbook.',
    coverUrl: '/src/assets/images/cover_mathematics_1795146975787.jpg',
    format: 'reflowable',
    classId: 'cls-10',
    boardId: 'brd-cbse',
    subjectId: 'sub-math',
    contentLanguageCode: 'en',
    status: 'published',
    isFree: false,
    price: 299,
    currency: 'INR',
    previewPagesCount: 2,
    totalPages: 10,
    pages: [
      {
        pageNumber: 1,
        chapterTitle: 'Chapter 1: Real Numbers',
        heading: 'Euclid Division Lemma',
        body: 'Sample mathematical explanation.',
      },
    ],
    license: {
      rightsHolder: 'VidyaKosha Academic Press',
      licenseType: 'publisher_direct',
      licenseNumber: 'LIC-2026-001',
      distributionPermissionGranted: true,
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2028-12-31T00:00:00.000Z',
      allowOfflineDownload: true,
      allowPrinting: false,
      territoryCountries: ['IN'],
    },
    learningResources: [],
    readCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('canPublishBook blocks publishing without verified distribution permission or valid future license', () => {
  const validBook = makeSampleBook();
  assert.equal(canPublishBook(validBook, new Date('2026-06-01T00:00:00.000Z')).allowed, true);

  const unlicensedBook = makeSampleBook({
    license: {
      ...validBook.license,
      distributionPermissionGranted: false,
    },
  });
  const res1 = canPublishBook(unlicensedBook, new Date('2026-06-01T00:00:00.000Z'));
  assert.equal(res1.allowed, false);
  assert.ok(res1.reasons.some((r) => r.includes('Distribution permission')));

  const expiredBook = makeSampleBook({
    license: {
      ...validBook.license,
      validUntil: '2025-01-01T00:00:00.000Z',
    },
  });
  const res2 = canPublishBook(expiredBook, new Date('2026-06-01T00:00:00.000Z'));
  assert.equal(res2.allowed, false);
});

test('checkBookAccess enforces preview limit, subscription matching, and offline license control', () => {
  const paidBook = makeSampleBook({ isFree: false, previewPagesCount: 2, totalPages: 12 });
  const student = { id: 'u-stu-1', role: 'student' as RoleId };

  // Without subscription -> preview_only and no offline
  const previewRes = checkBookAccess(student, paidBook, [], new Date('2026-06-01T00:00:00.000Z'));
  assert.equal(previewRes.accessLevel, 'preview_only');
  assert.equal(previewRes.allowedPages, 2);
  assert.equal(previewRes.canOffline, false);

  // With matching active subscription -> full access + offline if license allows
  const sub: Subscription = {
    id: 'sub-1',
    userId: 'u-stu-1',
    planId: 'plan-1',
    planName: 'Class 10 CBSE Pass',
    scopeType: 'board_class',
    boardId: 'brd-cbse',
    classId: 'cls-10',
    status: 'active',
    startsAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    autoRenew: true,
    paymentId: 'pay-1',
  };
  const fullRes = checkBookAccess(student, paidBook, [sub], new Date('2026-06-01T00:00:00.000Z'));
  assert.equal(fullRes.accessLevel, 'full');
  assert.equal(fullRes.allowedPages, 12);
  assert.equal(fullRes.canOffline, true);
  assert.equal(fullRes.canPrint, false);
});

test('resolveEditionSwitch switches strictly between linked editions and never auto-translates unavailable languages', () => {
  const enBook = makeSampleBook({ id: 'b-en', contentLanguageCode: 'en', totalPages: 10 });
  const hiBook = makeSampleBook({
    id: 'b-hi',
    title: 'गणित कक्षा 10',
    contentLanguageCode: 'hi',
    totalPages: 20,
  });

  const switched = resolveEditionSwitch(enBook, 'hi', [enBook, hiBook], 5);
  assert.equal(switched.found, true);
  assert.equal(switched.targetBook?.id, 'b-hi');
  assert.equal(switched.mappedPage, 10);

  const unavailable = resolveEditionSwitch(enBook, 'ta', [enBook, hiBook], 5);
  assert.equal(unavailable.found, false);
  assert.equal(unavailable.reason, 'EDITION_UNAVAILABLE');
  assert.equal(unavailable.targetBook, undefined);
});

test('calculateCheckoutTotals applies coupon caps and tax accurately', () => {
  const coupon: Coupon = {
    id: 'c-1',
    code: 'VIDYA20',
    discountPercent: 20,
    maxDiscountAmount: 100,
    active: true,
    expiresAt: '2028-01-01T00:00:00.000Z',
  };

  const result = calculateCheckoutTotals(1000, coupon, 18, new Date('2026-06-01T00:00:00.000Z'));
  // 20% of 1000 = 200, capped at 100 -> taxable = 900, 18% GST = 162, total = 1062
  assert.equal(result.subtotal, 1000);
  assert.equal(result.discountAmount, 100);
  assert.equal(result.taxableAmount, 900);
  assert.equal(result.taxAmount, 162);
  assert.equal(result.totalAmount, 1062);
  assert.equal(result.couponApplied, true);
});

test('filterBooksCatalog filters published books across class, board, language, and search', () => {
  const books = [
    makeSampleBook({ id: '1', classId: 'cls-10', boardId: 'brd-cbse', contentLanguageCode: 'en', status: 'published' }),
    makeSampleBook({ id: '2', classId: 'cls-10', boardId: 'brd-cbse', contentLanguageCode: 'hi', status: 'draft' }),
    makeSampleBook({ id: '3', classId: 'cls-8', boardId: 'brd-icse', contentLanguageCode: 'hi', title: 'Science 8', status: 'published' }),
  ];

  const studentResults = filterBooksCatalog(books, { classId: 'cls-10', includeUnpublished: false });
  assert.equal(studentResults.length, 1);
  assert.equal(studentResults[0].id, '1');

  const adminResults = filterBooksCatalog(books, { classId: 'cls-10', includeUnpublished: true });
  assert.equal(adminResults.length, 2);
});

test('hasPermission checks RBAC map cleanly', () => {
  const map: Record<RoleId, Permission[]> = {
    super_admin: ['books.manage', 'roles.manage'],
    admin: ['books.manage'],
    student: ['reader.access'],
    parent: ['parent.monitor'],
    teacher: ['reader.access', 'teacher.assign'],
  };
  assert.equal(hasPermission('super_admin', map, 'roles.manage'), true);
  assert.equal(hasPermission('admin', map, 'roles.manage'), false);
  assert.equal(hasPermission('student', map, 'reader.access'), true);
});

test('splitPageIntoAudioSegments splits Hindi danda and English sentences with headings and keyPoints', () => {
  const segments = splitPageIntoAudioSegments({
    pageNumber: 1,
    chapterTitle: 'अध्याय 1: वास्तविक संख्याएँ',
    heading: 'यूक्लिड विभाजन प्रमेयिका',
    body: 'यह पहला वाक्य है। यह दूसरा वाक्य है।\nतीसरा पैराग्राफ यहाँ है।',
    keyPoints: ['मुख्य बिंदु 1'],
  });

  assert.equal(segments.length, 5);
  assert.equal(segments[0].kind, 'heading');
  assert.equal(segments[1].text, 'यह पहला वाक्य है।');
  assert.equal(segments[2].text, 'यह दूसरा वाक्य है।');
  assert.equal(segments[3].text, 'तीसरा पैराग्राफ यहाँ है।');
  assert.equal(segments[4].kind, 'keyPoint');
});

test('pickPreferredVoice and getNextAudioTarget handle locales and preview limits accurately', () => {
  assert.equal(getSpeechLocale('hi'), 'hi-IN');
  assert.equal(getSpeechLocale('mr'), 'mr-IN');

  const voices = [
    { name: 'English US', lang: 'en-US', default: true },
    { name: 'Hindi India', lang: 'hi-IN', default: false },
    { name: 'Marathi India', lang: 'mr-IN', default: false },
  ];
  assert.equal(pickPreferredVoice(voices, 'hi')?.name, 'Hindi India');
  assert.equal(pickPreferredVoice(voices, 'en')?.name, 'English US');

  // Next segment on same page
  assert.deepEqual(
    getNextAudioTarget({
      totalSegments: 4,
      currentSegmentIndex: 1,
      currentPage: 1,
      allowedPages: 2,
      totalBookPages: 10,
      accessLevel: 'preview_only',
      autoNextPage: true,
    }),
    { action: 'segment', nextIndex: 2 }
  );

  // Auto-advance to next allowed page
  assert.deepEqual(
    getNextAudioTarget({
      totalSegments: 4,
      currentSegmentIndex: 3,
      currentPage: 1,
      allowedPages: 2,
      totalBookPages: 10,
      accessLevel: 'preview_only',
      autoNextPage: true,
    }),
    { action: 'next_page', nextPage: 2 }
  );

  // Stop at preview limit
  assert.deepEqual(
    getNextAudioTarget({
      totalSegments: 4,
      currentSegmentIndex: 3,
      currentPage: 2,
      allowedPages: 2,
      totalBookPages: 10,
      accessLevel: 'preview_only',
      autoNextPage: true,
    }),
    { action: 'preview_limit' }
  );

  assert.ok(estimateSegmentDurationMs('One two three four five', 1) >= 1400);
});

test('handleNativeLocalApi serves full catalog, auth role switch, reader content, and bookmarks offline', async () => {
  resetNativeLocalDb();
  assert.ok(SEED_BOOKS.length >= 6);

  const boot = await handleNativeLocalApi<{ books?: unknown[]; uiLanguages: unknown[]; boards: unknown[] }>('/api/bootstrap');
  assert.ok(boot.uiLanguages.length >= 3);
  assert.ok(boot.boards.length >= 4);

  const catalog = await handleNativeLocalApi<{ books: { id: string }[] }>('/api/books');
  assert.ok(catalog.books.length >= 5);

  const switched = await handleNativeLocalApi<{ token: string; user: { id: string; role: string } }>(
    '/api/auth/demo-switch',
    { method: 'POST', body: JSON.stringify({ role: 'student' }) }
  );
  assert.equal(switched.user.role, 'student');
  assert.ok(switched.token.startsWith('native:'));

  const tokenRes = await handleNativeLocalApi<{ accessToken: string }>(
    '/api/books/bk-sci-8-en/access-token',
    { method: 'POST' },
    switched.token
  );
  const contentRes = await handleNativeLocalApi<{ pages: unknown[]; accessLevel: string }>(
    `/api/books/bk-sci-8-en/content?token=${encodeURIComponent(tokenRes.accessToken)}`,
    {},
    switched.token
  );
  assert.equal(contentRes.accessLevel, 'full');
  assert.ok(contentRes.pages.length >= 3);

  const bmRes = await handleNativeLocalApi<{ bookmark: { id: string; pageNumber: number } }>(
    '/api/reader/bookmarks',
    { method: 'POST', body: JSON.stringify({ bookId: 'bk-sci-8-en', pageNumber: 2, label: 'Force Notes' }) },
    switched.token
  );
  assert.equal(bmRes.bookmark.pageNumber, 2);
});

