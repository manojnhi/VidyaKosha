# VidyaKosha Digital Library

Multilingual K–12 digital textbook platform (Nursery to Class 12) with CBSE, ICSE, and State Board support, interactive full-screen reader with Audiobook mode, role-based admin panel, licensing verification, and multi-platform packaging (Web/PWA, Windows `.exe`, Android `.apk`).

## Local Development

```bash
npm install
npm run dev
```

Runs on `http://localhost:3000`.

## Verification Commands

```bash
npm run lint   # TypeScript check
npm test       # Domain & offline API unit tests (node:test)
npm run build  # Production Vite + PWA bundle into dist/
```

## Build Windows `.exe` & Android `.apk` on GitHub (`main` / `master`)

1. Make sure ALL files — especially `.github/workflows/build-main.yml`, `electron/`, `mobile/`, `src/`, and `server.ts` — are pushed to your GitHub `main` (or `master`) branch:

```bash
git add -A
git commit -m "Build Windows .exe and Android .apk via GitHub Actions"
git push -u origin main
```

2. Open your GitHub repository → **Actions** tab → click the latest **`Build VidyaKosha (.apk & .exe)`** run → scroll to **Artifacts**:
   - **`VidyaKosha-APK-and-EXE`**: Combined ZIP containing `VidyaKosha-Android.apk`, `VidyaKosha-Setup-1.0.0.exe`, and `VidyaKosha-Portable-1.0.0.exe`
   - **`vidyakosha-windows-exe`**: Windows installers only (`.exe`)
   - **`vidyakosha-android-apk`**: Android installer only (`VidyaKosha-Android.apk`)


## Large PDF storage

The app accepts book PDFs up to 500 MB when Cloudflare R2 is configured. Large PDFs upload directly to R2, and the app reads them with byte-range requests; the Render service does not hold the file in memory.

Set these server environment variables in Render:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Add a bucket CORS rule that allows `GET`, `HEAD`, and `PUT` from the VidyaKosha website origin and Android origins `https://localhost` and `capacitor://localhost`. Allow the `Content-Type` and `Range` request headers and expose `ETag`, `Content-Length`, `Content-Range`, and `Accept-Ranges`.

Set `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` in Render before the first clean deployment to create the first administrator account. Keep the password private and use a strong unique value.

Cloudflare R2 includes 10 GB-month of Standard storage in its monthly free tier; storage above that allowance is billed by usage. A 500 MB upload is supported, but it is not a promise of 500 GB of free storage.
