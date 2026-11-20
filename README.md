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
