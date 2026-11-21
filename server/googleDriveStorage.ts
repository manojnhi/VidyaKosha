import crypto from 'node:crypto';

export const MAX_PDF_SIZE_BYTES = 524288000;
export const GOOGLE_DRIVE_CHUNK_SIZE_BYTES = 8388608;
const GOOGLE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_TOKEN_API = 'https://oauth2.googleapis.com/token';
const APP_FOLDER_NAME = 'VidyaKosha Books';
const DATABASE_FILE_NAME = 'vidyakosha-database.json';

type UploadSession = {
  location: string;
  fileName: string;
  sizeBytes: number;
  nextOffset: number;
  createdAt: number;
};

let cachedAccessToken = '';
let accessTokenExpiresAt = 0;
let cachedFolderId = '';
let cachedDatabaseFileId = '';
const uploadSessions = new Map<string, UploadSession>();

export function isGoogleDriveStorageConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );
}

export function isGoogleDrivePdfFileId(fileId?: string): boolean {
  return Boolean(fileId && /^gdrivepdf-[A-Za-z0-9_-]{10,}$/.test(fileId));
}

export function getGoogleDriveIdFromPdfFileId(fileId: string): string | null {
  return isGoogleDrivePdfFileId(fileId) ? fileId.slice('gdrivepdf-'.length) : null;
}

async function getAccessToken(): Promise<string> {
  if (!isGoogleDriveStorageConfigured()) {
    throw new Error('Google Drive storage is not configured. Add the Google Drive OAuth values in Render.');
  }
  if (cachedAccessToken && Date.now() < accessTokenExpiresAt - 60_000) return cachedAccessToken;

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
    grant_type: 'refresh_token',
  });
  const response = await fetch(GOOGLE_TOKEN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || 'Google Drive authorization failed. Check the OAuth credentials.');
  }
  cachedAccessToken = payload.access_token;
  accessTokenExpiresAt = Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000;
  return cachedAccessToken;
}

async function driveRequest(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function driveError(response: Response, fallback: string): Promise<never> {
  const body = await response.text().catch(() => '');
  let detail = '';
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    detail = parsed.error?.message || '';
  } catch { /* use safe fallback */ }
  throw new Error(detail || `${fallback} (Google Drive ${response.status})`);
}

async function ensureAppFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;
  const query = new URLSearchParams({
    q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    spaces: 'drive',
    pageSize: '10',
    fields: 'files(id,name)',
  });
  const list = await driveRequest(`${GOOGLE_API}/files?${query.toString()}`);
  if (!list.ok) return driveError(list, 'Could not locate the VidyaKosha Drive folder.');
  const payload = await list.json() as { files?: Array<{ id: string }> };
  const existing = payload.files?.[0]?.id;
  if (existing) {
    cachedFolderId = existing;
    return existing;
  }

  const created = await driveRequest(`${GOOGLE_API}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: APP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!created.ok) return driveError(created, 'Could not create the VidyaKosha Drive folder.');
  const folder = await created.json() as { id?: string };
  if (!folder.id) throw new Error('Google Drive did not return a folder ID.');
  cachedFolderId = folder.id;
  return folder.id;
}

function sanitizeDriveFileName(value: string): string {
  const name = value.replace(/[\\/\u0000-\u001f]/g, '_').trim().slice(0, 180);
  return name.toLowerCase().endsWith('.pdf') ? name : `${name || 'textbook'}.pdf`;
}

export async function createGoogleDrivePdfUploadSession(
  fileName: string,
  sizeBytes: number
): Promise<{ uploadSessionId: string; chunkSizeBytes: number }> {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_PDF_SIZE_BYTES) {
    throw new Error('Choose a PDF file no larger than 500 MB.');
  }
  const folderId = await ensureAppFolder();
  const response = await driveRequest(
    `${GOOGLE_UPLOAD_API}/files?uploadType=resumable&fields=id,name,size,mimeType`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/pdf',
        'X-Upload-Content-Length': String(sizeBytes),
      },
      body: JSON.stringify({
        name: sanitizeDriveFileName(fileName),
        mimeType: 'application/pdf',
        parents: [folderId],
      }),
    }
  );
  if (!response.ok) return driveError(response, 'Could not start the Google Drive upload.');
  const location = response.headers.get('Location');
  if (!location) throw new Error('Google Drive did not return a resumable upload link.');

  const uploadSessionId = crypto.randomUUID();
  uploadSessions.set(uploadSessionId, {
    location,
    fileName: sanitizeDriveFileName(fileName),
    sizeBytes,
    nextOffset: 0,
    createdAt: Date.now(),
  });
  for (const [id, session] of uploadSessions) {
    if (Date.now() - session.createdAt > 60 * 60 * 1000) uploadSessions.delete(id);
  }
  return { uploadSessionId, chunkSizeBytes: GOOGLE_DRIVE_CHUNK_SIZE_BYTES };
}

export async function uploadGoogleDrivePdfChunk(
  uploadSessionId: string,
  start: number,
  total: number,
  chunk: Buffer
): Promise<{ complete: boolean; nextOffset: number; driveFileId?: string }> {
  const session = uploadSessions.get(uploadSessionId);
  if (!session) throw new Error('Upload session expired. Start the PDF upload again.');
  if (total !== session.sizeBytes || start !== session.nextOffset || chunk.length === 0 || chunk.length > GOOGLE_DRIVE_CHUNK_SIZE_BYTES) {
    throw new Error('Invalid PDF upload chunk. Restart the upload and try again.');
  }
  const end = start + chunk.length - 1;
  if (end >= total || (end + 1 < total && chunk.length % (256 * 1024) !== 0)) {
    throw new Error('Invalid Google Drive chunk size.');
  }
  if (start === 0 && chunk.subarray(0, 5).toString('ascii') !== '%PDF-') {
    uploadSessions.delete(uploadSessionId);
    throw new Error('The selected file is not a valid PDF.');
  }

  const token = await getAccessToken();
  const response = await fetch(session.location, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/pdf',
      'Content-Length': String(chunk.length),
      'Content-Range': `bytes ${start}-${end}/${total}`,
    },
    body: chunk,
  });
  if (response.status === 308) {
    const range = response.headers.get('Range');
    const match = range?.match(/bytes=0-(\d+)/i);
    session.nextOffset = match ? Number(match[1]) + 1 : end + 1;
    return { complete: false, nextOffset: session.nextOffset };
  }
  if (!response.ok) return driveError(response, 'Google Drive could not receive the PDF chunk.');

  const file = await response.json().catch(() => ({})) as { id?: string };
  if (!file.id || end + 1 !== total) {
    uploadSessions.delete(uploadSessionId);
    throw new Error('Google Drive finished the upload with incomplete file information.');
  }
  uploadSessions.delete(uploadSessionId);
  return { complete: true, nextOffset: total, driveFileId: file.id };
}

export async function verifyGoogleDrivePdfUpload(fileId: string, expectedSizeBytes: number): Promise<void> {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) throw new Error('Invalid Google Drive file ID.');
  const query = new URLSearchParams({ fields: 'id,name,size,mimeType,trashed' });
  const response = await driveRequest(`${GOOGLE_API}/files/${encodeURIComponent(fileId)}?${query.toString()}`);
  if (!response.ok) return driveError(response, 'Could not verify the uploaded PDF.');
  const file = await response.json() as { id?: string; size?: string; mimeType?: string; trashed?: boolean };
  if (file.id !== fileId || file.trashed || Number(file.size) !== expectedSizeBytes || file.mimeType !== 'application/pdf') {
    throw new Error('Uploaded PDF size or type could not be verified.');
  }
  // The first resumable chunk is checked for the %PDF- signature before reaching Drive.
}

export async function getGoogleDrivePdfResponse(fileId: string, range?: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) throw new Error('Invalid Google Drive file ID.');
  const headers = range ? { Range: range } : undefined;
  const response = await driveRequest(
    `${GOOGLE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
    headers ? { headers } : {}
  );
  if (!response.ok && response.status !== 206) return driveError(response, 'Google Drive could not serve the PDF.');
  return response;
}


