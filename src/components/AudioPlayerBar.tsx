import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Headphones,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {
  estimateSegmentDurationMs,
  getNextAudioTarget,
  getSpeechLocale,
  pickPreferredVoice,
  splitPageIntoAudioSegments,
} from '../shared/audioUtils';
import type { TranslationKey } from '../shared/i18n';
import type { BookPage } from '../shared/types';

interface AudioPlayerBarProps {
  open: boolean;
  onClose: () => void;
  bookTitle: string;
  contentLanguageCode: string;
  page: BookPage | null;
  currentPage: number;
  allowedPages: number;
  totalBookPages: number;
  accessLevel: 'full' | 'preview_only';
  theme: 'light' | 'sepia' | 'dark';
  autoPlayOnOpen: boolean;
  jumpRequest: { index: number; nonce: number } | null;
  onActiveSegmentChange: (index: number | null) => void;
  onRequestPageChange: (nextPage: number) => void;
  t: (key: TranslationKey) => string;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75];

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  open,
  onClose,
  bookTitle,
  contentLanguageCode,
  page,
  currentPage,
  allowedPages,
  totalBookPages,
  accessLevel,
  theme,
  autoPlayOnOpen,
  jumpRequest,
  onActiveSegmentChange,
  onRequestPageChange,
  t,
}) => {
  const segments = useMemo(() => splitPageIntoAudioSegments(page), [page]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [autoNextPage, setAutoNextPage] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [usingFallbackTimer, setUsingFallbackTimer] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const playbackGenRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const lastAutoPageRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const stopSpeechEngine = useCallback(() => {
    playbackGenRef.current += 1;
    clearTimers();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore browser cleanup errors
      }
    }
  }, [clearTimers]);

  // Load available browser TTS voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const syncVoices = () => {
      try {
        const list = window.speechSynthesis.getVoices();
        setVoices(list);
      } catch {
        setVoices([]);
      }
    };
    syncVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', syncVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', syncVoices);
    };
  }, []);

  // Auto-select best matching voice for book language
  const languageVoices = useMemo(() => {
    const base = (contentLanguageCode || 'en').toLowerCase();
    const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
    const others = voices.filter((v) => !v.lang.toLowerCase().startsWith(base));
    return [...matching, ...others];
  }, [voices, contentLanguageCode]);

  useEffect(() => {
    const preferred = pickPreferredVoice(voices, contentLanguageCode);
    setSelectedVoiceName(preferred ? preferred.name : '');
  }, [voices, contentLanguageCode]);

  const advanceAfterSegment = useCallback(
    (finishedIndex: number) => {
      const target = getNextAudioTarget({
        totalSegments: segments.length,
        currentSegmentIndex: finishedIndex,
        currentPage,
        allowedPages,
        totalBookPages,
        accessLevel,
        autoNextPage,
      });

      if (target.action === 'segment') {
        setSegmentIndex(target.nextIndex);
      } else if (target.action === 'next_page') {
        lastAutoPageRef.current = target.nextPage;
        setSegmentIndex(0);
        onRequestPageChange(target.nextPage);
      } else if (target.action === 'preview_limit') {
        stopSpeechEngine();
        setIsPlaying(false);
        setStatusNote(t('reader.previewWallTitle'));
        onRequestPageChange(allowedPages + 1);
      } else {
        stopSpeechEngine();
        setIsPlaying(false);
        setSegmentIndex(0);
      }
    },
    [
      segments.length,
      currentPage,
      allowedPages,
      totalBookPages,
      accessLevel,
      autoNextPage,
      onRequestPageChange,
      stopSpeechEngine,
      t,
    ]
  );

  // Sync active segment highlight back to BookReader
  useEffect(() => {
    if (!open) {
      onActiveSegmentChange(null);
      return;
    }
    onActiveSegmentChange(segments.length > 0 ? segmentIndex : null);
  }, [open, segmentIndex, segments.length, onActiveSegmentChange]);

  // Reset segment index when page changes manually
  useEffect(() => {
    if (lastAutoPageRef.current === currentPage) {
      lastAutoPageRef.current = null;
      return;
    }
    setSegmentIndex(0);
    setStatusNote(null);
  }, [currentPage]);

  // Auto-start playback when launched from "Listen Audio" button
  useEffect(() => {
    if (open && autoPlayOnOpen && segments.length > 0) {
      setStatusNote(null);
      setSegmentIndex(0);
      setIsPlaying(true);
    }
    if (!open) {
      stopSpeechEngine();
      setIsPlaying(false);
      setUsingFallbackTimer(false);
    }
  }, [open, autoPlayOnOpen, segments.length > 0, stopSpeechEngine]);

  // Handle jump-to-sentence click from reader page body
  useEffect(() => {
    if (!open || !jumpRequest) return;
    if (jumpRequest.index >= 0 && jumpRequest.index < segments.length) {
      setStatusNote(null);
      setSegmentIndex(jumpRequest.index);
      setIsPlaying(true);
    }
  }, [open, jumpRequest, segments.length]);

  // Core playback effect
  useEffect(() => {
    if (!open || !isPlaying || segments.length === 0) {
      stopSpeechEngine();
      return;
    }

    const safeIdx = Math.min(segmentIndex, segments.length - 1);
    const currentSeg = segments[safeIdx];
    if (!currentSeg) return;

    stopSpeechEngine();
    const myGen = playbackGenRef.current;
    const durationMs = estimateSegmentDurationMs(currentSeg.text, speed);

    const scheduleFallbackAdvance = () => {
      if (myGen !== playbackGenRef.current) return;
      setUsingFallbackTimer(true);
      timerRef.current = window.setTimeout(() => {
        if (myGen === playbackGenRef.current) {
          advanceAfterSegment(safeIdx);
        }
      }, durationMs);
    };

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utter = new SpeechSynthesisUtterance(currentSeg.text);
        utter.lang = getSpeechLocale(contentLanguageCode);
        utter.rate = speed;

        const chosenVoice =
          voices.find((v) => v.name === selectedVoiceName) ||
          pickPreferredVoice(voices, contentLanguageCode);
        if (chosenVoice) {
          utter.voice = chosenVoice;
        }

        let started = false;
        utter.onstart = () => {
          if (myGen !== playbackGenRef.current) return;
          started = true;
          if (watchdogRef.current !== null) {
            window.clearTimeout(watchdogRef.current);
            watchdogRef.current = null;
          }
          setUsingFallbackTimer(false);
        };

        utter.onend = () => {
          if (myGen !== playbackGenRef.current) return;
          advanceAfterSegment(safeIdx);
        };

        utter.onerror = (ev) => {
          if (myGen !== playbackGenRef.current) return;
          if (ev.error === 'interrupted' || ev.error === 'canceled') return;
          scheduleFallbackAdvance();
        };

        window.speechSynthesis.speak(utter);

        // If browser has no OS TTS voices (e.g. headless Chromium), switch smoothly to timed read-along highlight
        watchdogRef.current = window.setTimeout(() => {
          if (myGen === playbackGenRef.current && !started && voices.length === 0) {
            try {
              window.speechSynthesis.cancel();
            } catch {
              // ignore
            }
            scheduleFallbackAdvance();
          }
        }, 700);
      } catch {
        scheduleFallbackAdvance();
      }
    } else {
      scheduleFallbackAdvance();
    }

    return () => {
      clearTimers();
    };
  }, [
    open,
    isPlaying,
    segmentIndex,
    segments,
    speed,
    contentLanguageCode,
    voices,
    selectedVoiceName,
    advanceAfterSegment,
    stopSpeechEngine,
    clearTimers,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeechEngine();
    };
  }, [stopSpeechEngine]);

  if (!open) return null;

  const surfaceClass =
    theme === 'dark'
      ? 'border-slate-800 bg-slate-900/95 text-slate-100'
      : theme === 'sepia'
        ? 'border-[#DFD1B4] bg-[#F8F0DF] text-[#33271B]'
        : 'border-slate-200 bg-white text-slate-900';

  const activeSeg = segments[Math.min(segmentIndex, Math.max(0, segments.length - 1))];
  const progressPercent =
    segments.length > 0 ? Math.round(((Math.min(segmentIndex, segments.length - 1) + 1) / segments.length) * 100) : 0;

  return (
    <section
      aria-label={t('reader.audioMode')}
      data-testid="reader-audio-player"
      className={`border-t px-3 py-2.5 sm:px-5 ${surfaceClass}`}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          {/* Zone 1: Transport Controls (+ compact mobile close) */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (segmentIndex > 0) {
                    setSegmentIndex((i) => Math.max(0, i - 1));
                  } else if (currentPage > 1) {
                    onRequestPageChange(currentPage - 1);
                  }
                }}
                disabled={segmentIndex === 0 && currentPage <= 1}
                aria-label={t('reader.audioPrevLine')}
                title={t('reader.audioPrevLine')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-current/15 hover:bg-current/5 disabled:opacity-35"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusNote(null);
                  setIsPlaying((p) => !p);
                }}
                disabled={segments.length === 0}
                aria-label={isPlaying ? t('reader.audioPause') : t('reader.audioPlay')}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-900 px-3.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{isPlaying ? t('reader.audioPause') : t('reader.audioPlay')}</span>
              </button>

              <button
                type="button"
                onClick={() => advanceAfterSegment(segmentIndex)}
                disabled={segments.length === 0}
                aria-label={t('reader.audioNextLine')}
                title={t('reader.audioNextLine')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-current/15 hover:bg-current/5 disabled:opacity-35"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  stopSpeechEngine();
                  setIsPlaying(false);
                  setSegmentIndex(0);
                }}
                aria-label={t('reader.stopSpeak')}
                title={t('reader.stopSpeak')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-current/15 hover:bg-current/5"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <span className="font-mono-num text-xs opacity-75 whitespace-nowrap">
                p.{currentPage} · {Math.min(segmentIndex + 1, Math.max(1, segments.length))}/{Math.max(1, segments.length)}
              </span>
              <button
                type="button"
                onClick={() => {
                  stopSpeechEngine();
                  setIsPlaying(false);
                  onClose();
                }}
                aria-label="Close audio player"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-current/15 hover:bg-current/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Zone 2: Track title & status */}
          <div className="hidden min-w-0 flex-1 lg:block lg:px-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Headphones className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" />
              <span className="truncate">{bookTitle}</span>
              <span className="font-mono-num shrink-0 opacity-70">
                · p.{currentPage} · {Math.min(segmentIndex + 1, Math.max(1, segments.length))}/{Math.max(1, segments.length)}
              </span>
            </div>
            <p className="truncate text-[11px] opacity-75">
              {statusNote || (usingFallbackTimer ? t('reader.audioReadAlongFallback') : activeSeg?.text || '')}
            </p>
          </div>

          {/* Zone 3: Speed, Voice, Auto-next-page, Desktop Close */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 lg:justify-end">
            <div className="flex items-center gap-2">
              <label htmlFor="audio-speed-select" className="sr-only">
                {t('reader.audioSpeed')}
              </label>
              <select
                id="audio-speed-select"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="h-9 rounded-lg border border-current/20 bg-transparent px-2 font-mono-num text-xs font-medium"
              >
                {SPEED_OPTIONS.map((sp) => (
                  <option key={sp} value={sp} className="text-slate-900">
                    {sp}x
                  </option>
                ))}
              </select>

              {languageVoices.length > 0 && (
                <div className="hidden sm:flex items-center gap-1">
                  <Volume2 className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                  <label htmlFor="audio-voice-select" className="sr-only">
                    {t('reader.audioVoice')}
                  </label>
                  <select
                    id="audio-voice-select"
                    value={selectedVoiceName}
                    onChange={(e) => setSelectedVoiceName(e.target.value)}
                    className="h-9 max-w-[160px] rounded-lg border border-current/20 bg-transparent px-2 text-xs"
                  >
                    {languageVoices.map((v) => (
                      <option key={`${v.name}-${v.lang}`} value={v.name} className="text-slate-900">
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-current/15 px-2.5 text-xs font-medium whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={autoNextPage}
                  onChange={(e) => setAutoNextPage(e.target.checked)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span>{t('reader.audioAutoPage')}</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  stopSpeechEngine();
                  setIsPlaying(false);
                  onClose();
                }}
                aria-label="Close audio player"
                className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-current/15 hover:bg-current/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Thin progress bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-current/10">
          <div
            className="h-full bg-blue-700 transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
};
