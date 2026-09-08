import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { addExploredCoordinate } from './scratchMapService';

export const SCRATCH_MAP_BACKGROUND_TASK = 'SCRATCH_MAP_BACKGROUND_TASK';

// Define the global background location task at module scope
try {
  TaskManager.defineTask(SCRATCH_MAP_BACKGROUND_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('ScratchMap background task error:', error);
      return;
    }
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      if (locations && locations.length > 0) {
        const latest = locations[locations.length - 1];
        if (latest && latest.coords) {
          await addExploredCoordinate(latest.coords.latitude, latest.coords.longitude);
        }
      }
    }
  });
} catch (e) {
  // Guard in case task was already defined
}

/**
 * Requests necessary location permissions and starts background tracking.
 */
export async function startScratchMapTracking(): Promise<boolean> {
  try {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== Location.PermissionStatus.GRANTED) return false;

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== Location.PermissionStatus.GRANTED) return false;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(SCRATCH_MAP_BACKGROUND_TASK);
    if (!isRegistered) {
      await Location.startLocationUpdatesAsync(SCRATCH_MAP_BACKGROUND_TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 50, // Trigger update every 50m to preserve battery
        deferredUpdatesInterval: 15000, // Batch updates every 15s
        pausesUpdatesAutomatically: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
        foregroundService: {
          notificationTitle: 'Scratch Map Active',
          notificationBody: 'Scratching off explored areas as you travel...',
          notificationColor: '#38bdf8',
        },
      });
    }
    return true;
  } catch (err) {
    console.warn('Could not start background scratch map tracking:', err);
    return false;
  }
}

/**
 * Stops background scratch map tracking.
 */
export async function stopScratchMapTracking(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(SCRATCH_MAP_BACKGROUND_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(SCRATCH_MAP_BACKGROUND_TASK);
    }
  } catch (err) {
    console.warn('Could not stop background scratch map tracking:', err);
  }
}

export async function isScratchMapTrackingActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(SCRATCH_MAP_BACKGROUND_TASK);
  } catch {
    return false;
  }
}

