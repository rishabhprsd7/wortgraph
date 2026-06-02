/**
 * dictionary.js — external-dictionary verification (retrieval-augmented).
 *
 * Validates that a German lemma actually exists by looking it up in Wiktionary
 * via the MediaWiki API (free, no key, broad coverage incl. many compounds).
 * This grounds word validation in an authoritative external source instead of
 * trusting the extraction LLM — which is how hallucinated words like
 * "Gaukartei" slip into the deck.
 *
 * Design: FAIL-OPEN. A real dictionary miss returns verified:false, but any
 * network/API failure returns verified:null (unknown) so we never wrongly
 * reject a word just because the lookup itself broke. Multi-word phrases are
 * skipped (dictionaries don't list collocations) and treated as unknown.
 */

const WIKTIONARY_API = 'https://de.wiktionary.org/w/api.php';
const UA = 'WortgraphBot/1.0 (German vocabulary learning app)';

/**
 * Verify a batch of lemmas against German Wiktionary.
 * @param {string[]} lemmas
 * @returns {Promise<Object>} map: lemma -> { verified: true|false|null, title?: string }
 *   true  = found in Wiktionary
 *   false = looked up, definitively missing (likely hallucinated/misspelled)
 *   null  = not checked (phrase) or lookup failed (be lenient)
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

  // MediaWiki accepts up to 50 titles per request, pipe-separated.
  for (let i = 0; i < toLookup.length; i += 45) {
    const batch = toLookup.slice(i, i + 45);
    try {
      const titles = batch.map(encodeURIComponent).join('%7C'); // '|'
      const url = `${WIKTIONARY_API}?action=query&format=json&prop=info&redirects=1&titles=${titles}`;
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const pages = data?.query?.pages || {};

      // Build a set of titles that exist (pageid present, no "missing" flag).
      // Honour normalisation + redirect mappings the API returns.
      const existing = new Set();
      for (const p of Object.values(pages)) {
        if (p && p.missing === undefined && p.pageid) existing.add(p.title);
      }
      const alias = new Map(); // input title -> canonical title
      for (const n of (data?.query?.normalized || [])) alias.set(n.from, n.to);
      for (const r of (data?.query?.redirects || [])) alias.set(r.from, r.to);

      for (const lemma of batch) {
        const canonical = alias.get(lemma) || lemma;
        out[lemma] = { verified: existing.has(canonical) || existing.has(lemma) };
      }
    } catch (e) {
      // Fail-open: lookup broke, mark this batch unknown rather than rejecting.
      for (const lemma of batch) out[lemma] = { verified: null, reason: 'lookup-failed' };
      console.error('Wiktionary verify failed:', e.message);
    }
  }

  return out;
}
