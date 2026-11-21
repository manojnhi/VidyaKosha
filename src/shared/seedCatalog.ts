import type {
  Annotation,
  AppConfig,
  AppLanguage,
  AuditLogEntry,
  Board,
  Book,
  Bookmark,
  BulkImportJob,
  ClassLevel,
  ContentLanguage,
  Coupon,
  PaymentTransaction,
  Permission,
  ReadingProgress,
  RoleId,
  SafeUser,
  Subject,
  Subscription,
  SubscriptionPlan,
  SupportTicket,
  NotificationItem,
} from './types';

export const SEED_ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  super_admin: [
    'books.manage',
    'books.publish',
    'taxonomies.manage',
    'users.manage',
    'roles.manage',
    'reports.view',
    'config.manage',
    'backups.manage',
    'audit.view',
    'reader.access',
    'parent.monitor',
    'teacher.assign',
  ],
  admin: [
    'books.manage',
    'books.publish',
    'taxonomies.manage',
    'users.manage',
    'reports.view',
    'audit.view',
    'reader.access',
  ],
  student: ['reader.access'],
  parent: ['parent.monitor', 'reader.access'],
  teacher: ['reader.access', 'teacher.assign'],
};

export const SEED_SAFE_USERS: SafeUser[] = [];

export const SEED_CLASSES: ClassLevel[] = [
  { id: 'cls-nursery', code: 'NUR', name: 'Nursery', order: 1, enabled: true },
  { id: 'cls-lkg', code: 'LKG', name: 'LKG', order: 2, enabled: true },
  { id: 'cls-ukg', code: 'UKG', name: 'UKG', order: 3, enabled: true },
  ...Array.from({ length: 12 }, (_, idx) => {
    const n = idx + 1;
    return {
      id: `cls-${n}`,
      code: `C${n}`,
      name: `Class ${n}`,
      order: n + 3,
      enabled: true,
    };
  }),
];

export const SEED_UI_LANGUAGES: AppLanguage[] = [
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', enabled: true },
  { code: 'en', name: 'English', nativeName: 'English', enabled: true },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', enabled: true },
];

export const SEED_CONTENT_LANGUAGES: ContentLanguage[] = [
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', enabled: true },
  { code: 'en', name: 'English', nativeName: 'English', enabled: true },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', enabled: true },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', enabled: true },
];

export const SEED_BOARDS: Board[] = [
  { id: 'brd-cbse', code: 'CBSE', name: 'CBSE (Central Board)', country: 'IN', enabled: true },
  { id: 'brd-icse', code: 'ICSE', name: 'ICSE / ISC', country: 'IN', enabled: true },
  { id: 'brd-up', code: 'UPB', name: 'UP State Board', country: 'IN', enabled: true },
  { id: 'brd-mh', code: 'MSBSHSE', name: 'Maharashtra State Board', country: 'IN', enabled: true },
  { id: 'brd-rbse', code: 'RBSE', name: 'Rajasthan State Board', country: 'IN', enabled: true },
];

export const SEED_SUBJECTS: Subject[] = [
  { id: 'sub-early-num', name: 'Early Numeracy & Shapes', category: 'Pre-Primary', enabled: true },
  { id: 'sub-math', name: 'Mathematics', category: 'Core STEM', enabled: true },
  { id: 'sub-sci', name: 'Science / EVS', category: 'Core STEM', enabled: true },
  { id: 'sub-phy', name: 'Physics', category: 'Senior Secondary', enabled: true },
  { id: 'sub-hindi', name: 'Hindi Literature & Grammar', category: 'Languages', enabled: true },
  { id: 'sub-eng', name: 'English Literature & Grammar', category: 'Languages', enabled: true },
  { id: 'sub-sst', name: 'Social Science', category: 'Humanities', enabled: true },
  { id: 'sub-acc', name: 'Accountancy', category: 'Commerce', enabled: true },
];

export const SEED_BOOKS: Book[] = [];

export const SEED_PLANS: SubscriptionPlan[] = [];

export const SEED_COUPONS: Coupon[] = [];

export const SEED_SUBSCRIPTIONS: Subscription[] = [];

export const SEED_PAYMENTS: PaymentTransaction[] = [];

export const SEED_READING_PROGRESS: ReadingProgress[] = [];

export const SEED_BOOKMARKS: Bookmark[] = [];

export const SEED_ANNOTATIONS: Annotation[] = [];

export const SEED_NOTIFICATIONS: NotificationItem[] = [];

export const SEED_TICKETS: SupportTicket[] = [];

export const SEED_AUDIT_LOGS: AuditLogEntry[] = [];

export const SEED_BULK_IMPORT_JOBS: BulkImportJob[] = [];

export const SEED_CONFIG: AppConfig = {
  appName: 'VidyaKosha',
  tagline: 'प्रमाणित बहुभाषी डिजिटल पुस्तकालय · Nursery–Class 12',
  primaryColor: '#0F4C81',
  defaultUiLanguage: 'hi',
  targetCountry: 'IN',
  currency: 'INR',
  currencySymbol: '₹',
  taxLabel: 'GST',
  taxRatePercent: 18,
  activePaymentProvider: '',
  paymentProviders: [],
  announcements: [],
  legalPages: { refundPolicy: '', purchaseTerms: '', privacyPolicy: '' },
  customTranslations: {},
};
