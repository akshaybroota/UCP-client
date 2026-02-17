
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { method, path, body, headers: ucpHeaders, baseUrl } = await req.json();
    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: ucpHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { response: text };
    }

    return NextResponse.json({
      data,
      debug: {
        sentHeaders: ucpHeaders,
        url
      }
    }, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
