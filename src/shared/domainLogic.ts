import type {
  Book,
  Coupon,
  Permission,
  RoleId,
  SafeUser,
  Subscription,
} from './types';

export interface PublishValidationResult {
  allowed: boolean;
  reasons: string[];
}

export function canPublishBook(
  book: Pick<Book, 'title' | 'pages' | 'license'>,
  now: Date = new Date()
): PublishValidationResult {
  const reasons: string[] = [];
  if (!book.title || book.title.trim().length < 2) {
    reasons.push('Book title is required.');
  }
  if (!book.pages || book.pages.length === 0) {
    reasons.push('At least one readable page is required before publishing.');
  }
  if (!book.license.distributionPermissionGranted) {
    reasons.push('Distribution permission must be explicitly granted and verified.');
  }
  if (!book.license.rightsHolder || book.license.rightsHolder.trim().length < 2) {
    reasons.push('Rights holder / publisher name is required.');
  }
  if (!book.license.licenseNumber || book.license.licenseNumber.trim().length < 2) {
    reasons.push('License reference number is required.');
  }
  const validUntil = new Date(book.license.validUntil);
  if (Number.isNaN(validUntil.getTime()) || validUntil.getTime() < now.getTime()) {
    reasons.push('License validity end date must be in the future.');
  }
  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export interface BookAccessResult {
  accessLevel: 'full' | 'preview_only';
  reason: 'free_book' | 'active_subscription' | 'staff_role' | 'preview_limit';
  allowedPages: number;
  canOffline: boolean;
  canPrint: boolean;
}

export function checkBookAccess(
  user: Pick<SafeUser, 'id' | 'role'> | null,
  book: Pick<Book, 'id' | 'isFree' | 'classId' | 'boardId' | 'subjectId' | 'previewPagesCount' | 'totalPages' | 'license'>,
  subscriptions: Subscription[],
  now: Date = new Date()
): BookAccessResult {
  const isStaff = user && (user.role === 'super_admin' || user.role === 'admin' || user.role === 'teacher');
  if (isStaff) {
    return {
      accessLevel: 'full',
      reason: 'staff_role',
      allowedPages: book.totalPages,
      canOffline: Boolean(book.license.allowOfflineDownload),
      canPrint: Boolean(book.license.allowPrinting),
    };
  }

  if (book.isFree) {
    return {
      accessLevel: 'full',
      reason: 'free_book',
      allowedPages: book.totalPages,
      canOffline: Boolean(book.license.allowOfflineDownload),
      canPrint: Boolean(book.license.allowPrinting),
    };
  }

  if (user) {
    const activeSub = subscriptions.find((sub) => {
      if (sub.userId !== user.id || sub.status !== 'active') return false;
      const exp = new Date(sub.expiresAt);
      if (Number.isNaN(exp.getTime()) || exp.getTime() < now.getTime()) return false;
      if (sub.scopeType === 'all_access') return true;
      if (sub.scopeType === 'book') return sub.bookId === book.id;
      if (sub.scopeType === 'subject') {
        const subjectMatch = sub.subjectId === book.subjectId;
        const boardMatch = !sub.boardId || sub.boardId === book.boardId;
        const classMatch = !sub.classId || sub.classId === book.classId;
        return subjectMatch && boardMatch && classMatch;
      }
      if (sub.scopeType === 'board_class') {
        const boardMatch = !sub.boardId || sub.boardId === book.boardId;
        const classMatch = !sub.classId || sub.classId === book.classId;
        return boardMatch && classMatch;
      }
      return false;
    });

    if (activeSub) {
      return {
        accessLevel: 'full',
        reason: 'active_subscription',
        allowedPages: book.totalPages,
        canOffline: Boolean(book.license.allowOfflineDownload),
        canPrint: Boolean(book.license.allowPrinting),
      };
    }
  }

  return {
    accessLevel: 'preview_only',
    reason: 'preview_limit',
    allowedPages: Math.max(1, Math.min(book.previewPagesCount, book.totalPages)),
    canOffline: false,
    canPrint: false,
  };
}

export interface EditionSwitchResult {
  found: boolean;
  targetBook?: Book;
  mappedPage: number;
  reason?: 'EDITION_UNAVAILABLE';
}

/**
 * Strictly switches between explicitly linked editions of the same book.
 * Never auto-translates content from another language.
 */
export function resolveEditionSwitch(
  currentBook: Book,
  targetLanguageCode: string,
  allBooks: Book[],
  currentPage: number,
  includeUnpublished: boolean = false
): EditionSwitchResult {
  if (currentBook.contentLanguageCode === targetLanguageCode) {
    return {
      found: true,
      targetBook: currentBook,
      mappedPage: Math.min(currentBook.totalPages, Math.max(1, currentPage)),
    };
  }

  const candidate = allBooks.find(
    (b) =>
      b.editionGroupId === currentBook.editionGroupId &&
      b.contentLanguageCode === targetLanguageCode &&
      (includeUnpublished || b.status === 'published')
  );

  if (!candidate) {
    return {
      found: false,
      mappedPage: currentPage,
      reason: 'EDITION_UNAVAILABLE',
    };
  }

  const ratio = currentBook.totalPages > 0 ? currentPage / currentBook.totalPages : 1;
  const mappedPage = Math.min(candidate.totalPages, Math.max(1, Math.round(ratio * candidate.totalPages)));

  return {
    found: true,
    targetBook: candidate,
    mappedPage,
  };
}

export interface CheckoutCalculation {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  couponApplied: boolean;
  couponError?: string;
}

export function calculateCheckoutTotals(
  basePrice: number,
  coupon: Coupon | null | undefined,
  taxRatePercent: number,
  now: Date = new Date()
): CheckoutCalculation {
  const subtotal = Math.max(0, roundMoney(basePrice));
  let discountAmount = 0;
  let couponApplied = false;
  let couponError: string | undefined;

  if (coupon) {
    const exp = new Date(coupon.expiresAt);
    if (!coupon.active || Number.isNaN(exp.getTime()) || exp.getTime() < now.getTime()) {
      couponError = 'COUPON_EXPIRED_OR_INACTIVE';
    } else {
      const rawDiscount = (subtotal * coupon.discountPercent) / 100;
      discountAmount = roundMoney(Math.min(rawDiscount, coupon.maxDiscountAmount, subtotal));
      couponApplied = true;
    }
  }

  const taxableAmount = roundMoney(Math.max(0, subtotal - discountAmount));
  const taxAmount = roundMoney((taxableAmount * Math.max(0, taxRatePercent)) / 100);
  const totalAmount = roundMoney(taxableAmount + taxAmount);

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    totalAmount,
    couponApplied,
    couponError,
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface CatalogFilterCriteria {
  classId?: string;
  boardId?: string;
  subjectId?: string;
  contentLanguageCode?: string;
  academicYear?: string;
  search?: string;
  onlyFree?: boolean;
  includeUnpublished?: boolean;
}

export function filterBooksCatalog<
  T extends Pick<
    Book,
    | 'id'
    | 'title'
    | 'subtitle'
    | 'author'
    | 'isbn'
    | 'classId'
    | 'boardId'
    | 'subjectId'
    | 'contentLanguageCode'
    | 'academicYear'
    | 'isFree'
    | 'status'
  >,
>(books: T[], filters: CatalogFilterCriteria): T[] {
  const q = (filters.search || '').trim().toLowerCase();
  return books.filter((book) => {
    if (!filters.includeUnpublished && book.status !== 'published') return false;
    if (filters.classId && filters.classId !== 'all' && book.classId !== filters.classId) return false;
    if (filters.boardId && filters.boardId !== 'all' && book.boardId !== filters.boardId) return false;
    if (filters.subjectId && filters.subjectId !== 'all' && book.subjectId !== filters.subjectId) return false;
    if (
      filters.contentLanguageCode &&
      filters.contentLanguageCode !== 'all' &&
      book.contentLanguageCode !== filters.contentLanguageCode
    ) {
      return false;
    }
    if (filters.academicYear && filters.academicYear !== 'all' && book.academicYear !== filters.academicYear) {
      return false;
    }
    if (filters.onlyFree && !book.isFree) return false;
    if (q) {
      const hay = `${book.title} ${book.subtitle} ${book.author} ${book.isbn}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function hasPermission(
  role: RoleId | undefined | null,
  rolePermissions: Record<RoleId, Permission[]>,
  permission: Permission
): boolean {
  if (!role) return false;
  const perms = rolePermissions[role] || [];
  return perms.includes(permission);
}
