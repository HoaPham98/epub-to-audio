'use client';

import React, { useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Volume2,
  ShieldCheck,
  Music,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { TTSSettings } from '@/types';
import { testTTSConnection, fetchAvailableVoices, VoiceOption } from '@/lib/tts';

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
  { value: 'wav', label: 'WAV' },
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

  // Auto-fetch voices state
  const [fetchedVoices, setFetchedVoices] = useState<VoiceOption[]>([]);
  const [fetchingVoices, setFetchingVoices] = useState(false);
  const [voicesFeedback, setVoicesFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const handleFetchVoices = async () => {
    if (!formData.endpoint) {
      setVoicesFeedback({ type: 'error', message: 'Vui lòng nhập Endpoint URL trước.' });
      return;
    }
    setFetchingVoices(true);
    setVoicesFeedback(null);
    try {
      const voices = await fetchAvailableVoices(formData.endpoint, formData.apiKey, formData.useProxy);
      if (voices.length === 0) {
        setVoicesFeedback({
          type: 'error',
          message: 'Endpoint trả về 0 giọng đọc. Hãy kiểm tra lại endpoint hoặc API key.',
        });
      } else {
        setFetchedVoices(voices);
        setVoicesFeedback({
          type: 'success',
          message: `Đã tìm thấy ${voices.length} giọng đọc từ GET /v1/voices!`,
        });
        // If current voice not in list, auto-select the first one
        const exists = voices.some(v => v.id.toLowerCase() === formData.voice.toLowerCase());
        if (!exists && voices.length > 0) {
          setFormData(prev => ({ ...prev, voice: voices[0].id }));
        }
      }
    } catch (err: unknown) {
      setVoicesFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể tải danh sách voices từ endpoint.',
      });
    } finally {
      setFetchingVoices(false);
    }
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
              Cấu hình endpoint tương thích API /v1/audio/speech & /v1/voices
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
              Hỗ trợ tự động gọi <code className="text-indigo-500">/audio/speech</code> và <code className="text-indigo-500">/voices</code>.
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

          {/* Voice Input with Auto-Fetch from GET /v1/voices */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Giọng đọc (Voice)
              </label>

              {/* Auto-Fetch Button */}
              <button
                type="button"
                disabled={fetchingVoices}
                onClick={handleFetchVoices}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-medium border border-indigo-200 dark:border-indigo-800 transition-colors disabled:opacity-50"
                title="Tự động gọi GET /v1/voices từ endpoint để lấy danh sách giọng đọc"
              >
                <RefreshCw className={`h-3 w-3 ${fetchingVoices ? 'animate-spin' : ''}`} />
                <span>{fetchingVoices ? 'Đang lấy giọng...' : 'Tự động lấy giọng (/v1/voices)'}</span>
              </button>
            </div>

            {/* Direct Input Field */}
            <input
              type="text"
              value={formData.voice}
              onChange={e => setFormData({ ...formData, voice: e.target.value })}
              placeholder="VD: alloy, nova, Puck, Aoede, ..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:outline-hidden"
            />

            {/* Voices Feedback Banner */}
            {voicesFeedback && (
              <p
                className={`text-[11px] font-medium ${
                  voicesFeedback.type === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {voicesFeedback.message}
              </p>
            )}

            {/* Fetched Voices from Server or Fallback Suggestions */}
            <div>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                {fetchedVoices.length > 0
                  ? `Giọng đọc từ server (${fetchedVoices.length} giọng):`
                  : 'Gợi ý giọng đọc phổ biến:'}
              </p>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-white/50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800">
                {(fetchedVoices.length > 0 ? fetchedVoices : SUGGESTED_VOICES.map((v): VoiceOption => ({ id: v, name: v }))).map(v => {
                  const isSelected = formData.voice.toLowerCase() === v.id.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => setFormData({ ...formData, voice: v.id })}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                          : 'bg-zinc-100 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {v.name || v.id}
                      {v.language && <span className="opacity-70 text-[9px] ml-1">({v.language})</span>}
                    </button>
                  );
                })}
              </div>
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
                  {fmt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Nếu server không hỗ trợ MP3, hãy chọn <strong className="text-zinc-600 dark:text-zinc-300">WAV</strong> hoặc <strong className="text-zinc-600 dark:text-zinc-300">PCM</strong>.
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
