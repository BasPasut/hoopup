import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/redis';
import { Session, SessionSettings } from '@/lib/types';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const settings: SessionSettings = {
      gameMode: body.gameMode ?? '5v5',
      tournamentType: body.tournamentType ?? 'king-of-court',
      timerDuration: body.timerDuration ?? 480,
      consecutiveWinsToRest: body.consecutiveWinsToRest ?? 2,
      restRounds: body.restRounds ?? 1,
      sessionName: body.sessionName ?? 'Sunday Basketball',
    };

    const now = new Date();
    const session: Session = {
      id: crypto.randomUUID(),
      code: generateCode(),
      createdAt: now.toISOString(),
      date: now.toISOString().split('T')[0],
      settings,
      players: [],
      teams: [],
      queue: [],
      currentMatch: null,
      completedMatches: [],
      status: 'setup',
      updatedAt: now.toISOString(),
    };

    await setSession(session);
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    console.error('Create session error:', err);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
