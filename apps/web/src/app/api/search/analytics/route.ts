import { NextResponse } from 'next/server';

/** 搜索交互事件采集（预留后端聚合；当前仅校验并返回 204）。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      type?: string;
      query?: string;
    };

    if (!body.sessionId || !body.type || !body.query?.trim()) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }

    if (process.env.NODE_ENV === 'development') {
      console.info('[search-analytics]', body);
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
