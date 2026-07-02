import { Platform } from 'react-native';

/**
 * Plays a short two-tone notification "ping" using the Web Audio API. The
 * desktop consoles (where notifications surface) run on react-native-web, so a
 * synthesized tone keeps us dependency- and asset-free. A no-op on native and
 * anywhere Web Audio is unavailable — sound is strictly best-effort.
 *
 * Browsers gate audio until the user has interacted with the page; once they
 * have (clicking around the console), the context resumes and the ping plays.
 */

let ctx: AudioContext | null = null;

export function playNotificationSound(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    if (!ctx) ctx = new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();

    const start = ctx.currentTime;
    const tone = (freq: number, at: number, dur: number) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Quick attack, gentle exponential release — a soft, non-jarring chime.
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.linearRampToValueAtTime(0.18, start + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + dur);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start + at);
      osc.stop(start + at + dur);
    };

    tone(880, 0, 0.18); // A5
    tone(1318.5, 0.15, 0.22); // E6
  } catch {
    // Best-effort: ignore any audio failure.
  }
}
