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

function speak(text: string, urgent = false): void {
  if (muted || !text) return;
  // Urgent callouts cut off whatever is being said so they're heard in time.
  if (urgent) Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: 1.0 });
}

function spokenDistance(meters: number): string {
  return meters > 1000
    ? `${(meters / 1000).toFixed(1)} kilometers`
    : `${Math.max(50, Math.round(meters / 50) * 50)} meters`;
}

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
  reset(): void {
    Speech.stop();
    lastManeuverKey = null;
    lastCameraKey = null;
    lastCameraAt = 0;
    lastLimit = null;
  },
  say(text: string, urgent = false): void {
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
      const limit = hasLimit ? ` Speed limit is ${camera.speedLimit} kilometers per hour.` : '';
      speak(`Slow down! ${what[0].toUpperCase()}${what.slice(1)} ahead in ${where}.${limit}`, true);
    } else {
      const limit = hasLimit ? ` Maximum speed is ${camera.speedLimit}.` : '';
      speak(`Notice: ${what} ahead in ${where}.${limit}`);
    }
  },
  /** The first limit of a trip is only recorded; later changes are announced once. */
  speedLimit(limit: number): void {
    if (!limit || limit === lastLimit) return;
    const first = lastLimit === null;
    lastLimit = limit;
    if (!first) speak(`Speed limit changed. Maximum speed is now ${limit} kilometers per hour.`);
  },
};
