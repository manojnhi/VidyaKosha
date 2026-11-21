# VidyaKosha Digital Library

Multilingual K–12 digital textbook platform (Nursery to Class 12) with CBSE, ICSE, and State Board support, an interactive reader, role-based admin panel, and web/PWA/Windows/Android builds.

## Local Development

```bash
npm install
npm run dev
```

Runs on `http://localhost:3000`.

## Build Windows `.exe` & Android `.apk` on GitHub

Open your repository's **Actions** tab and run the latest **Build VidyaKosha (.apk & .exe)** workflow. Download the Android APK artifact and install it on the phone.

## Google Drive storage for book PDFs

Book PDFs up to 500 MB are uploaded in resumable 8 MB chunks to a private `VidyaKosha Books` folder in the connected Google Drive. The PDF stays private; students read it through VidyaKosha's access-controlled API. The app also restores and updates an AES-256-GCM encrypted database snapshot in that private folder after app database saves, so catalog and account data can survive Render Free restarts. Keep the Render `SESSION_SECRET` stable: it is used to decrypt the snapshot.

### Configure Google Drive once

1. In Google Cloud Console, create a project and enable **Google Drive API**. Billing is not required to enable the Drive API.
2. Configure the OAuth consent screen as External and add the library admin's Google account as a test user.
3. Create an OAuth client ID for a Web application. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI.
4. Open Google's OAuth 2.0 Playground. In Settings, enable **Use your own OAuth credentials**, enter the client ID and secret, request `https://www.googleapis.com/auth/drive.file`, authorize, then exchange the code for tokens.
5. Put the OAuth client ID, client secret, and refresh token in Render's Environment as `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REFRESH_TOKEN`. Do not commit or share these values.
6. Before relying on the setup, set the OAuth consent app to Production. Google refresh tokens for an External app left in Testing expire after 7 days for Drive scopes. Follow any verification requirements Google shows for the app.

VidyaKosha creates and uses its own folder. The encrypted snapshot contains student profiles, email addresses, account records (password hashes and salts only, never plaintext passwords), books, subscriptions, and reading activity. It omits payment transactions, support tickets, notifications, audit logs, and bulk-import error rows. Google Drive free storage is shared with Gmail and Photos; check the Google account's remaining space before uploading books.

Set `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` in Render before deploying the clean catalog. Keep credentials private.
