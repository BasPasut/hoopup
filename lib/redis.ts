import { Redis } from '@upstash/redis';
import { Session } from './types';

// Falls back gracefully when env vars aren't set (local dev without Redis)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// In-memory fallback for local dev
const memStore = new Map<string, Session>();

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export async function getSession(code: string): Promise<Session | null> {
  const client = getRedis();
  if (client) {
    return client.get<Session>(`session:${code.toUpperCase()}`);
  }
  return memStore.get(code.toUpperCase()) ?? null;
}

export async function setSession(session: Session): Promise<void> {
  const client = getRedis();
  if (client) {
    await client.set(`session:${session.code}`, session, { ex: SESSION_TTL });
  } else {
    memStore.set(session.code, session);
  }
}

export async function getSessionsByDate(date: string): Promise<Session[]> {
  const client = getRedis();
  if (!client) {
    return Array.from(memStore.values()).filter((s) => s.date === date);
  }
  const keys = await client.keys(`session:*`);
  if (!keys.length) return [];
  const sessions = await Promise.all(keys.map((k) => client.get<Session>(k)));
  return sessions.filter((s): s is Session => s !== null && s.date === date);
}
