export type RoleId = 'super_admin' | 'admin' | 'student' | 'parent' | 'teacher';

export type Permission =
  | 'books.manage'
  | 'books.publish'
  | 'taxonomies.manage'
  | 'users.manage'
  | 'roles.manage'
  | 'reports.view'
  | 'config.manage'
  | 'backups.manage'
  | 'audit.view'
  | 'reader.access'
  | 'parent.monitor'
  | 'teacher.assign';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: RoleId;
  status: 'active' | 'suspended';
  uiLanguageCode: string;
  preferredContentLanguageCode: string;
  classId?: string;
  boardId?: string;
  linkedChildId?: string;
  favoriteBookIds: string[];
  createdAt: string;
  lastLoginAt?: string;
}

export type SafeUser = Omit<User, 'passwordHash' | 'salt'>;

export interface AppLanguage {
  code: string;
  name: string;
  nativeName: string;
  enabled: boolean;
}

export interface ContentLanguage {
  code: string;
  name: string;
  nativeName: string;
  enabled: boolean;
}

export interface Board {
  id: string;
  code: string;
  name: string;
  country: string;
  enabled: boolean;
}

export interface ClassLevel {
  id: string;
  code: string;
  name: string;
  order: number;
  enabled: boolean;
}

export interface Subject {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
}

export interface LicenseRecord {
  rightsHolder: string;
  licenseType: 'public_domain' | 'open_oer' | 'publisher_direct' | 'institutional_contract';
  licenseNumber: string;
  distributionPermissionGranted: boolean;
  validFrom: string;
  validUntil: string;
  allowOfflineDownload: boolean;
  allowPrinting: boolean;
  territoryCountries: string[];
  verifiedByAdminId?: string;
  verifiedAt?: string;
}

export interface BookPage {
  pageNumber: number;
  chapterTitle: string;
  heading: string;
  body: string;
  keyPoints?: string[];
  diagramLabel?: string;
  imageUrl?: string;
  attachmentFileId?: string;
}

export interface LearningResource {
  id: string;
  title: string;
  type: 'worksheet' | 'sample_paper' | 'practice';
  chapter: string;
  summary: string;
}

export interface Book {
  id: string;
  editionGroupId: string;
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  editionLabel: string;
  academicYear: string;
  isbn: string;
  description: string;
  coverUrl: string;
  format: 'reflowable' | 'pdf' | 'epub' | 'image_pages';
  classId: string;
  boardId: string;
  subjectId: string;
  contentLanguageCode: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  scheduledPublishAt?: string;
  isFree: boolean;
  price: number;
  currency: string;
  previewPagesCount: number;
  totalPages: number;
  pages: BookPage[];
  pdfFileId?: string;
  pdfFileName?: string;
  pdfFileSizeBytes?: number;
  attachmentFileId?: string;
  attachmentFileName?: string;
  attachmentSizeBytes?: number;
  attachmentMimeType?: string;
  license: LicenseRecord;
  learningResources: LearningResource[];
  readCount: number;
  createdAt: string;
  updatedAt: string;
}

export type BookSummary = Omit<Book, 'pages'> & { pageCount: number };

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  scopeType: 'all_access' | 'board_class' | 'subject' | 'book';
  boardId?: string;
  classId?: string;
  subjectId?: string;
  bookId?: string;
  durationDays: number;
  price: number;
  currency: string;
  taxRatePercent: number;
  features: string[];
  active: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  maxDiscountAmount: number;
  active: boolean;
  expiresAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  scopeType: 'all_access' | 'board_class' | 'subject' | 'book';
  boardId?: string;
  classId?: string;
  subjectId?: string;
  bookId?: string;
  status: 'active' | 'expired' | 'cancelled';
  startsAt: string;
  expiresAt: string;
  autoRenew: boolean;
  paymentId: string;
}

export interface PaymentTransaction {
  id: string;
  invoiceNumber: string;
  userId: string;
  userName: string;
  planId: string;
  planName: string;
  provider: string;
  countryCode: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  couponCode?: string;
  status: 'succeeded' | 'failed' | 'refunded';
  failureReason?: string;
  createdAt: string;
}

export interface ReadingProgress {
  userId: string;
  bookId: string;
  editionGroupId: string;
  lastPage: number;
  totalPages: number;
  percentComplete: number;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  bookId: string;
  pageNumber: number;
  chapterTitle: string;
  label: string;
  createdAt: string;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface PenStroke {
  points: StrokePoint[];
  width: number;
  color: string;
}

export interface Annotation {
  id: string;
  userId: string;
  bookId: string;
  pageNumber: number;
  type: 'highlight' | 'underline' | 'note' | 'pen';
  color: string;
  textSelection?: string;
  noteText?: string;
  strokes?: PenStroke[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  roleTarget?: RoleId;
  title: string;
  message: string;
  category: 'book' | 'expiry' | 'announcement' | 'payment';
  read: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  type: 'support' | 'content_issue' | 'feedback';
  bookId?: string;
  bookTitle?: string;
  subject: string;
  message: string;
  status: 'open' | 'in_review' | 'resolved';
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: RoleId;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export interface BulkImportJob {
  id: string;
  createdBy: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
  status: 'completed' | 'partial_error';
  createdAt: string;
}

export interface PaymentProviderConfig {
  id: string;
  name: string;
  supportedCountries: string[];
  methodsLabel: string;
  enabled: boolean;
}

export interface AnnouncementBanner {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: string;
}

export interface AppConfig {
  appName: string;
  tagline: string;
  primaryColor: string;
  defaultUiLanguage: string;
  targetCountry: string;
  currency: string;
  currencySymbol: string;
  taxLabel: string;
  taxRatePercent: number;
  activePaymentProvider: string;
  paymentProviders: PaymentProviderConfig[];
  announcements: AnnouncementBanner[];
  legalPages: {
    refundPolicy: string;
    purchaseTerms: string;
    privacyPolicy: string;
  };
  customTranslations: Record<string, Record<string, string>>;
}

export interface DatabaseSchema {
  users: User[];
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
