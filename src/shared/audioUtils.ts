import type { BookPage } from './types';

export interface AudioSegment {
  index: number;
  kind: 'heading' | 'body' | 'keyPoint';
  text: string;
}

export interface VoiceOptionLike {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
}

export function getSpeechLocale(contentLanguageCode: string): string {
  const code = (contentLanguageCode || 'en').toLowerCase();
  const map: Record<string, string> = {
    hi: 'hi-IN',
    mr: 'mr-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    pa: 'pa-IN',
    ur: 'ur-IN',
    en: 'en-IN',
  };
  return map[code] || `${code}-IN`;
}

/**
 * Splits a textbook page into ordered spoken segments (heading, body sentences, key points).
 * Supports Devanagari danda (। / ॥) as well as Latin sentence terminators (. ! ?).
 */
export function splitPageIntoAudioSegments(page: BookPage | null | undefined): AudioSegment[] {
  if (!page) return [];
  const segments: AudioSegment[] = [];

  const cleanHeading = [page.chapterTitle, page.heading]
    .filter((s) => Boolean(s && s.trim()))
    .join('. ')
    .trim();
  if (cleanHeading) {
    segments.push({ index: 0, kind: 'heading', text: cleanHeading });
  }

  const bodyText = (page.body || '').trim();
  if (bodyText) {
    const paragraphs = bodyText.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    for (const para of paragraphs) {
      // Split at sentence endings (. ! ? । ॥) while keeping punctuation attached
      const parts = para
        .split(/(?<=[.!?।॥])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const part of parts) {
        segments.push({ index: segments.length, kind: 'body', text: part });
      }
    }
  }

  if (page.keyPoints && page.keyPoints.length > 0) {
    for (const kp of page.keyPoints) {
      const clean = kp.trim();
      if (clean) {
        segments.push({ index: segments.length, kind: 'keyPoint', text: clean });
      }
    }
  }

  return segments;
}

export function pickPreferredVoice<T extends VoiceOptionLike>(
  voices: T[],
  contentLanguageCode: string
): T | null {
  if (!voices || voices.length === 0) return null;
  const targetLocale = getSpeechLocale(contentLanguageCode).toLowerCase();
  const baseLang = (contentLanguageCode || 'en').toLowerCase();

  // 1. Exact locale match (e.g. hi-in)
  const exact = voices.find((v) => v.lang.toLowerCase() === targetLocale);
  if (exact) return exact;

  // 2. Language prefix match (e.g. hi-* or en-*)
  const prefix = voices.find((v) => v.lang.toLowerCase().startsWith(`${baseLang}-`) || v.lang.toLowerCase() === baseLang);
  if (prefix) return prefix;

  // 3. Default system voice or first available
  return voices.find((v) => v.default) || voices[0];
}

export type AudioAdvanceResult =
  | { action: 'segment'; nextIndex: number }
  | { action: 'next_page'; nextPage: number }
  | { action: 'preview_limit' }
  | { action: 'finished' };

export function getNextAudioTarget(params: {
  totalSegments: number;
  currentSegmentIndex: number;
  currentPage: number;
  allowedPages: number;
  totalBookPages: number;
  accessLevel: 'full' | 'preview_only';
  autoNextPage: boolean;
}): AudioAdvanceResult {
  const {
    totalSegments,
    currentSegmentIndex,
    currentPage,
    allowedPages,
    totalBookPages,
    accessLevel,
    autoNextPage,
  } = params;

  if (currentSegmentIndex + 1 < totalSegments) {
    return { action: 'segment', nextIndex: currentSegmentIndex + 1 };
  }

  if (!autoNextPage) {
    return { action: 'finished' };
  }

  if (currentPage < allowedPages) {
    return { action: 'next_page', nextPage: currentPage + 1 };
  }

  if (accessLevel === 'preview_only' && currentPage >= allowedPages && totalBookPages > allowedPages) {
    return { action: 'preview_limit' };
  }

  return { action: 'finished' };
}

export function estimateSegmentDurationMs(text: string, rate: number): number {
  const words = Math.max(1, text.trim().split(/\s+/).length);
  const safeRate = Math.max(0.5, Math.min(2.5, rate || 1));
  // ~155 wpm baseline -> ~387ms per word, clamped reasonably for read-along pacing
  const raw = Math.round((words * 390) / safeRate);
  return Math.max(1400, Math.min(12000, raw));
}
