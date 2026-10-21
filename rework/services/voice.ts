// Spoken guidance via expo-speech. Module-level state: there is only ever one voice.
import * as Speech from 'expo-speech';
import type { CameraType, CameraWarning } from '../types';

const CAMERA_PHRASE: Record<CameraType, string> = {
  average: 'average speed check',
  red_light: 'red light camera',
  mobile: 'mobile speed check',
  fixed: 'speed camera',
  police: 'police',
};

let muted = false;
let lastManeuverKey: string | null = null;
let lastCameraKey: string | null = null;
let lastCameraAt = 0;
let lastLimit: number | null = null;

// The platform default is often the small "compact" voice, which is what sounds robotic.
// Pick the most natural English voice the device has installed instead.
let voiceId: string | undefined;
let picking: Promise<void> | null = null;

/** Higher is more natural: Premium > Enhanced > default; novelty/Eloquence voices excluded. */
export function voiceScore(v: Speech.Voice): number {
  if (!/^en[-_]/i.test(v.language)) return -1;
  const id = v.identifier.toLowerCase();
  // iOS joke voices (Zarvox, Bubbles...) and the retro Eloquence set (Eddy, Flo...) sound synthetic.
  if (id.includes('speech.synthesis.voice') || id.includes('eloquence')) return -1;
  let score = 1;
  if (id.includes('premium')) score += 4;
  else if (v.quality === Speech.VoiceQuality.Enhanced || id.includes('enhanced')) score += 3;
  if (/^en[-_]us/i.test(v.language)) score += 1;
  // Android network voices go silent offline, which is exactly when you're driving through a tunnel.
  if (id.includes('network')) score -= 2;
  return score;
}

function pickVoice(): Promise<void> {
  picking ??= Speech.getAvailableVoicesAsync()
    .then((voices) => {
      const best = voices.reduce<Speech.Voice | null>(
        (top, v) => (voiceScore(v) > (top ? voiceScore(top) : 0) ? v : top),
        null
      );
      voiceId = best?.identifier;
    })
    .catch(() => undefined);
  return picking;
}

function speak(text: string, urgent = false): void {
  if (muted || !text) return;
  // Urgent callouts cut off whatever is being said so they're heard in time.
  if (urgent) Speech.stop();
  Speech.speak(text, { language: 'en-US', voice: voiceId, rate: 0.98, pitch: 1.0 });
}

/** How a person says a distance: "400 meters", "1 kilometer", "2.5 kilometers". */
export function spokenDistance(meters: number): string {
  if (meters >= 950) {
    const km = Math.round(meters / 100) / 10;
    const text = Number.isInteger(km) ? String(km) : km.toFixed(1);
    return `${text} ${km === 1 ? 'kilometer' : 'kilometers'}`;
  }
  const rounded = meters < 100 ? Math.max(50, Math.round(meters / 10) * 10) : Math.round(meters / 50) * 50;
  return `${rounded} meters`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const voice = {
  setMuted(value: boolean): void {
    muted = value;
    if (value) Speech.stop();
  },
  isMuted(): boolean {
    return muted;
  },
  stop(): void {
    Speech.stop();
  },
  /** Called at the start of every trip; also loads the natural voice before the first prompt. */
  reset(): Promise<void> {
    Speech.stop();
    lastManeuverKey = null;
    lastCameraKey = null;
    lastCameraAt = 0;
    lastLimit = null;
    return pickVoice();
  },
  say(text: string, urgent = false): void {
    void pickVoice();
    speak(text, urgent);
  },
  /** Speaks once per key. While muted nothing is recorded, so unmuting still gets the pending instruction. */
  maneuver(text: string, key: string): void {
    if (muted || lastManeuverKey === key) return;
    lastManeuverKey = key;
    speak(text);
  },
  camera(warning: CameraWarning, speedKmh: number): void {
    const { camera } = warning;
    if (muted || camera.type === 'police') return;
    const now = Date.now();
    const key = `${camera.id}-${warning.isUrgent ? 'urgent' : 'approach'}`;
    // Same camera and stage: at most every 30 s. Any non-urgent warning: at most every 15 s.
    if (key === lastCameraKey && now - lastCameraAt < 30000) return;
    if (!warning.isUrgent && now - lastCameraAt < 15000) return;
    lastCameraKey = key;
    lastCameraAt = now;

    const what = CAMERA_PHRASE[camera.type] ?? CAMERA_PHRASE.fixed;
    const where = spokenDistance(warning.distanceMeters);
    const hasLimit = camera.speedLimit > 0;
    if (warning.isUrgent || (hasLimit && speedKmh > camera.speedLimit)) {
      const limit = hasLimit ? ` The limit is ${camera.speedLimit}.` : '';
      speak(`Slow down, there's ${/^[aeiou]/.test(what) ? 'an' : 'a'} ${what} in ${where}.${limit}`, true);
    } else {
      const limit = hasLimit ? `, the limit is ${camera.speedLimit}` : '';
      speak(`${capitalize(what)} in ${where}${limit}.`);
    }
  },
  /** The first limit of a trip is only recorded; later changes are announced once. */
  speedLimit(limit: number): void {
    if (!limit || limit === lastLimit) return;
    const first = lastLimit === null;
    lastLimit = limit;
    if (!first) speak(`The speed limit is now ${limit}.`);
  },
};
