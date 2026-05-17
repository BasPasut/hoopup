import { NextRequest, NextResponse } from 'next/server';
import { getSession, setSession } from '@/lib/redis';
import { Session } from '@/lib/types';

type Params = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { code } = await params;
  const session = await getSession(code.toUpperCase());
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const existing = await getSession(code.toUpperCase());
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updates = await req.json();
    const updated: Session = {
      ...existing,
      ...updates,
      code: existing.code, // never overwrite code
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    await setSession(updated);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Update session error:', err);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
