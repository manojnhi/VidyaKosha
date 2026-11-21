import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const MAX_PDF_SIZE_BYTES = 500 * 1024 * 1024;
const URL_TTL_SECONDS = 15 * 60;

let cachedClient: S3Client | null = null;

export function isR2StorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function getR2Client(): S3Client {
  if (!isR2StorageConfigured()) {
    throw new Error('Large PDF storage is not configured. Add the R2 credentials in the server environment.');
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return cachedClient;
}

export function isR2PdfFileId(fileId?: string): boolean {
  return Boolean(fileId && /^r2pdf-[a-f0-9-]+\.pdf$/i.test(fileId));
}

export async function createR2PdfUploadUrl(fileId: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileId,
    ContentType: 'application/pdf',
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: URL_TTL_SECONDS });
}

export async function createR2PdfReadUrl(fileId: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileId,
    ResponseContentType: 'application/pdf',
    ResponseContentDisposition: 'inline',
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: URL_TTL_SECONDS });
}

export async function verifyR2PdfUpload(fileId: string, expectedSizeBytes: number): Promise<void> {
  const client = getR2Client();
  const head = await client.send(new HeadObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileId,
  }));
  if (!head.ContentLength || head.ContentLength !== expectedSizeBytes || head.ContentLength > MAX_PDF_SIZE_BYTES) {
    throw new Error('Uploaded PDF size could not be verified.');
  }
  if (head.ContentType && !head.ContentType.toLowerCase().includes('application/pdf')) {
    throw new Error('Uploaded file is not identified as a PDF.');
  }

  const response = await client.send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileId,
    Range: 'bytes=0-4',
  }));
  const prefix = await response.Body?.transformToByteArray();
  if (!prefix || Buffer.from(prefix).subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Uploaded file does not contain a valid PDF header.');
  }
}
