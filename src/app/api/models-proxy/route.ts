import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, apiKey } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Thiếu endpoint URL' }, { status: 400 });
    }

    let cleanEndpoint = endpoint.trim().replace(/\/+$/, '');
    if (cleanEndpoint.endsWith('/audio/speech')) {
      cleanEndpoint = cleanEndpoint.replace(/\/audio\/speech$/, '');
    }

    const targetUrl = cleanEndpoint.endsWith('/models')
      ? cleanEndpoint
      : `${cleanEndpoint}/models`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Mã lỗi ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson?.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // Fall back
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định khi fetch models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
