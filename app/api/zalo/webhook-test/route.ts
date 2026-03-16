import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ ok: true }, { status: 200 });
}