async function findDatabaseFileId(): Promise<string | null> {
  if (cachedDatabaseFileId) return cachedDatabaseFileId;
  const folderId = await ensureAppFolder();
  const query = new URLSearchParams({
    q: `'${folderId}' in parents and name='${DATABASE_FILE_NAME}' and trashed=false`,
    spaces: 'drive',
    pageSize: '1',
    fields: 'files(id)',
  });
  const response = await driveRequest(`${GOOGLE_API}/files?${query.toString()}`);
  if (!response.ok) return driveError(response, 'Could not find the VidyaKosha database backup.');
  const payload = await response.json() as { files?: Array<{ id: string }> };
  cachedDatabaseFileId = payload.files?.[0]?.id || '';
  return cachedDatabaseFileId || null;
}

export async function readGoogleDriveDatabaseSnapshot(): Promise<string | null> {
  const fileId = await findDatabaseFileId();
  if (!fileId) return null;
  const response = await driveRequest(`${GOOGLE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
  if (!response.ok) return driveError(response, 'Could not restore the VidyaKosha database backup.');
  return response.text();
}

export async function writeGoogleDriveDatabaseSnapshot(snapshot: string): Promise<void> {
  const folderId = await ensureAppFolder();
  let fileId = await findDatabaseFileId();
  const uploadBytes = Buffer.from(snapshot, 'utf-8');
  const query = new URLSearchParams({ uploadType: 'resumable', fields: 'id' });
  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files${fileId ? `/${encodeURIComponent(fileId)}` : ''}?${query.toString()}`;
  const metadata = fileId
    ? {}
    : {
        name: DATABASE_FILE_NAME,
        mimeType: 'application/json',
        parents: [folderId],
      };

  const initiation = await driveRequest(uploadUrl, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/json',
      'X-Upload-Content-Length': String(uploadBytes.length),
    },
    body: JSON.stringify(metadata),
  });
  if (!initiation.ok) return driveError(initiation, 'Could not start the VidyaKosha database backup.');
  const sessionUrl = initiation.headers.get('Location');
  if (!sessionUrl) throw new Error('Google Drive did not return a database backup upload link.');

  const uploaded = await driveRequest(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': String(uploadBytes.length),
    },
    body: uploadBytes,
  });
  if (!uploaded.ok) return driveError(uploaded, 'Could not save the VidyaKosha database backup.');
  if (!fileId) {
    const response = await uploaded.json().catch(() => ({})) as { id?: string };
    if (!response.id) throw new Error('Google Drive did not return the database backup ID.');
    fileId = response.id;
    cachedDatabaseFileId = fileId;
  }
}
