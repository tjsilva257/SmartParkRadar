import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

interface UseShakeDetectorOptions {
  onShake: () => void;
  threshold?: number; // Acceleration delta threshold
  minInterval?: number; // Minimum ms between consecutive shake triggers
  enabled?: boolean;
}

/**
 * Custom hook to detect physical screen/device shaking via the Accelerometer.
 */
export function useShakeDetector({
  onShake,
  threshold = 2.3,
  minInterval = 1600,
  enabled = true,
}: UseShakeDetectorOptions) {
  const lastX = useRef<number | null>(null);
  const lastY = useRef<number | null>(null);
  const lastZ = useRef<number | null>(null);
  const lastShakeTimestamp = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    // Check updates every 100ms for smooth, responsive detection
    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();

      if (lastX.current !== null && lastY.current !== null && lastZ.current !== null) {
        const deltaX = Math.abs(x - lastX.current);
        const deltaY = Math.abs(y - lastY.current);
        const deltaZ = Math.abs(z - lastZ.current);
        const totalDelta = deltaX + deltaY + deltaZ;
        const totalForce = Math.sqrt(x * x + y * y + z * z);

        // Detect substantial sudden motion or spike in g-force
        if ((totalDelta > threshold || totalForce > 2.8) && now - lastShakeTimestamp.current > minInterval) {
          lastShakeTimestamp.current = now;
          onShake();
        }
      }

      lastX.current = x;
      lastY.current = y;
      lastZ.current = z;
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, onShake, threshold, minInterval]);
}

