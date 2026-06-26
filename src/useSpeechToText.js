/**
 * useSpeechToText — live speech-to-text via the browser Web Speech API.
 *
 * Like Google Translate's voice button: press start, speak German (or point the
 * mic at German audio), and final transcript chunks are delivered to
 * onFinalText while interim (in-progress) text is exposed as `interim`.
 *
 * Entirely client-side — no server, no API key, no cost. Supported in Chrome,
 * Edge and Safari; not in Firefox (`supported` is false there). Requires HTTPS
 * (or localhost) and microphone permission.
 */
import { useRef, useState, useCallback, useEffect } from 'react';

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export function useSpeechToText({ lang = 'de-DE', onFinalText } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);

  const recRef = useRef(null);
  const wantRef = useRef(false);          // user intent — survives auto-restart
  const onFinalRef = useRef(onFinalText); // always call the latest callback
  onFinalRef.current = onFinalText;

  const stop = useCallback(() => {
    wantRef.current = false;
    try { recRef.current?.stop(); } catch { /* not started */ }
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    if (!SR) { setError('unsupported'); return; }
    if (wantRef.current) return; // already listening
    setError(null);
    wantRef.current = true;

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let final = '', live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const seg = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += seg;
        else live += seg;
      }
      if (final.trim()) onFinalRef.current?.(final.trim() + ' ');
      setInterim(live);
    };

    rec.onerror = (e) => {
      const err = e.error || 'error';
      setError(err);
      // Permission errors must not auto-restart (would loop forever).
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        wantRef.current = false;
        setListening(false);
      }
      // 'no-speech' / 'aborted' / 'network' fall through to onend, which
      // restarts if the user still wants to listen.
    };

    rec.onend = () => {
      setInterim('');
      if (wantRef.current) {
        // Chrome ends the session after a pause even in continuous mode —
        // restart to keep listening until the user presses stop.
        try { rec.start(); } catch { /* will retry on next onend */ }
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    try { rec.start(); setListening(true); }
    catch { wantRef.current = false; setListening(false); setError('start-failed'); }
  }, [lang]);

  // Abort cleanly if the component unmounts mid-listen.
  useEffect(() => () => {
    wantRef.current = false;
    try { recRef.current?.abort(); } catch { /* ignore */ }
  }, []);

  return { supported: !!SR, listening, interim, error, start, stop };
}
