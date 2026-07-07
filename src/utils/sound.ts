import { Platform } from 'react-native';

/**
 * Plays a short two-tone notification "ping" using the Web Audio API. The
 * desktop consoles (where notifications surface) run on react-native-web, so a
 * synthesized tone keeps us dependency- and asset-free. A no-op on native and
 * anywhere Web Audio is unavailable — sound is strictly best-effort.
 *
 * Browsers gate audio behind a user gesture: an AudioContext created outside of
 * one starts `suspended`, and on Safari `resume()` only works when called from
 * within a gesture handler. A notification arrives on a realtime event — never a
 * gesture — so if we created the context lazily at ping time it would stay
 * muted. Instead we UNLOCK the context on the first click/keypress (see
 * `installAudioUnlock`), so it's already running by the time a ping fires.
 */

let ctx: AudioContext | null = null;
let unlockInstalled = false;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const Ctx: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  return ctx;
}

/**
 * On the first user gesture, create and resume the AudioContext (playing a
 * near-silent blip to satisfy the autoplay policy), then stop listening. After
 * this the context is `running`, so later pings play without a gesture of their
 * own. Idempotent and safe to call repeatedly.
 */
export function installAudioUnlock(): void {
  if (unlockInstalled || Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  unlockInstalled = true;

  const unlock = () => {
    const c = getAudioContext();
    if (!c) return;
    if (c.state === 'suspended') void c.resume();
    try {
      // A one-sample, effectively silent buffer — enough to flip the context to
      // "running" inside the gesture on stricter browsers (Safari/iOS).
      const buf = c.createBuffer(1, 1, c.sampleRate);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    } catch {
      // Best-effort.
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock);
}

export function playNotificationSound(): void {
  const c = getAudioContext();
  if (!c) return;
  try {
    // If the context is still suspended (no gesture yet, or the browser paused
    // it), resume first and schedule once it's actually running — scheduling on
    // a suspended context can silently drop the tones.
    if (c.state === 'suspended') {
      void c.resume().then(() => schedulePing(c)).catch(() => {});
      return;
    }
    schedulePing(c);
  } catch {
    // Best-effort: ignore any audio failure.
  }
}

/** Schedules the two-tone chime on an already-running context. */
function schedulePing(c: AudioContext): void {
  const start = c.currentTime;
  const tone = (freq: number, at: number, dur: number) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Quick attack, gentle exponential release — a soft, non-jarring chime.
    gain.gain.setValueAtTime(0.0001, start + at);
    gain.gain.linearRampToValueAtTime(0.18, start + at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(start + at);
    osc.stop(start + at + dur);
  };

  tone(880, 0, 0.18); // A5
  tone(1318.5, 0.15, 0.22); // E6
}
