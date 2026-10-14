'use client';

import React, { useState } from 'react';
import { X, Eye, EyeOff, Check, AlertCircle, Loader2, Volume2, ShieldCheck, Music } from 'lucide-react';
import { TTSSettings } from '@/types';
import { testTTSConnection } from '@/lib/tts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TTSSettings;
  onSave: (settings: TTSSettings) => void;
}

const PRESET_ENDPOINTS = [
  { label: 'OpenAI (Chính thức)', url: 'https://api.openai.com/v1', model: 'tts-1', voice: 'alloy', format: 'mp3' },
  { label: 'Custom / Proxy (WAV)', url: 'https://api.openai.com/v1', model: 'tts-1', voice: 'alloy', format: 'wav' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1', model: 'playdialog', voice: 'alloy', format: 'wav' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/tts-1', voice: 'alloy', format: 'wav' },
];

const SUGGESTED_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'Puck', 'Aoede', 'Fenrir', 'Kore'];
const FORMAT_OPTIONS = [
  { value: 'wav', label: 'WAV (Khuyên dùng)' },
  { value: 'pcm', label: 'PCM' },
  { value: 'mp3', label: 'MP3' },
  { value: 'opus', label: 'Opus' },
  { value: 'aac', label: 'AAC' },
  { value: 'flac', label: 'FLAC' },
];

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const [formData, setFormData] = useState<TTSSettings>({
    ...settings,
    responseFormat: settings.responseFormat || 'wav',
  });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handlePresetSelect = (preset: typeof PRESET_ENDPOINTS[0]) => {
    setFormData(prev => ({
      ...prev,
      endpoint: preset.url,
      model: preset.model,
      voice: preset.voice,
      responseFormat: preset.format,
    }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testTTSConnection(formData);
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Kiểm tra thất bại.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Cài đặt OpenAI TTS Endpoint
            </h2>
            <p className="text-xs text-zinc-500">
              Cấu hình endpoint tương thích API /v1/audio/speech
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Presets */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Chọn nhanh cấu hình mẫu:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ENDPOINTS.map(p => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => handlePresetSelect(p)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint URL */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Base Endpoint URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.endpoint}
              onChange={e => setFormData({ ...formData, endpoint: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-hidden"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Hỗ trợ tự động gọi đường dẫn con <code className="text-indigo-500">/audio/speech</code>.
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              API Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                required
                value={formData.apiKey}
                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="sk-proj-..."
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 pr-9 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              API key chỉ được lưu an toàn trong localStorage trình duyệt của bạn.
            </p>
          </div>

          {/* Model Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Model TTS
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={e => setFormData({ ...formData, model: e.target.value })}
              placeholder="tts-1 hoặc tts-1-hd"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Voice Input (Direct Free-form Input + Suggestion Badges) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Giọng đọc (Voice)
              </label>
              <span className="text-[11px] text-zinc-400">Nhập tên bất kỳ</span>
            </div>
            <input
              type="text"
              value={formData.voice}
              onChange={e => setFormData({ ...formData, voice: e.target.value })}
              placeholder="VD: alloy, nova, Puck, Aoede, ..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-hidden"
            />
            {/* Quick Suggestion Pills */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {SUGGESTED_VOICES.map(voiceName => (
                <button
                  type="button"
                  key={voiceName}
                  onClick={() => setFormData({ ...formData, voice: voiceName })}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    formData.voice.toLowerCase() === voiceName.toLowerCase()
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {voiceName}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Response Format (wav, pcm, mp3...) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Music className="h-3.5 w-3.5 text-indigo-500" />
                Định dạng âm thanh (response_format)
              </label>
              <span className="text-[11px] font-mono text-indigo-600 font-medium">
                {formData.responseFormat || 'wav'}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {FORMAT_OPTIONS.map(fmt => (
                <button
                  type="button"
                  key={fmt.value}
                  onClick={() => setFormData({ ...formData, responseFormat: fmt.value })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    formData.responseFormat === fmt.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-semibold shadow-2xs'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                  }`}
                >
                  {fmt.value.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Nếu endpoint báo lỗi không hỗ trợ mp3, hãy chọn <strong className="text-zinc-600 dark:text-zinc-300">WAV</strong> hoặc <strong className="text-zinc-600 dark:text-zinc-300">PCM</strong>.
            </p>
          </div>

          {/* Speed */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Tốc độ đọc mặc định
              </label>
              <span className="text-xs font-mono font-medium text-indigo-600">
                {formData.speed.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={formData.speed}
              onChange={e => setFormData({ ...formData, speed: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          {/* CORS Proxy Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Dùng Next.js Serverless Proxy (Chống lỗi CORS)
                </p>
                <p className="text-[11px] text-zinc-400">
                  Hữu ích nếu bạn dùng endpoint riêng (self-hosted / proxy) không cấu hình CORS.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={formData.useProxy}
              onChange={e => setFormData({ ...formData, useProxy: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Test Status Result */}
          {testResult && (
            <div
              className={`rounded-lg p-3 text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                  : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
              }`}
            >
              {testResult.success ? (
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <span className="break-all">{testResult.message}</span>
            </div>
          )}

          {/* Test Button & Save Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              disabled={testing || !formData.apiKey}
              onClick={handleTest}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {testing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang kiểm tra...
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-indigo-500" />
                  Kiểm tra kết nối
                </>
              )}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-sm transition-colors"
              >
                Lưu cài đặt
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
