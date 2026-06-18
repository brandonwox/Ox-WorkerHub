import { useEffect, useState } from 'react';

interface Options {
  /** ms per typed character. */
  typeMs?: number;
  /** ms per deleted character. */
  deleteMs?: number;
  /** ms to hold a fully-typed phrase before deleting. */
  holdMs?: number;
  /** ms to wait between phrases. */
  gapMs?: number;
}

/**
 * Cycles through `phrases`, typing then deleting each one, and returns the
 * current partial string. Pass a STABLE `phrases` reference (e.g. a module-level
 * const) — a new array each render restarts the animation.
 */
export function useTypewriter(
  phrases: string[],
  { typeMs = 65, deleteMs = 30, holdMs = 1500, gapMs = 400 }: Options = {}
): string {
  const [text, setText] = useState('');

  useEffect(() => {
    if (phrases.length === 0) return;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const phrase = phrases[phraseIndex];
      if (!deleting) {
        charIndex += 1;
        setText(phrase.slice(0, charIndex));
        if (charIndex >= phrase.length) {
          deleting = true;
          timer = setTimeout(tick, holdMs);
          return;
        }
        timer = setTimeout(tick, typeMs);
      } else {
        charIndex -= 1;
        setText(phrase.slice(0, charIndex));
        if (charIndex <= 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timer = setTimeout(tick, gapMs);
          return;
        }
        timer = setTimeout(tick, deleteMs);
      }
    };

    timer = setTimeout(tick, typeMs);
    return () => clearTimeout(timer);
  }, [phrases, typeMs, deleteMs, holdMs, gapMs]);

  return text;
}
