import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      endpoint,
      apiKey,
      model,
      input,
      voice,
      speed,
      stream_format,
      streamFormat,
      response_format,
      responseFormat,
      sample_rate,
      sampleRate,
      max_chars,
      maxChars,
      temperature,
      top_k,
      topK,
      top_p,
      topP,
      repetition_penalty,
      repetitionPenalty,
    } = body;

    if (!input) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc: nội dung văn bản (input).' },
        { status: 400 }
      );
    }

    const cleanEndpoint = (endpoint || 'http://localhost:8000/v1').trim().replace(/\/+$/, '');
    const targetUrl = cleanEndpoint.endsWith('/audio/speech')
      ? cleanEndpoint
      : `${cleanEndpoint}/audio/speech`;

    const sseStream = (stream_format || streamFormat) === 'sse';
    const chosenFormat = response_format || responseFormat || (sseStream ? 'pcm' : 'wav');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }
    if (sseStream) {
      headers['Accept'] = 'text/event-stream';
    }

    const payload: Record<string, unknown> = {
      model: model || 'vieneu-v3-turbo',
      input,
      voice: voice || 'Mai Anh',
      speed: typeof speed === 'number' ? speed : 1.0,
      response_format: chosenFormat,
    };

    if (sseStream) {
      payload.stream_format = 'sse';
    }
    if (sample_rate || sampleRate) {
      payload.sample_rate = sample_rate || sampleRate;
    }
    if (max_chars || maxChars) {
      payload.max_chars = max_chars || maxChars;
    }
    if (temperature !== undefined) payload.temperature = temperature;
    if (top_k !== undefined || topK !== undefined) payload.top_k = top_k ?? topK;
    if (top_p !== undefined || topP !== undefined) payload.top_p = top_p ?? topP;
    if (repetition_penalty !== undefined || repetitionPenalty !== undefined) {
      payload.repetition_penalty = repetition_penalty ?? repetitionPenalty;
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: req.signal,
    });

    if (!upstreamResponse.ok) {
      let errorMessage = `API trả về mã lỗi ${upstreamResponse.status} (${upstreamResponse.statusText})`;
      try {
        const errorJson = await upstreamResponse.json();
        if (errorJson?.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson?.message) {
          errorMessage = errorJson.message;
        } else if (errorJson?.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // Fall back to status text
      }
      return NextResponse.json({ error: errorMessage }, { status: upstreamResponse.status });
    }

    const contentType =
      upstreamResponse.headers.get('content-type') ||
      (sseStream ? 'text/event-stream; charset=utf-8' : 'audio/wav');

    // Stream passthrough without buffering entire body into server RAM
    return new Response(upstreamResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: unknown) {
    if (req.signal?.aborted) {
      return new Response(null, { status: 499 });
    }
    const message = err instanceof Error ? err.message : 'Lỗi không xác định khi proxy TTS API';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
