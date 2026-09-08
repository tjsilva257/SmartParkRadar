import * as Speech from 'expo-speech';
import { TurnManeuver, CameraWarning } from '../types/parking';

class VoiceGuidanceService {
  private lastSpokenManeuverKey: string | null = null;
  private lastSpokenCameraKey: string | null = null;
  private lastSpokenSpeedLimit: number | null = null;
  private lastCameraWarningTime: number = 0;

  /**
   * Stops any currently active speech immediately.
   */
  public stop(): void {
    Speech.stop();
  }

  /**
   * Resets all navigation speech tracking state.
   */
  public reset(): void {
    this.stop();
    this.lastSpokenManeuverKey = null;
    this.lastSpokenCameraKey = null;
    this.lastSpokenSpeedLimit = null;
    this.lastCameraWarningTime = 0;
  }

  /**
   * Internal helper to speak text with optional interruption.
   */
  private speakText(text: string, isUrgent: boolean = false): void {
    if (isUrgent) {
      this.stop();
    }
    Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 1.02,
    });
  }

  /**
   * Announces an upcoming turn or maneuver if it hasn't been announced yet.
   */
  public speakTurnManeuver(maneuver: TurnManeuver, isMuted: boolean): void {
    if (isMuted || !maneuver) return;

    const maneuverKey = `${maneuver.instruction}-${maneuver.distanceText}`;
    if (this.lastSpokenManeuverKey === maneuverKey) return;
    this.lastSpokenManeuverKey = maneuverKey;

    let phrase = '';
    const lowerInstruction = maneuver.instruction.toLowerCase();

    if (lowerInstruction.includes('arrive')) {
      phrase = 'You have arrived at your parking space.';
    } else if (maneuver.distanceText && !lowerInstruction.startsWith('head') && !lowerInstruction.startsWith('follow')) {
      phrase = `In ${maneuver.distanceText}, ${maneuver.instruction}.`;
    } else {
      phrase = `${maneuver.instruction}.`;
    }

    this.speakText(phrase, false);
  }

  /**
   * Announces an approaching speed camera with a clear "Slow down" callout.
   */
  public speakCameraWarning(
    warning: CameraWarning | null,
    currentSpeed: number,
    isMuted: boolean
  ): void {
    if (isMuted || !warning) return;

    const now = Date.now();
    const camera = warning.camera;
    const isSpeeding = currentSpeed > camera.speedLimit;
    const cameraKey = `${camera.id}-${warning.isUrgent ? 'urgent' : 'approach'}`;

    // Throttle duplicate warnings for the same camera unless switching to urgent
    if (this.lastSpokenCameraKey === cameraKey && now - this.lastCameraWarningTime < 30000) {
      return;
    }

    // Do not re-warn if general warning was given in the last 15 seconds
    if (now - this.lastCameraWarningTime < 15000 && !warning.isUrgent) {
      return;
    }

    this.lastSpokenCameraKey = cameraKey;
    this.lastCameraWarningTime = now;

    // Friendly camera description
    const cameraTypeDesc =
      camera.type === 'traject'
        ? 'average speed check zone'
        : camera.type === 'mobile'
        ? 'mobile speed trap'
        : camera.type === 'red_light'
        ? 'red light and speed camera'
        : 'speed camera';

    // Round distance for natural speech
    const roundedDist =
      warning.distanceMeters > 1000
        ? `${(warning.distanceMeters / 1000).toFixed(1)} kilometers`
        : `${Math.round(warning.distanceMeters / 50) * 50} meters`;

    let phrase = '';
    if (isSpeeding || warning.isUrgent) {
      phrase = `Slow down! ${cameraTypeDesc} ahead in ${roundedDist}. Speed limit is ${camera.speedLimit} kilometers per hour.`;
      this.speakText(phrase, true);
    } else {
      phrase = `Notice: ${cameraTypeDesc} ahead in ${roundedDist}. Maximum speed is ${camera.speedLimit}.`;
      this.speakText(phrase, false);
    }
  }

  /**
   * Announces when the road or zone speed limit changes.
   */
  public speakSpeedLimitChange(newLimit: number, isMuted: boolean): void {
    if (isMuted || !newLimit) return;

    // Don't repeat identical speed limit
    if (this.lastSpokenSpeedLimit === newLimit) return;

    // If this is the initial assignment, record it without barking if desired, or announce
    const isFirstRun = this.lastSpokenSpeedLimit === null;
    this.lastSpokenSpeedLimit = newLimit;

    if (isFirstRun) {
      return;
    }

    const phrase = `Speed limit changed. Maximum speed is now ${newLimit} kilometers per hour.`;
    this.speakText(phrase, false);
  }
}

export const voiceGuidance = new VoiceGuidanceService();

