export interface PendingGameResult {
  id: string;
  score: number;
}

export const PENDING_RESULT_KEY = 'food-order-pending-game-v1';

export function createGameResult(score: number): PendingGameResult {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return { id, score };
}

export function readPendingGameResult(): PendingGameResult | null {
  try {
    const raw = sessionStorage.getItem(PENDING_RESULT_KEY);
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || !('id' in data) || !('score' in data)) return null;
    const { id, score } = data;
    if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) return null;
    if (typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0) return null;
    return { id, score };
  } catch {
    return null;
  }
}

export function rememberGameResult(result: PendingGameResult): boolean {
  try {
    sessionStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(result));
    return true;
  } catch {
    return false;
  }
}

export function forgetGameResult(id: string) {
  try {
    if (readPendingGameResult()?.id === id) sessionStorage.removeItem(PENDING_RESULT_KEY);
  } catch {
    // If cleanup fails, IndexedDB still recognizes the round on the next retry.
  }
}
