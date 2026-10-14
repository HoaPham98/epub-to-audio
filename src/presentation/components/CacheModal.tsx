'use client';

import React, { useState } from 'react';
import { X, HardDrive, Trash2, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { ManageAudioCacheUseCase } from '@/application';

interface CacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  cacheCount: number;
  cacheSizeMB: number;
  onCacheCleared: () => void;
}

export function CacheModal({
  isOpen,
  onClose,
  cacheCount,
  cacheSizeMB,
  onCacheCleared,
}: CacheModalProps) {
  const [clearing, setClearing] = useState(false);
  const [done, setDone] = useState(false);

  if (!isOpen) return null;

  const handleClear = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ bộ nhớ đệm audio đã tạo? Các đoạn âm thanh sau đó sẽ cần tạo lại nếu nghe lại.')) {
      return;
    }
    setClearing(true);
    const cacheUseCase = new ManageAudioCacheUseCase();
    await cacheUseCase.clear();
    setClearing(false);
    setDone(true);
    onCacheCleared();
    setTimeout(() => {
      setDone(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Bộ nhớ đệm âm thanh (IndexedDB)
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-800/40 text-center">
              <span className="text-[11px] font-medium text-zinc-500">Số đoạn đã cache</span>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {cacheCount}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-800/40 text-center">
              <span className="text-[11px] font-medium text-zinc-500">Dung lượng ước tính</span>
              <p className="text-xl font-bold text-zinc-800 dark:text-zinc-200 mt-1">
                {cacheSizeMB} MB
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3.5 flex gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Các đoạn âm thanh được lưu an toàn trong trình duyệt của bạn. Khi nghe lại hoặc tua lại, ứng dụng sẽ phát trực tiếp từ cache mà không tốn thêm token/tiền gọi API TTS.
            </p>
          </div>

          {done && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-700 p-2.5 text-xs flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>Đã xóa toàn bộ bộ nhớ đệm thành công!</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing || cacheCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/40 text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              {clearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Xóa sạch Cache
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Đóng
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
