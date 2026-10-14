import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, apiKey, model, input, voice, speed } = body;
    const format = body.response_format || body.responseFormat || 'wav';

    if (!input || !apiKey) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc: API Key hoặc nội dung văn bản (input).' },
        { status: 400 }
      );
    }

    const cleanEndpoint = (endpoint || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
    const targetUrl = cleanEndpoint.endsWith('/audio/speech')
      ? cleanEndpoint
      : `${cleanEndpoint}/audio/speech`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'tts-1',
        input: input,
        voice: voice || 'alloy',
        speed: typeof speed === 'number' ? speed : 1.0,
        response_format: format,
      }),
    });

    if (!response.ok) {
      let errorMessage = `API trả về mã lỗi ${response.status} (${response.statusText})`;
      try {
        const errorJson = await response.json();
        if (errorJson?.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson?.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // Fall back to status text
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || (format === 'mp3' ? 'audio/mpeg' : 'audio/wav');

    return new NextResponse(audioArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioArrayBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định khi proxy TTS API';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
