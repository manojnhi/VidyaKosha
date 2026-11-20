export type TranslationKey =
  | 'nav.library'
  | 'nav.myLearning'
  | 'nav.plans'
  | 'nav.resources'
  | 'nav.help'
  | 'nav.admin'
  | 'nav.parent'
  | 'nav.teacher'
  | 'action.signIn'
  | 'action.signOut'
  | 'action.openReader'
  | 'action.previewBook'
  | 'action.subscribe'
  | 'action.save'
  | 'action.cancel'
  | 'action.resetFilters'
  | 'action.installApp'
  | 'action.switchBook'
  | 'action.closeReader'
  | 'action.downloadOffline'
  | 'action.offlineSaved'
  | 'action.listenAudio'
  | 'onboarding.chooseUiLang'
  | 'onboarding.subtitle'
  | 'onboarding.continue'
  | 'onboarding.skipDemo'
  | 'onboarding.classLabel'
  | 'onboarding.boardLabel'
  | 'onboarding.contentLangLabel'
  | 'hero.title'
  | 'hero.desc'
  | 'hero.ctaBrowse'
  | 'hero.ctaPlans'
  | 'filter.searchPlaceholder'
  | 'filter.allClasses'
  | 'filter.allBoards'
  | 'filter.allSubjects'
  | 'filter.allLanguages'
  | 'filter.allYears'
  | 'filter.freeOnly'
  | 'book.free'
  | 'book.paid'
  | 'book.previewPages'
  | 'book.pages'
  | 'book.contentLanguage'
  | 'book.availableEditions'
  | 'book.editionUnavailable'
  | 'book.licenseVerified'
  | 'book.offlineAllowed'
  | 'book.offlineRestricted'
  | 'reader.toc'
  | 'reader.thumbnails'
  | 'reader.searchPlaceholder'
  | 'reader.themeLight'
  | 'reader.themeSepia'
  | 'reader.themeDark'
  | 'reader.fitWidth'
  | 'reader.fitPage'
  | 'reader.bookmarkPage'
  | 'reader.bookmarked'
  | 'reader.toolRead'
  | 'reader.toolHighlight'
  | 'reader.toolUnderline'
  | 'reader.toolPen'
  | 'reader.toolNote'
  | 'reader.toolEraser'
  | 'reader.undo'
  | 'reader.redo'
  | 'reader.saveMarks'
  | 'reader.marksSaved'
  | 'reader.previewWallTitle'
  | 'reader.previewWallDesc'
  | 'reader.editionSwitch'
  | 'reader.speakPage'
  | 'reader.stopSpeak'
  | 'reader.audioMode'
  | 'reader.audioPlay'
  | 'reader.audioPause'
  | 'reader.audioPrevLine'
  | 'reader.audioNextLine'
  | 'reader.audioSpeed'
  | 'reader.audioVoice'
  | 'reader.audioAutoPage'
  | 'reader.audioReadAlongFallback'
  | 'checkout.title'
  | 'checkout.couponPlaceholder'
  | 'checkout.applyCoupon'
  | 'checkout.subtotal'
  | 'checkout.discount'
  | 'checkout.tax'
  | 'checkout.total'
  | 'checkout.payNow'
  | 'checkout.receiptTitle'
  | 'checkout.cardNotice'
  | 'role.super_admin'
  | 'role.admin'
  | 'role.student'
  | 'role.parent'
  | 'role.teacher'
  | 'profile.title'
  | 'profile.uiLanguage'
  | 'profile.academicPrefs'
  | 'profile.exportData'
  | 'profile.deleteAccount'
  | 'support.reportIssue'
  | 'admin.dashboard'
  | 'admin.books'
  | 'admin.taxonomies'
  | 'admin.users'
  | 'admin.reports'
  | 'admin.config'
  | 'admin.architecture';

