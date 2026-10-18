'use client';

import { useEffect, useRef } from 'react';

export interface UseDesktopShortcutsProps {
  isEnabled?: boolean;
  onTogglePlayPause: () => void;
  onSeekRelative: (seconds: number) => void;
  onVolumeChange: (volumeDelta: number) => void;
  onToggleMute: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
}

function isInputFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;

  const tagName = active.tagName.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  if ((active as HTMLElement).isContentEditable) {
    return true;
  }

  // Bypass if focus is inside an active modal dialog
  if (active.closest('dialog, [role="dialog"]')) {
    return true;
  }

  return false;
}

export function useDesktopShortcuts({
  isEnabled = true,
  onTogglePlayPause,
  onSeekRelative,
  onVolumeChange,
  onToggleMute,
  onPrevChapter,
  onNextChapter,
}: UseDesktopShortcutsProps) {
  const callbacksRef = useRef({
    onTogglePlayPause,
    onSeekRelative,
    onVolumeChange,
    onToggleMute,
    onPrevChapter,
    onNextChapter,
  });

  useEffect(() => {
    callbacksRef.current = {
      onTogglePlayPause,
      onSeekRelative,
      onVolumeChange,
      onToggleMute,
      onPrevChapter,
      onNextChapter,
    };
  });

  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is using meta keys (Cmd/Ctrl/Alt) to avoid breaking system/browser shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Check focus safety guards
      if (isInputFocused()) {
        return;
      }

      switch (e.key) {
        case ' ': {
          e.preventDefault();
          // If a button has focus, blur it to prevent duplicate spacebar activation
          if (document.activeElement instanceof HTMLButtonElement) {
            document.activeElement.blur();
          }
          callbacksRef.current.onTogglePlayPause();
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          callbacksRef.current.onSeekRelative(-10);
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          callbacksRef.current.onSeekRelative(10);
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          callbacksRef.current.onVolumeChange(0.05);
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          callbacksRef.current.onVolumeChange(-0.05);
          break;
        }

        case 'm':
        case 'M': {
          e.preventDefault();
          callbacksRef.current.onToggleMute();
          break;
        }

        case '[': {
          e.preventDefault();
          callbacksRef.current.onPrevChapter();
          break;
        }

        case ']': {
          e.preventDefault();
          callbacksRef.current.onNextChapter();
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled]);
}
