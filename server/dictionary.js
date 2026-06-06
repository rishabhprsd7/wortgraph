/**
 * dictionary.js — external-source word verification (retrieval-augmented).
 *
 * Two-pass check, because a single source is wrong for German:
 *   1. Wiktionary (MediaWiki API) — fast, broad, but lemma-only: it has no
 *      pages for plurals (Verkehrsanbindungen) or most compounds (Zentralkartei).
 *   2. DWDS corpus frequency — for the words Wiktionary misses. DWDS lemmatizes
 *      the input and returns real corpus hit counts, so plurals and compounds
 *      that actually occur in German text pass. A word is only flagged when
 *      BOTH miss — which kills the false positives on real compounds/plurals.
 *
 * Design: FAIL-OPEN. A word is flagged (verified:false) only on a definitive
 * miss from both sources. Any network/API failure yields verified:null
 * (unknown) so we never reject a word because a lookup itself broke. Multi-word
 * phrases are skipped (not single dictionary entries).
 */

const WIKTIONARY_API = 'https://de.wiktionary.org/w/api.php';
const DWDS_FREQUENCY_API = 'https://www.dwds.de/api/frequency/';
const UA = 'WortgraphBot/1.0 (German vocabulary learning app)';

// fetch with a timeout so a slow source can't hang the whole audit.
async function fetchJson(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// DWDS corpus frequency for one lemma. Returns true if it occurs in German
// corpora, false if definitively absent, null if the lookup failed.
async function dwdsHasCorpusHits(lemma) {
  try {
    const data = await fetchJson(`${DWDS_FREQUENCY_API}?q=${encodeURIComponent(lemma)}`);
    // Response includes { hits, total, frequency }. hits>0 means it appears in
    // real text (lemmatized, so plurals/inflections count). frequency is a
    // log10 score 0-6; treat any positive score as corroboration too.
    const hits = Number(data?.hits);
    const freq = Number(data?.frequency);
    if (Number.isFinite(hits)) return hits > 0;
    if (Number.isFinite(freq)) return freq > 0;
    return null; // unexpected shape → unknown
  } catch {
    return null; // unreachable / aborted → unknown (fail-open)
  }
}

/**
 * Verify a batch of lemmas.
 * @param {string[]} lemmas
 * @returns {Promise<Object>} map: lemma -> { verified: true|false|null, source?: string }
 *   true  = found (Wiktionary entry, or DWDS corpus hits)
 *   false = definitively missing from BOTH sources (likely hallucinated)
 *   null  = phrase, or a lookup failed (be lenient — don't flag)
 */
export async function verifyWords(lemmas) {
  const out = {};
  const toLookup = [];

  for (const raw of lemmas) {
    const lemma = (raw || '').trim();
    if (!lemma) continue;
    // Phrases / multi-word expressions aren't single dictionary entries.
    if (lemma.includes(' ')) { out[lemma] = { verified: null, reason: 'phrase' }; continue; }
    toLookup.push(lemma);
  }

  // ── Pass 1: Wiktionary (batched, up to 50 titles per request) ──
  for (let i = 0; i < toLookup.length; i += 45) {
    const batch = toLookup.slice(i, i + 45);
    try {
      const titles = batch.map(encodeURIComponent).join('%7C'); // '|'
      const url = `${WIKTIONARY_API}?action=query&format=json&prop=info&redirects=1&titles=${titles}`;
      const data = await fetchJson(url);
      const pages = data?.query?.pages || {};

      const existing = new Set();
      for (const p of Object.values(pages)) {
        if (p && p.missing === undefined && p.pageid) existing.add(p.title);
      }
      const alias = new Map();
      for (const n of (data?.query?.normalized || [])) alias.set(n.from, n.to);
      for (const r of (data?.query?.redirects || [])) alias.set(r.from, r.to);

      for (const lemma of batch) {
        const canonical = alias.get(lemma) || lemma;
        const found = existing.has(canonical) || existing.has(lemma);
        out[lemma] = found ? { verified: true, source: 'wiktionary' } : { verified: false };
      }
    } catch (e) {
      for (const lemma of batch) out[lemma] = { verified: null, reason: 'lookup-failed' };
      console.error('Wiktionary verify failed:', e.message);
    }
  }

  // ── Pass 2: DWDS corpus frequency, only for Wiktionary misses ──
  // This rescues real plurals/compounds Wiktionary has no entry for.
  const misses = toLookup.filter(l => out[l]?.verified === false);
  for (const lemma of misses) {
    const inCorpus = await dwdsHasCorpusHits(lemma);
    if (inCorpus === true) out[lemma] = { verified: true, source: 'dwds' };
    else if (inCorpus === null) out[lemma] = { verified: null, reason: 'dwds-unknown' };
    // inCorpus === false → leave verified:false (missing from both sources)
  }

  return out;
}