export const TRANSLATIONS: Record<string, Record<TranslationKey, string>> = {
  hi: {
    'nav.library': 'पुस्तकालय',
    'nav.myLearning': 'मेरा अध्ययन',
    'nav.plans': 'सब्सक्रिप्शन',
    'nav.resources': 'अभ्यास सामग्री',
    'nav.help': 'सहायता',
    'nav.admin': 'एडमिन पैनल',
    'nav.parent': 'अभिभावक पैनल',
    'nav.teacher': 'शिक्षक पैनल',
    'action.signIn': 'लॉगिन / खाता',
    'action.signOut': 'लॉगआउट',
    'action.openReader': 'किताब खोलें',
    'action.previewBook': 'मुफ़्त प्रीव्यू पढ़ें',
    'action.subscribe': 'प्लान लें / अनलॉक करें',
    'action.save': 'सहेजें',
    'action.cancel': 'रद्द करें',
    'action.resetFilters': 'फ़िल्टर रीसेट करें',
    'action.installApp': 'ऐप इंस्टॉल करें',
    'action.switchBook': 'किताब बदलें',
    'action.closeReader': 'रीडर बंद करें',
    'action.downloadOffline': 'ऑफ़लाइन सहेजें',
    'action.offlineSaved': 'ऑफ़लाइन उपलब्ध',
    'action.listenAudio': 'ऑडियो सुनें',
    'onboarding.chooseUiLang': 'अपनी ऐप भाषा चुनें',
    'onboarding.subtitle': 'ऐप के मेनू, बटन और संदेश इस भाषा में दिखेंगे। किताब की सामग्री भाषा आप अलग से चुन सकते हैं।',
    'onboarding.continue': 'जारी रखें',
    'onboarding.skipDemo': 'सीधे डेमो पुस्तकालय खोलें',
    'onboarding.classLabel': 'कक्षा चुनें',
    'onboarding.boardLabel': 'शिक्षा बोर्ड चुनें',
    'onboarding.contentLangLabel': 'किताब की पसंदीदा भाषा',
    'hero.title': 'नर्सरी से कक्षा 12 तक की प्रमाणित डिजिटल किताबें',
    'hero.desc': 'अपनी कक्षा, शिक्षा बोर्ड और पसंदीदा भाषा चुनें। बिना किसी व्यवधान के पढ़ें, नोट्स लिखें और ऑफ़लाइन अध्ययन करें।',
    'hero.ctaBrowse': 'किताबें खोजें',
    'hero.ctaPlans': 'वार्षिक प्लान देखें',
    'filter.searchPlaceholder': 'शीर्षक, लेखक या ISBN से खोजें...',
    'filter.allClasses': 'सभी कक्षाएँ',
    'filter.allBoards': 'सभी बोर्ड',
    'filter.allSubjects': 'सभी विषय',
    'filter.allLanguages': 'सभी किताब भाषाएँ',
    'filter.allYears': 'सभी सत्र',
    'filter.freeOnly': 'केवल मुफ़्त किताबें',
    'book.free': 'मुफ़्त',
    'book.paid': 'सब्सक्रिप्शन',
    'book.previewPages': 'प्रीव्यू पृष्ठ',
    'book.pages': 'पृष्ठ',
    'book.contentLanguage': 'सामग्री भाषा',
    'book.availableEditions': 'उपलब्ध भाषा संस्करण',
    'book.editionUnavailable': 'इस किताब का चुनी हुई भाषा में आधिकारिक संस्करण उपलब्ध नहीं है। मूल किताब का स्वचालित अनुवाद नहीं दिखाया जाता।',
    'book.licenseVerified': 'वितरण अधिकार सत्यापित',
    'book.offlineAllowed': 'ऑफ़लाइन रीडिंग अनुमत',
    'book.offlineRestricted': 'लाइसेंस अनुसार केवल ऑनलाइन',
    'reader.toc': 'विषय-सूची',
    'reader.thumbnails': 'पृष्ठ झलक',
    'reader.searchPlaceholder': 'किताब में शब्द खोजें...',
    'reader.themeLight': 'लाइट',
    'reader.themeSepia': 'सेपिया',
    'reader.themeDark': 'डार्क',
    'reader.fitWidth': 'चौड़ाई फ़िट',
    'reader.fitPage': 'पृष्ठ फ़िट',
    'reader.bookmarkPage': 'बुकमार्क करें',
    'reader.bookmarked': 'बुकमार्क किया गया',
    'reader.toolRead': 'पढ़ें / स्वाइप',
    'reader.toolHighlight': 'हाइलाइट',
    'reader.toolUnderline': 'अंडरलाइन',
    'reader.toolPen': 'पेन ड्रॉइंग',
    'reader.toolNote': 'नोट जोड़ें',
    'reader.toolEraser': 'इरेज़र',
    'reader.undo': 'पूर्ववत',
    'reader.redo': 'फिर से',
    'reader.saveMarks': 'नोट्स सहेजें',
    'reader.marksSaved': 'सहेजा गया',
    'reader.previewWallTitle': 'निःशुल्क प्रीव्यू समाप्त हुआ',
    'reader.previewWallDesc': 'पूरी किताब, सभी अभ्यास पत्र और ऑफ़लाइन रीडिंग अनलॉक करने के लिए वार्षिक सब्सक्रिप्शन चुनें।',
    'reader.editionSwitch': 'संस्करण भाषा',
    'reader.speakPage': 'पढ़कर सुनाएँ',
    'reader.stopSpeak': 'आवाज़ रोकें',
    'reader.audioMode': 'ऑडियो बुक मोड',
    'reader.audioPlay': 'सुनें',
    'reader.audioPause': 'रोकें',
    'reader.audioPrevLine': 'पिछली पंक्ति',
    'reader.audioNextLine': 'अगली पंक्ति',
    'reader.audioSpeed': 'गति',
    'reader.audioVoice': 'आवाज़',
    'reader.audioAutoPage': 'अगला पृष्ठ स्वतः',
    'reader.audioReadAlongFallback': 'ब्राउज़र में वॉइस इंजन न मिलने पर रीड-अलॉन्ग हाइलाइट मोड चल रहा है (Chrome/Android पर आवाज़ सहित चलेगा)',
    'checkout.title': 'सुरक्षित वार्षिक सब्सक्रिप्शन चेकआउट',
    'checkout.couponPlaceholder': 'कूपन कोड (जैसे VIDYA20)',
    'checkout.applyCoupon': 'लागू करें',
    'checkout.subtotal': 'मूल्य',
    'checkout.discount': 'छूट',
    'checkout.tax': 'कर',
    'checkout.total': 'कुल देय राशि',
    'checkout.payNow': 'भुगतान पूरा करें',
    'checkout.receiptTitle': 'भुगतान रसीद एवं इनवॉइस',
    'checkout.cardNotice': 'सुरक्षा नीति: भुगतान कार्ड विवरण हमारे सर्वर पर कभी सहेजे नहीं जाते; लेन-देन कॉन्फ़िगर किए गए पेमेंट गेटवे टोकन से होता है।',
    'role.super_admin': 'सुपर एडमिन',
    'role.admin': 'एडमिन / कंटेंट मैनेजर',
    'role.student': 'विद्यार्थी',
    'role.parent': 'अभिभावक',
    'role.teacher': 'शिक्षक',
    'profile.title': 'प्रोफ़ाइल और भाषा सेटिंग्स',
    'profile.uiLanguage': 'ऐप इंटरफ़ेस भाषा',
    'profile.academicPrefs': 'कक्षा व बोर्ड प्राथमिकताएँ',
    'profile.exportData': 'मेरा डेटा निर्यात करें (JSON)',
    'profile.deleteAccount': 'खाता हटाने का अनुरोध',
    'support.reportIssue': 'सामग्री त्रुटि रिपोर्ट करें',
    'admin.dashboard': 'सारांश',
    'admin.books': 'किताबें और लाइसेंस',
    'admin.taxonomies': 'बोर्ड, कक्षा, भाषाएँ',
    'admin.users': 'उपयोगकर्ता और ऑडिट',
    'admin.reports': 'बिक्री और उपयोग रिपोर्ट',
    'admin.config': 'ऐप कॉन्फ़िगरेशन व बैकअप',
    'admin.architecture': 'सिस्टम आर्किटेक्चर व वायरफ़्रेम',
  },
  en: {
    'nav.library': 'Library',
    'nav.myLearning': 'My Learning',
    'nav.plans': 'Plans',
    'nav.resources': 'Worksheets',
    'nav.help': 'Help & Legal',
    'nav.admin': 'Admin Panel',
    'nav.parent': 'Parent View',
    'nav.teacher': 'Teacher View',
    'action.signIn': 'Sign In',
    'action.signOut': 'Sign Out',
    'action.openReader': 'Open Reader',
    'action.previewBook': 'Read Free Preview',
    'action.subscribe': 'Subscribe & Unlock',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.resetFilters': 'Reset Filters',
    'action.installApp': 'Install App',
    'action.switchBook': 'Switch Book',
    'action.closeReader': 'Exit Reader',
    'action.downloadOffline': 'Save Offline',
    'action.offlineSaved': 'Available Offline',
    'action.listenAudio': 'Listen Audio',
    'onboarding.chooseUiLang': 'Choose Your App Language',
    'onboarding.subtitle': 'Menus, buttons, and notifications appear in this language. Book content languages remain independent.',
    'onboarding.continue': 'Continue',
    'onboarding.skipDemo': 'Open Library Directly',
    'onboarding.classLabel': 'Select Class',
    'onboarding.boardLabel': 'Select Education Board',
    'onboarding.contentLangLabel': 'Preferred Book Content Language',
    'hero.title': 'Verified Digital Textbooks from Nursery to Class 12',
    'hero.desc': 'Filter by class, board, and authentic language editions. Read distraction-free, annotate pages, and sync offline.',
    'hero.ctaBrowse': 'Browse Textbooks',
    'hero.ctaPlans': 'View Annual Plans',
    'filter.searchPlaceholder': 'Search by title, author, or ISBN...',
    'filter.allClasses': 'All Classes',
    'filter.allBoards': 'All Boards',
    'filter.allSubjects': 'All Subjects',
    'filter.allLanguages': 'All Book Languages',
    'filter.allYears': 'All Years',
    'filter.freeOnly': 'Free Books Only',
    'book.free': 'Free',
    'book.paid': 'Subscription',
    'book.previewPages': 'Preview Pages',
    'book.pages': 'Pages',
    'book.contentLanguage': 'Content Language',
    'book.availableEditions': 'Available Language Editions',
    'book.editionUnavailable': 'No official edition exists for this book in the selected language. Content is never auto-translated.',
    'book.licenseVerified': 'Distribution Rights Verified',
    'book.offlineAllowed': 'Offline Reading Permitted',
    'book.offlineRestricted': 'Online Only per License',
    'reader.toc': 'Contents',
    'reader.thumbnails': 'Thumbnails',
    'reader.searchPlaceholder': 'Search inside book...',
    'reader.themeLight': 'Light',
    'reader.themeSepia': 'Sepia',
    'reader.themeDark': 'Dark',
    'reader.fitWidth': 'Fit Width',
    'reader.fitPage': 'Fit Page',
    'reader.bookmarkPage': 'Bookmark',
    'reader.bookmarked': 'Bookmarked',
    'reader.toolRead': 'Read / Swipe',
    'reader.toolHighlight': 'Highlight',
    'reader.toolUnderline': 'Underline',
    'reader.toolPen': 'Pen Draw',
    'reader.toolNote': 'Add Note',
    'reader.toolEraser': 'Eraser',
    'reader.undo': 'Undo',
    'reader.redo': 'Redo',
    'reader.saveMarks': 'Save Marks',
    'reader.marksSaved': 'Saved',
    'reader.previewWallTitle': 'Free Preview Limit Reached',
    'reader.previewWallDesc': 'Unlock the full book, practice worksheets, and licensed offline reading with a 1-year subscription.',
    'reader.editionSwitch': 'Edition Language',
    'reader.speakPage': 'Read Aloud',
    'reader.stopSpeak': 'Stop Audio',
    'reader.audioMode': 'Audio Mode',
    'reader.audioPlay': 'Play',
    'reader.audioPause': 'Pause',
    'reader.audioPrevLine': 'Previous line',
    'reader.audioNextLine': 'Next line',
    'reader.audioSpeed': 'Speed',
    'reader.audioVoice': 'Voice',
    'reader.audioAutoPage': 'Auto-next page',
    'reader.audioReadAlongFallback': 'Read-along highlight mode active (device speech voice unavailable in this browser)',
    'checkout.title': 'Secure Annual Subscription Checkout',
    'checkout.couponPlaceholder': 'Coupon code (e.g. VIDYA20)',
    'checkout.applyCoupon': 'Apply',
    'checkout.subtotal': 'Subtotal',
    'checkout.discount': 'Discount',
    'checkout.tax': 'Tax',
    'checkout.total': 'Total Payable',
    'checkout.payNow': 'Complete Payment',
    'checkout.receiptTitle': 'Payment Receipt & Invoice',
    'checkout.cardNotice': 'Security policy: Payment card details are never stored on our servers; transactions use configurable provider tokens.',
    'role.super_admin': 'Super Admin',
    'role.admin': 'Admin / Content Manager',
    'role.student': 'Student',
    'role.parent': 'Parent',
    'role.teacher': 'Teacher',
    'profile.title': 'Profile & Language Settings',
    'profile.uiLanguage': 'App Interface Language',
    'profile.academicPrefs': 'Class & Board Preferences',
    'profile.exportData': 'Export My Data (JSON)',
    'profile.deleteAccount': 'Delete My Account',
    'support.reportIssue': 'Report Content Issue',
    'admin.dashboard': 'Overview',
    'admin.books': 'Books & Licensing',
    'admin.taxonomies': 'Boards, Classes & Languages',
    'admin.users': 'Users & Audit Logs',
    'admin.reports': 'Sales & Usage Reports',
    'admin.config': 'App Config & Backups',
    'admin.architecture': 'Architecture & Wireframes',
  },
  mr: {
    'nav.library': 'ग्रंथालय',
    'nav.myLearning': 'माझा अभ्यास',
    'nav.plans': 'सबस्क्रिप्शन',
    'nav.resources': 'सराव पत्रिका',
    'nav.help': 'मदत',
    'nav.admin': 'अॅडमिन पॅनेल',
    'nav.parent': 'पालक पॅनेल',
    'nav.teacher': 'शिक्षक पॅनेल',
    'action.signIn': 'लॉगिन',
    'action.signOut': 'लॉगआउट',
    'action.openReader': 'पुस्तक उघडा',
    'action.previewBook': 'मोफत नमुना वाचा',
    'action.subscribe': 'प्लॅन घ्या',
    'action.save': 'जतन करा',
    'action.cancel': 'रद्द करा',
    'action.resetFilters': 'फिल्टर रीसेट करा',
    'action.installApp': 'अॅप इंस्टॉल करा',
    'action.switchBook': 'पुस्तक बदला',
    'action.closeReader': 'रीडर बंद करा',
    'action.downloadOffline': 'ऑफलाइन जतन करा',
    'action.offlineSaved': 'ऑफलाइन उपलब्ध',
    'action.listenAudio': 'ऑडिओ ऐका',
    'onboarding.chooseUiLang': 'अॅपची भाषा निवडा',
    'onboarding.subtitle': 'मेनू आणि संदेश या भाषेत दिसतील. पुस्तकाची भाषा तुम्ही स्वतंत्रपणे निवडू शकता.',
    'onboarding.continue': 'पुढे जा',
    'onboarding.skipDemo': 'थेट ग्रंथालय उघडा',
    'onboarding.classLabel': 'इयत्ता निवडा',
    'onboarding.boardLabel': 'शिक्षण मंडळ निवडा',
    'onboarding.contentLangLabel': 'पुस्तकाची पसंतीची भाषा',
    'hero.title': 'नर्सरी ते इयत्ता १२ वी पर्यंतची प्रमाणित डिजिटल पुस्तके',
    'hero.desc': 'तुमची इयत्ता, मंडळ आणि अधिकृत भाषा आवृत्ती निवडा. शांतपणे वाचा आणि नोट्स लिहा.',
    'hero.ctaBrowse': 'पुस्तके पहा',
    'hero.ctaPlans': 'वार्षिक प्लॅन पहा',
    'filter.searchPlaceholder': 'शीर्षक, लेखक किंवा ISBN शोधा...',
    'filter.allClasses': 'सर्व इयत्ता',
    'filter.allBoards': 'सर्व मंडळे',
    'filter.allSubjects': 'सर्व विषय',
    'filter.allLanguages': 'सर्व पुस्तक भाषा',
    'filter.allYears': 'सर्व शैक्षणिक वर्षे',
    'filter.freeOnly': 'फक्त मोफत पुस्तके',
    'book.free': 'मोफत',
    'book.paid': 'सबस्क्रिप्शन',
    'book.previewPages': 'नमुना पाने',
    'book.pages': 'पाने',
    'book.contentLanguage': 'पुस्तक भाषा',
    'book.availableEditions': 'उपलब्ध भाषा आवृत्त्या',
    'book.editionUnavailable': 'निवडलेल्या भाषेत या पुस्तकाची अधिकृत आवृत्ती उपलब्ध नाही. स्वयंचलित भाषांतर दाखवले जात नाही.',
    'book.licenseVerified': 'वितरण हक्क प्रमाणित',
    'book.offlineAllowed': 'ऑफलाइन वाचन परवानगी',
    'book.offlineRestricted': 'फक्त ऑनलाइन वाचन',
    'reader.toc': 'अनुक्रमणिका',
    'reader.thumbnails': 'पानांचे नमुने',
    'reader.searchPlaceholder': 'पुस्तकात शोधा...',
    'reader.themeLight': 'लाइट',
    'reader.themeSepia': 'सेपिया',
    'reader.themeDark': 'डार्क',
    'reader.fitWidth': 'रुंदी फिट',
    'reader.fitPage': 'पान फिट',
    'reader.bookmarkPage': 'बुकमार्क करा',
    'reader.bookmarked': 'बुकमार्क केले',
    'reader.toolRead': 'वाचा / स्वाइप',
    'reader.toolHighlight': 'हायलाइट',
    'reader.toolUnderline': 'अधोरेखित',
    'reader.toolPen': 'पेन',
    'reader.toolNote': 'टीप जोडा',
    'reader.toolEraser': 'खोडरबर',
    'reader.undo': 'मागे',
    'reader.redo': 'पुढे',
    'reader.saveMarks': 'नोंदी जतन करा',
    'reader.marksSaved': 'जतन झाले',
    'reader.previewWallTitle': 'मोफत नमुना मर्यादा पूर्ण',
    'reader.previewWallDesc': 'संपूर्ण पुस्तक आणि ऑफलाइन वाचनासाठी वार्षिक सबस्क्रिप्शन निवडा.',
    'reader.editionSwitch': 'आवृत्ती भाषा',
    'reader.speakPage': 'ऐका',
    'reader.stopSpeak': 'थांबवा',
    'reader.audioMode': 'ऑडिओ मोड',
    'reader.audioPlay': 'ऐका',
    'reader.audioPause': 'थांबवा',
    'reader.audioPrevLine': 'मागील ओळ',
    'reader.audioNextLine': 'पुढील ओळ',
    'reader.audioSpeed': 'वेग',
    'reader.audioVoice': 'आवाज',
    'reader.audioAutoPage': 'पुढील पान आपोआप',
    'reader.audioReadAlongFallback': 'डिव्हाइस आवाज उपलब्ध नसल्याने रीड-अलॉन्ग हायलाइट मोड सुरू आहे',
    'checkout.title': 'सुरक्षित वार्षिक सबस्क्रिप्शन चेकआउट',
    'checkout.couponPlaceholder': 'कूपन कोड (उदा. VIDYA20)',
    'checkout.applyCoupon': 'लागू करा',
    'checkout.subtotal': 'किंमत',
    'checkout.discount': 'सवलत',
    'checkout.tax': 'कर',
    'checkout.total': 'एकूण रक्कम',
    'checkout.payNow': 'पेमेंट पूर्ण करा',
    'checkout.receiptTitle': 'पेमेंट पावती व इनव्हॉइस',
    'checkout.cardNotice': 'सुरक्षा नियम: कार्ड तपशील सर्व्हरवर साठवले जात नाहीत.',
    'role.super_admin': 'सुपर अॅडमिन',
    'role.admin': 'अॅडमिन',
    'role.student': 'विद्यार्थी',
    'role.parent': 'पालक',
    'role.teacher': 'शिक्षक',
    'profile.title': 'प्रोफाइल आणि भाषा सेटिंग्ज',
    'profile.uiLanguage': 'अॅप इंटरफेस भाषा',
    'profile.academicPrefs': 'इयत्ता आणि मंडळ पसंती',
    'profile.exportData': 'माझा डेटा डाउनलोड करा',
    'profile.deleteAccount': 'खाते हटवा',
    'support.reportIssue': 'सामग्री समस्या कळवा',
    'admin.dashboard': 'सारांश',
    'admin.books': 'पुस्तके व परवाने',
    'admin.taxonomies': 'मंडळे, इयत्ता, भाषा',
    'admin.users': 'वापरकर्ते व ऑडिट',
    'admin.reports': 'विक्री व वापर अहवाल',
    'admin.config': 'अॅप सेटिंग्ज व बॅकअप',
    'admin.architecture': 'आर्किटेक्चर व वायरफ्रेम',
  },
};

export function translate(
  langCode: string,
  key: TranslationKey,
  customOverrides?: Record<string, Record<string, string>>
): string {
  const custom = customOverrides?.[langCode]?.[key];
  if (custom && custom.trim().length > 0) return custom;
  const dict = TRANSLATIONS[langCode] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}
