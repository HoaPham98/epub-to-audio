'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Gauge,
  Sparkles,
  Loader2,
  Layers,
} from 'lucide-react';
import { EpubBook } from '@/domain';

interface AudioPlayerBarProps {
  book: EpubBook | null;
  currentChapterIndex: number;
  currentChunkIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering?: boolean;
  currentTime: number;
  duration: number;
  estimatedDuration?: number;
  bufferedTime?: number;
  forwardBufferSeconds?: number;
  isChapterFullyBuffered?: boolean;
  autoNext: boolean;
  onTogglePlayPause: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onSeek: (time: number) => void;
  onSkipRelative: (seconds: number) => void;
  onToggleAutoNext: () => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayerBar({
  book,
  currentChapterIndex,
  currentChunkIndex,
  isPlaying,
  isLoading,
  isBuffering = false,
  currentTime,
  duration,
  estimatedDuration = 0,
  bufferedTime = 0,
  forwardBufferSeconds,
  isChapterFullyBuffered = false,
  autoNext,
  onTogglePlayPause,
  onPrevChapter,
  onNextChapter,
  onSeek,
  onSkipRelative,
  onToggleAutoNext,
  speed,
  onChangeSpeed,
}: AudioPlayerBarProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  if (!book) return null;

  const currentChapter = book.chapters[currentChapterIndex];
  const totalChunks = currentChapter ? currentChapter.chunks.length : 0;
  const effectiveDuration = Math.max(duration, estimatedDuration);

  const handleVolumeToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const audioEl = (document.getElementById('background-audio-bridge') ||
      document.querySelector('audio')) as HTMLAudioElement | null;
    if (audioEl) {
      audioEl.muted = nextMuted;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    const audioEl = (document.getElementById('background-audio-bridge') ||
      document.querySelector('audio')) as HTMLAudioElement | null;
    if (audioEl) {
      audioEl.volume = val;
      audioEl.muted = val === 0;
    }
  };

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const bufferPercent = effectiveDuration > 0 ? Math.min(100, (bufferedTime / effectiveDuration) * 100) : 0;

  return (
    <footer className="relative w-full shrink-0 z-30 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
        
        {/* Left: Info on Current Chapter & Chunk */}
        <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0 justify-between md:justify-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {currentChapter ? currentChapter.title : 'Chưa có chương'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                Đoạn {currentChunkIndex + 1} / {totalChunks || 1}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span className="text-[11px] text-zinc-500">
                Chương {currentChapterIndex + 1}/{book.chapters.length}
              </span>
              {isChapterFullyBuffered ? (
                <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  Đã nạp hết chương
                </span>
              ) : forwardBufferSeconds !== undefined && forwardBufferSeconds > 0 ? (
                <span className="text-[10px] font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  Đệm trước: +{forwardBufferSeconds.toFixed(0)}s
                </span>
              ) : bufferedTime > 0 && effectiveDuration > 0 ? (
                <span className="text-[10px] font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  Đã đệm {bufferedTime.toFixed(1)}s{effectiveDuration > bufferedTime ? ` / ~${effectiveDuration.toFixed(1)}s` : ''}
                </span>
              ) : null}
              {isBuffering && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 animate-pulse">
                  {isChapterFullyBuffered ? 'Đang nạp sẵn chương kế...' : 'Đang nạp dữ liệu...'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Playback Controls & Scrubber */}
        <div className="flex flex-col items-center gap-1.5 w-full md:w-2/4">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Prev Chapter */}
            <button
              onClick={onPrevChapter}
              disabled={currentChapterIndex <= 0}
              className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              title="Chương trước"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => onSkipRelative(-10)}
              className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Lùi 10 giây"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Main Play / Pause Button */}
            <button
              onClick={onTogglePlayPause}
              disabled={isLoading && !isPlaying}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-80 cursor-pointer"
              title={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isLoading && !isPlaying ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => onSkipRelative(10)}
              className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Tua 10 giây"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Next Chapter */}
            <button
              onClick={onNextChapter}
              disabled={currentChapterIndex >= book.chapters.length - 1}
              className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              title="Chương tiếp theo"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          {/* Scrubber Bar & Timers with Buffered Range Layer */}
          <div className="flex w-full items-center gap-2 text-[11px] font-mono text-zinc-500">
            <span>{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center h-4">
              {/* Background Track & Buffered Overlay */}
              <div className="absolute left-0 right-0 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden pointer-events-none">
                <div
                  className="h-full bg-indigo-200/90 dark:bg-indigo-900/60 transition-all duration-300 rounded-lg"
                  style={{ width: `${bufferPercent}%` }}
                />
              </div>

              {/* Foreground Scrubber Range Input */}
              <input
                type="range"
                min={0}
                max={effectiveDuration || 100}
                value={currentTime}
                onChange={e => onSeek(parseFloat(e.target.value))}
                className="relative z-10 w-full h-1.5 bg-transparent appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
              />
            </div>
            <span>{formatTime(effectiveDuration)}</span>
          </div>
        </div>

        {/* Right: Auto Next, Speed, Volume */}
        <div className="flex items-center justify-end gap-3 w-full md:w-1/4">
          
          {/* AUTO-NEXT BUTTON (High visibility toggle) */}
          <button
            onClick={onToggleAutoNext}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              autoNext
                ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
            title={
              autoNext
                ? 'Tự động sang chương kế: ĐANG BẬT (kết thúc chương sẽ tự động chuyển tiếp)'
                : 'Tự động sang chương kế: ĐANG TẮT'
            }
          >
            <Sparkles className={`h-3.5 w-3.5 ${autoNext ? 'text-indigo-600 animate-pulse' : 'text-zinc-400'}`} />
            <span>Auto Next</span>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                autoNext ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            />
          </button>

          {/* Speed Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Tốc độ đọc"
            >
              <Gauge className="h-3.5 w-3.5 text-zinc-500" />
              <span>{speed}x</span>
            </button>

            {showSpeedMenu && (
              <div className="absolute right-0 bottom-full mb-2 w-28 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-1 z-50">
                {speedOptions.map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      onChangeSpeed(s);
                      setShowSpeedMenu(false);
                    }}
                    className={`w-full text-left px-2 py-1 text-xs rounded-md transition-colors ${
                      speed === s
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Volume Control */}
          <div className="hidden lg:flex items-center gap-1.5">
            <button
              onClick={handleVolumeToggle}
              className="p-1 rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-red-500" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

        </div>

      </div>
    </footer>
  );
}
