import React, { useMemo } from 'react';
import { Polygon, LatLng } from 'react-native-maps';
import { ExploredGeometry, convertGeoJsonToHoles } from '../services/scratchMapService';

interface ScratchMapOverlayProps {
  exploredGeometry: ExploredGeometry;
  fogColor?: string;
}

// Giant boundary polygon wrapping the navigable globe
const WORLD_MASK: LatLng[] = [
  { latitude: 84.9, longitude: -179.99 },
  { latitude: 84.9, longitude: 0 },
  { latitude: 84.9, longitude: 179.99 },
  { latitude: -84.9, longitude: 179.99 },
  { latitude: -84.9, longitude: 0 },
  { latitude: -84.9, longitude: -179.99 },
  { latitude: 84.9, longitude: -179.99 },
];

export const ScratchMapOverlay: React.FC<ScratchMapOverlayProps> = React.memo(
  ({ exploredGeometry, fogColor = 'rgba(15, 23, 42, 0.84)' }) => {
    // Memoize the holes calculation so map re-renders remain fast at 60 FPS
    const holes = useMemo(() => {
      return convertGeoJsonToHoles(exploredGeometry);
    }, [exploredGeometry]);

    return (
      <Polygon
        coordinates={WORLD_MASK}
        holes={holes}
        fillColor={fogColor}
        strokeColor="rgba(0, 0, 0, 0)"
        strokeWidth={0}
        zIndex={12} // Placed directly above base map tiles, but beneath vehicle puck & markers
      />
    );
  }
);

