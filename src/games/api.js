import { flashcards as staticCards } from '../data/vocab';

export const API_URL = import.meta.env.VITE_API_URL || '';

// Fetch a generated round from a graph-game endpoint.
// Resolves to { data } or { error, message } — never throws.
// `validate(body)` optionally checks the round shape; an invalid shape is
// turned into an error round (→ "Try again" UI) instead of crashing the game.
export async function fetchRound(path, { userId, exclude = [] }, validate) {
  if (!API_URL) return { error: 'noapi', message: 'Backend not configured.' };
  const qs = new URLSearchParams({ userId: userId || 'default' });
  if (exclude.length) qs.set('exclude', exclude.join(','));
  try {
    const res = await fetch(`${API_URL}/${path}?${qs}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error || 'error', message: body.message || 'Could not build a round.' };
    if (validate && !validate(body)) return { error: 'badround', message: 'Could not build a valid round — try the next one.' };
    return { data: body };
  } catch {
    return { error: 'network', message: 'Network error — is the server running?' };
  }
}

// Deck for client-only games. Falls back to the static demo deck so the
// Arena is never empty, even with no backend (consistent with Crossword).
export async function loadDeck(userId) {
  if (API_URL) {
    try {
      const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`${API_URL}/api/words${q}`);
      const all = await res.json();
      if (Array.isArray(all) && all.length >= 4) return all;
    } catch { /* fall through to static */ }
  }
  return staticCards;
}

// Write a review result back to the graph (retention update). Best-effort.
export function recordReview(userId, word, correct) {
  if (!API_URL || !word) return;
  fetch(`${API_URL}/api/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userId || 'default', word, correct }),
  }).catch(() => {});
}
