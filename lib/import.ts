import { Player, Position } from './types';

const VALID_POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

function makePlayer(name: string, positions: Position[], skillLevel: number): Player {
  return {
    id: crypto.randomUUID(),
    name,
    positions,
    skillLevel,
    isAvailable: true,
    stats: { gamesPlayed: 0, wins: 0 },
  };
}

function parseHoopUpFormat(text: string): Player[] {
  const lines = text.split('\n');
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^name\s*:/i.test(line.trim()) && current.length > 0) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  const players: Player[] = [];
  for (const block of blocks) {
    const blockText = block.join('\n');
    const nameMatch = blockText.match(/^name\s*:\s*(.+)/im);
    if (!nameMatch) continue;

    const name = nameMatch[1].trim();
    if (!name || name.startsWith('[') || /your name/i.test(name)) continue;

    const posMatch = blockText.match(/^position\s*:\s*(.*)/im);
    let positions: Position[] = [];
    if (posMatch) {
      const tokens = posMatch[1].toUpperCase().split(/[\s,/]+/);
      positions = tokens.filter((t): t is Position => (VALID_POSITIONS as string[]).includes(t));
    }
    if (positions.length === 0) positions = [...VALID_POSITIONS];

    const levelMatch = blockText.match(/^level\s*:\s*(.*)/im);
    let skillLevel = 3;
    if (levelMatch) {
      const num = parseInt(levelMatch[1]);
      if (!isNaN(num) && num >= 1 && num <= 5) skillLevel = num;
    }

    players.push(makePlayer(name, positions, skillLevel));
  }
  return players;
}

function parseLineListFormat(text: string): { players: Player[]; sessionName?: string } {
  const lines = text.split('\n').map((l) => l.trim());
  let sessionName: string | undefined;
  let startIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    if (lines[i].includes(':')) {
      const afterColon = lines[i].slice(lines[i].indexOf(':') + 1).trim();
      if (afterColon) sessionName = afterColon;
      startIdx = i + 1;
    }
    break;
  }

  const players: Player[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const numbered = line.match(/^\d+\.\s*(.+)/);
    const name = numbered ? numbered[1].trim() : line;
    if (name) players.push(makePlayer(name, [...VALID_POSITIONS], 3));
  }

  return { players, sessionName };
}

export function parseAny(text: string): { players: Player[]; sessionName?: string } {
  if (/^name\s*:/im.test(text)) return { players: parseHoopUpFormat(text) };
  return parseLineListFormat(text);
}
