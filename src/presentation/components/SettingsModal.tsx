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
  Sliders,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ModelOption, TTSSettings, VoiceOption } from '@/domain';
import { TTSClientFactory } from '@/infrastructure';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TTSSettings;
  onSave: (settings: TTSSettings) => void;
}

const PRESET_ENDPOINTS = [
  { label: 'VieNeu-TTS (Local Stream)', url: 'http://localhost:8000/v1', model: 'vieneu-v3-turbo', voice: 'Mai Anh', format: 'pcm' },
  { label: 'OpenAI (Chính thức)', url: 'https://api.openai.com/v1', model: 'tts-1', voice: 'alloy', format: 'mp3' },
  { label: 'Custom / Proxy (WAV)', url: 'https://api.openai.com/v1', model: 'tts-1', voice: 'alloy', format: 'wav' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1', model: 'playdialog', voice: 'alloy', format: 'wav' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/tts-1', voice: 'alloy', format: 'wav' },
];

const SUGGESTED_VOICES = ['Mai Anh', 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'Puck', 'Aoede', 'Fenrir', 'Kore'];
const FORMAT_OPTIONS = [
  { value: 'pcm', label: 'PCM (Low Latency)' },
  { value: 'wav', label: 'WAV' },
  { value: 'mp3', label: 'MP3' },
  { value: 'opus', label: 'Opus' },
  { value: 'aac', label: 'AAC' },
  { value: 'flac', label: 'FLAC' },
];

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const [formData, setFormData] = useState<TTSSettings>({
    ...settings,
    responseFormat: settings.responseFormat || 'wav',
    sampleRate: settings.sampleRate || 24000,
    maxChars: settings.maxChars || 200,
    temperature: settings.temperature ?? 0.8,
    topK: settings.topK ?? 25,
    topP: settings.topP ?? 0.95,
    repetitionPenalty: settings.repetitionPenalty ?? 1.2,
  });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-fetch voices state
  const [fetchedVoices, setFetchedVoices] = useState<VoiceOption[]>([]);
  const [fetchingVoices, setFetchingVoices] = useState(false);
  const [voicesFeedback, setVoicesFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-fetch models state
  const [fetchedModels, setFetchedModels] = useState<ModelOption[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelsFeedback, setModelsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handlePresetSelect = (preset: typeof PRESET_ENDPOINTS[0]) => {
    setFormData(prev => ({
      ...prev,
      endpoint: preset.url,
      model: preset.model,
      voice: preset.voice,
      responseFormat: preset.format,
      sampleRate: preset.format === 'pcm' ? 24000 : prev.sampleRate,
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
      const client = TTSClientFactory.create(formData);
      const voices = await client.fetchVoices(formData.endpoint, formData.apiKey, formData.useProxy);
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

  const handleFetchModels = async () => {
    if (!formData.endpoint) {
      setModelsFeedback({ type: 'error', message: 'Vui lòng nhập Endpoint URL trước.' });
      return;
    }
    setFetchingModels(true);
    setModelsFeedback(null);
    try {
      const client = TTSClientFactory.create(formData);
      const models = await client.fetchModels(formData.endpoint, formData.apiKey, formData.useProxy);
      if (models.length === 0) {
        setModelsFeedback({
          type: 'error',
          message: 'Endpoint trả về 0 models. Hãy kiểm tra lại endpoint hoặc API key.',
        });
      } else {
        setFetchedModels(models);
        setModelsFeedback({
          type: 'success',
          message: `Đã tìm thấy ${models.length} models từ GET /v1/models!`,
        });
        const exists = models.some(m => m.id.toLowerCase() === formData.model.toLowerCase());
        if (!exists && models.length > 0) {
          setFormData(prev => ({ ...prev, model: models[0].id }));
        }
      }
    } catch (err: unknown) {
      setModelsFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể tải danh sách models từ endpoint.',
      });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const client = TTSClientFactory.create(formData);
      const res = await client.testConnection(formData);
      setTestResult(res);
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi kết nối không xác định',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-indigo-600" />
              Cài đặt TTS & Giọng đọc
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Cấu hình endpoint API VieNeu-TTS hoặc OpenAI
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 text-left">
          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Cấu hình mẫu nhanh
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ENDPOINTS.map(p => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => handlePresetSelect(p)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                    formData.endpoint === p.url && formData.model === p.model
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 font-medium'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint URL */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Endpoint URL
            </label>
            <input
              type="text"
              required
              placeholder="http://localhost:8000/v1"
              value={formData.endpoint}
              onChange={e => setFormData({ ...formData, endpoint: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Mặc định: <code className="text-zinc-500">http://localhost:8000/v1</code> (VieNeu-TTS) hoặc <code className="text-zinc-500">https://api.openai.com/v1</code>
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="VIENEU_API_KEY hoặc sk-..."
                value={formData.apiKey}
                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-3 pr-10 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Nếu chạy VieNeu-TTS cục bộ không cài đặt API Key, bạn có thể để trống hoặc điền bất kỳ chuỗi nào.
            </p>
          </div>

          {/* Model selection */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Mô hình TTS (Model)
              </label>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={fetchingModels || !formData.endpoint}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${fetchingModels ? 'animate-spin' : ''}`} />
                Tải danh sách Models
              </button>
            </div>
            <input
              type="text"
              value={formData.model}
              onChange={e => setFormData({ ...formData, model: e.target.value })}
              placeholder="vieneu-v3-turbo hoặc tts-1"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            {modelsFeedback && (
              <p className={`text-[11px] mt-1 ${modelsFeedback.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                {modelsFeedback.message}
              </p>
            )}
            {fetchedModels.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {fetchedModels.map(m => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setFormData({ ...formData, model: m.id })}
                    className={`px-2 py-0.5 rounded text-[11px] border font-mono transition-all ${
                      formData.model.toLowerCase() === m.id.toLowerCase()
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                    }`}
                  >
                    {m.name || m.id}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice selection */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Giọng đọc (Voice)
              </label>
              <button
                type="button"
                onClick={handleFetchVoices}
                disabled={fetchingVoices || !formData.endpoint}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${fetchingVoices ? 'animate-spin' : ''}`} />
                Tải danh sách Voices
              </button>
            </div>
            <input
              type="text"
              value={formData.voice}
              onChange={e => setFormData({ ...formData, voice: e.target.value })}
              placeholder="Mai Anh, alloy, vv."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            {voicesFeedback && (
              <p className={`text-[11px] mt-1 ${voicesFeedback.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                {voicesFeedback.message}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(fetchedVoices.length > 0 ? fetchedVoices.map(v => v.name || v.id) : SUGGESTED_VOICES).map(v => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setFormData({ ...formData, voice: v })}
                  className={`px-2 py-0.5 rounded text-[11px] border font-mono transition-all ${
                    formData.voice.toLowerCase() === v.toLowerCase()
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-semibold'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Response Format */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Music className="h-3.5 w-3.5 text-indigo-500" />
                Định dạng âm thanh (response_format)
              </label>
              <span className="text-[11px] font-mono text-indigo-600 font-medium">
                {formData.responseFormat || 'pcm'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
                  Chuyển tiếp stream trực tiếp không làm tăng độ trễ (hỗ trợ CORS cho local endpoints).
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

          {/* Prefetch Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Tự động tải trước đoạn kế tiếp (Background Pipeline)
                </p>
                <p className="text-[11px] text-zinc-400">
                  Chủ động tải đoạn tiếp theo trước khi đoạn hiện tại kết thúc để chuyển đổi 0ms không ngắt quãng.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={formData.enablePrefetch ?? true}
              onChange={e => setFormData({ ...formData, enablePrefetch: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Expandable Advanced VieNeu Settings */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/30">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-indigo-500" />
                Cài đặt nâng cao (VieNeu-TTS Streaming)
              </span>
              {showAdvanced ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
            </button>

            {showAdvanced && (
              <div className="p-4 pt-1 space-y-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
                {/* Sample Rate */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Sample Rate (Tần số lấy mẫu)
                    </label>
                    <span className="font-mono text-indigo-600 font-medium">
                      {formData.sampleRate || 24000} Hz
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[24000, 48000].map(rate => (
                      <button
                        type="button"
                        key={rate}
                        onClick={() => setFormData({ ...formData, sampleRate: rate })}
                        className={`py-1.5 px-3 rounded-lg border text-center font-mono ${
                          (formData.sampleRate || 24000) === rate
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-semibold'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        {rate === 48000 ? '48,000 Hz (Native VieNeu)' : '24,000 Hz (OpenAI Standard)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Chars */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Kích thước chunk tối đa (max_chars)
                    </label>
                    <span className="font-mono text-indigo-600 font-medium">
                      {formData.maxChars ?? 200} ký tự
                    </span>
                  </div>
                  <input
                    type="range"
                    min={150}
                    max={350}
                    step={10}
                    value={formData.maxChars ?? 200}
                    onChange={e => setFormData({ ...formData, maxChars: parseInt(e.target.value, 10) })}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Khuyến nghị VieNeu v3 Turbo: 150–250 ký tự (chuẩn: 200 ký tự ~30–50 từ), tối đa 350 ký tự để giữ ngữ điệu tự nhiên và tránh vỡ frame budget.
                  </p>
                </div>

                {/* Temperature */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Temperature
                    </label>
                    <span className="font-mono text-indigo-600 font-medium">
                      {(formData.temperature ?? 0.8).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
                    max={1.5}
                    step={0.05}
                    value={formData.temperature ?? 0.8}
                    onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Top K */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Top K
                    </label>
                    <span className="font-mono text-indigo-600 font-medium">
                      {formData.topK ?? 25}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={formData.topK ?? 25}
                    onChange={e => setFormData({ ...formData, topK: parseInt(e.target.value, 10) })}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>
            )}
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
              disabled={testing}
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
