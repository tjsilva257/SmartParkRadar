// Runs a journey (services/journey.ts): looks up parking and routes for the planned destination,
// and on GO hands the chosen route straight to the trip simulation.
import { useEffect, useMemo, useReducer, useRef } from 'react';
import type { Coordinate, Place, SpeedCamera, TravelPhase } from '../types';
import { initialJourney, journeyReducer, viewOf } from '../services/journey';
import { loadParkingOptions } from '../services/parking';
import { fetchDriveRoutes, fetchWalkRoute } from '../services/routing';
import { useTripSimulation } from './useTripSimulation';

const NO_PATH: Coordinate[] = [];

export function useJourney({
  origin,
  cameras,
  onPhaseChange,
}: {
  /** Where the car leaves from, read when a lookup starts. */
  origin: () => Coordinate;
  cameras: SpeedCamera[];
  onPhaseChange?: (phase: TravelPhase | 'arrived') => void;
}) {
  const [state, dispatch] = useReducer(journeyReducer, undefined, () => initialJourney());
  const view = useMemo(() => viewOf(state), [state]);
  const originRef = useRef(origin);
  originRef.current = origin;

  const planning = state.phase === 'planning';
  const plannedDestination = planning ? state.destination : null;
  const plannedRoutesKey = planning ? view.routesKey : null;

  // Results are dispatched unconditionally: the reducer drops any that no longer apply.
  useEffect(() => {
    const destination = plannedDestination;
    if (!destination) return;
    loadParkingOptions(destination.coordinate, originRef.current())
      .then((options) => dispatch({ type: 'parkingLoaded', destination, options }))
      .catch(() => dispatch({ type: 'parkingLoaded', destination, options: [] }));
  }, [plannedDestination]);

  useEffect(() => {
    const key = plannedRoutesKey;
    const parking = view.parking;
    const destination = state.destination;
    if (!key || !parking || !destination) return;
    Promise.all([
      fetchDriveRoutes(originRef.current(), parking.coordinate),
      fetchWalkRoute(parking.coordinate, destination.coordinate),
    ])
      .then(([drive, walk]) => dispatch({ type: 'routesLoaded', key, drive, walk }))
      .catch(() => dispatch({ type: 'routesLoaded', key, drive: [], walk: null }));
  }, [plannedRoutesKey]);

  const sim = useTripSimulation({
    walkPath: view.walk?.coordinates ?? NO_PATH,
    parking: view.parking,
    destination: state.destination,
    cameras,
    onPhaseChange,
  });

  return {
    phase: state.phase,
    destination: state.destination,
    maxWalk: state.maxWalk,
    parking: view.parking,
    freeHint: view.scan?.freeHint ?? null,
    routes: view.drive,
    selectedRoute: view.selectedRoute,
    walk: view.walk,
    loading: view.loading,
    trip: sim.trip,
    cycleSpeedTest: sim.cycleSpeedTest,
    plan: (destination: Place) => dispatch({ type: 'plan', destination }),
    selectRoute: (id: string) => dispatch({ type: 'selectRoute', id }),
    setMaxWalk: (meters: number) => dispatch({ type: 'setMaxWalk', meters }),
    go: (id: string) => {
      const route = planning ? view.drive.find((r) => r.id === id) : undefined;
      if (!route) return;
      dispatch({ type: 'go', id });
      sim.start(route);
    },
    end: () => {
      if (state.phase === 'navigating') sim.stop();
      dispatch({ type: 'end' });
    },
  };
}
