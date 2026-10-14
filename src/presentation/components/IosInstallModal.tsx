'use client';

import React from 'react';
import { X, Share, PlusSquare, Smartphone } from 'lucide-react';

interface IosInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IosInstallModal({ isOpen, onClose }: IosInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Cài đặt ứng dụng trên iOS
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Chạy mượt mà, hỗ trợ nghe nền khi khoá màn hình
            </p>
          </div>
        </div>

        <div className="space-y-4 my-6">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold">
              1
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300">
              Nhấn vào biểu tượng <strong className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400"><Share className="inline h-3.5 w-3.5" /> Chia sẻ (Share)</strong> ở thanh công cụ trình duyệt Safari.
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold">
              2
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300">
              Cuộn xuống danh sách hành động và chọn <strong className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400"><PlusSquare className="inline h-3.5 w-3.5" /> Thêm vào MH chính (Add to Home Screen)</strong>.
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold">
              3
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300">
              Nhấn nút <strong className="font-semibold text-indigo-600 dark:text-indigo-400">Thêm (Add)</strong> ở góc trên bên phải màn hình để hoàn tất.
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}
