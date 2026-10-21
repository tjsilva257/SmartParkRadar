// Simulated turn-by-turn trip: drive the selected route to the parking, then walk to the destination.
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Coordinate,
  Maneuver,
  ParkingSpot,
  Place,
  RouteOption,
  SpeedAlert,
  SpeedCamera,
  TravelPhase,
  TripState,
} from '../types';
import { cumulativeDistances, pointAlong } from '../lib/geo';
import { speedAlert, upcomingCamera } from '../services/cameras';
import { spokenDistance, voice } from '../services/voice';

const TICK_MS = 1000;
// ponytail: 10x time-lapse so a demo trip finishes in minutes; set to 1 (or feed GPS) for real driving.
const TIME_LAPSE = 10;
const MIN_STEP_METERS = 12;
const WALK_KMH = 5;
const WALK_MPS = 80 / 60;
const DEFAULT_LIMIT = 50;
const FALLBACK_MPS = 30 / 3.6;
const CAMERA_RADIUS = 1500;
const SPEED_TEST_OFFSETS = [6, 18, 32]; // index -1 = auto
const ANNOUNCE_AHEAD_METERS = 500;
const ANNOUNCE_NOW_METERS = 60;
const THEN_WITHIN_METERS = 400;

type Phase = TravelPhase | 'arrived';

interface Options {
  walkPath: Coordinate[];
  parking: ParkingSpot | null;
  destination: Place | null;
  cameras: SpeedCamera[];
  onPhaseChange?: (phase: Phase) => void;
}

interface Line {
  path: Coordinate[];
  cum: number[];
  total: number;
}

interface Sim {
  route: RouteOption;
  drive: Line;
  walk: Line; // re-read from props when the walk starts (the walk route may arrive late)
  phase: Phase;
  traveled: number; // meters within the current phase
  speed: number; // km/h of the last snapshot; drives the next step
}

const isCoord = (c: Coordinate | undefined): c is Coordinate => !!c;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const stepMeters = (kmh: number) => Math.max(MIN_STEP_METERS, (kmh / 3.6) * TIME_LAPSE);
const destinationName = (o: Options) => o.destination?.name ?? 'your destination';
const parkingName = (o: Options) => o.parking?.title ?? 'the parking';
const noAlert = (speed: number): SpeedAlert => ({ speed, limit: 0, overBy: 0, fineEur: 0, level: 'ok' });

function line(path: Coordinate[]): Line {
  const cum = cumulativeDistances(path);
  return { path, cum, total: cum[cum.length - 1] ?? 0 };
}

function walkLine(o: Options, parkedAt: Coordinate): Line {
  if (o.walkPath.length >= 2) return line(o.walkPath);
  return line([o.parking?.coordinate ?? parkedAt, o.destination?.coordinate].filter(isCoord));
}

const lastPoint = (l: Line) => l.path[l.path.length - 1];

function drivingState(sim: Sim, o: Options, speedTest: number): TripState {
  const { route, drive, traveled } = sim;
  const at = pointAlong(drive.path, drive.cum, traveled);
  const maneuvers = route.maneuvers;

  let stretchLimit = DEFAULT_LIMIT;
  for (const m of maneuvers) if (m.atMeters <= traveled && m.speedLimit > 0) stretchLimit = m.speedLimit;

  const i = maneuvers.findIndex((m) => m.atMeters > traveled);
  const next: Maneuver =
    i >= 0
      ? maneuvers[i]
      : {
          kind: 'arrive',
          instruction: `Arrive at ${parkingName(o)}`,
          street: o.parking?.title ?? '',
          atMeters: drive.total,
          lengthMeters: 0,
          speedLimit: stretchLimit,
        };
  const after = i >= 0 ? maneuvers[i + 1] : undefined;
  const then = after && after.atMeters - next.atMeters <= THEN_WITHIN_METERS ? after : null;

  const warning = upcomingCamera(at.coordinate, o.cameras, CAMERA_RADIUS, at.heading);
  // The road's limit, not the camera's: a radar hit can sit on a parallel road.
  const limit = stretchLimit;
  const offset = SPEED_TEST_OFFSETS[speedTest];
  // Briefly "speed" on the camera approach so the fine alert gets demonstrated.
  const demoSpeeding = !!warning && warning.distanceMeters >= 180 && warning.distanceMeters <= 550;
  const speed = offset !== undefined ? limit + offset : demoSpeeding ? limit + 18 : limit - 3;

  const remaining = Math.max(0, drive.total - traveled);
  const avgMps =
    route.distanceMeters > 0 && route.durationSeconds > 0 ? route.distanceMeters / route.durationSeconds : FALLBACK_MPS;

  return {
    phase: 'driving',
    position: at.coordinate,
    heading: at.heading,
    traveledMeters: Math.min(traveled, drive.total),
    remainingMeters: remaining,
    remainingSeconds: remaining / avgMps + walkLine(o, lastPoint(drive)).total / WALK_MPS,
    nextManeuver: next,
    thenManeuver: then,
    distanceToManeuver: Math.max(0, next.atMeters - traveled),
    speed,
    speedLimit: limit,
    cameraWarning: warning,
    alert: speedAlert(speed, limit),
  };
}

function onFootState(sim: Sim, o: Options): TripState {
  const { walk } = sim;
  const arrived = sim.phase === 'arrived';
  const traveled = arrived ? walk.total : Math.min(sim.traveled, walk.total);
  const at = pointAlong(walk.path, walk.cum, traveled);
  const remaining = walk.total - traveled;
  const name = destinationName(o);
  const speed = arrived ? 0 : WALK_KMH;
  return {
    phase: sim.phase,
    position: at.coordinate,
    heading: at.heading,
    traveledMeters: traveled,
    remainingMeters: remaining,
    remainingSeconds: remaining / WALK_MPS,
    nextManeuver: {
      kind: arrived ? 'arrive' : 'walk',
      instruction: arrived ? `Arrived at ${name}` : `Walk to ${name}`,
      street: name,
      atMeters: walk.total,
      lengthMeters: remaining,
      speedLimit: 0,
    },
    thenManeuver: null,
    distanceToManeuver: remaining,
    speed,
    speedLimit: 0,
    cameraWarning: null,
    alert: noAlert(speed),
  };
}

function announceDriving(t: TripState): void {
  voice.speedLimit(t.speedLimit);
  if (t.cameraWarning) voice.camera(t.cameraWarning, t.speed);

  const m = t.nextManeuver;
  const d = t.distanceToManeuver;
  const key = `${m.kind}@${Math.round(m.atMeters)}`;
  const step = stepMeters(t.speed);
  // Time-lapse steps can exceed 60 m, so "now" also means "the next tick passes it",
  // and the "ahead" window is at least one step wide so it can't be skipped.
  const nowWithin = Math.max(ANNOUNCE_NOW_METERS, step);
  if (d <= nowWithin) {
    // A maneuver that the next tick also passes would never be spoken, so it is added here.
    const n = t.thenManeuver;
    const then = n && n.kind !== 'arrive' && d + n.atMeters - m.atMeters <= step ? `, then ${lowerFirst(n.instruction)}` : '';
    // Reaching the parking gets its own announcement.
    if (m.kind !== 'arrive') voice.maneuver(`${m.instruction}${then}`, `${key}:now`);
  } else if (d <= Math.max(ANNOUNCE_AHEAD_METERS, nowWithin + step)) {
    voice.maneuver(`In ${spokenDistance(d)}, ${lowerFirst(m.instruction)}`, `${key}:ahead`);
  }
}

export function useTripSimulation(opts: Options): {
  trip: TripState | null;
  start: (route: RouteOption) => void;
  stop: () => void;
  cycleSpeedTest: () => void;
} {
  const [trip, setTrip] = useState<TripState | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const simRef = useRef<Sim | null>(null);
  const speedTestRef = useRef(-1);

  const halt = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => halt, [halt]);

  const publish = useCallback((announce: boolean) => {
    const sim = simRef.current;
    if (!sim) return;
    const o = optsRef.current;
    const t = sim.phase === 'driving' ? drivingState(sim, o, speedTestRef.current) : onFootState(sim, o);
    sim.speed = t.speed;
    if (announce && t.phase === 'driving') announceDriving(t);
    setTrip(t);
  }, []);

  const start = useCallback((route: RouteOption) => {
    if (timer.current) return;
    const o = optsRef.current;
    const drivePoints =
      route.coordinates.length > 0 ? route.coordinates : [o.parking?.coordinate ?? o.destination?.coordinate].filter(isCoord);
    if (drivePoints.length === 0) return;

    const drive = line(drivePoints);
    // Step distances don't add up to the drawn path (the fallback route's 1.3x estimate, OSRM rounding):
    // scale them so "Arrive" and every turn sit where the car actually gets there.
    const end = route.maneuvers[route.maneuvers.length - 1]?.atMeters ?? 0;
    const k = end > 0 ? drive.total / end : 1;
    const maneuvers = route.maneuvers.map((m) => ({ ...m, atMeters: m.atMeters * k }));
    simRef.current = { route: { ...route, maneuvers }, drive, walk: walkLine(o, lastPoint(drive)), phase: 'driving', traveled: 0, speed: 0 };
    speedTestRef.current = -1;
    const first = route.maneuvers[0];
    const sim = simRef.current;
    // Wait for the natural voice to load so the first prompt isn't in the robotic default one.
    voice.reset().then(() => {
      if (simRef.current === sim && first?.kind === 'depart') voice.maneuver(first.instruction, 'depart');
    });
    publish(true);
    o.onPhaseChange?.('driving');

    timer.current = setInterval(() => {
      const sim = simRef.current;
      if (!sim || sim.phase === 'arrived') return;
      const now = optsRef.current;
      sim.traveled += stepMeters(sim.speed);

      let changed: Phase | null = null;
      if (sim.phase === 'driving' && sim.traveled >= sim.drive.total) {
        sim.walk = walkLine(now, lastPoint(sim.drive));
        sim.phase = 'walking';
        sim.traveled = 0;
        changed = 'walking';
        voice.say(
          `You've reached ${parkingName(now)}. From here it's ${spokenDistance(sim.walk.total)} on foot to ${destinationName(now)}.`
        );
      } else if (sim.phase === 'walking' && sim.traveled >= sim.walk.total) {
        sim.phase = 'arrived';
        sim.traveled = sim.walk.total;
        changed = 'arrived';
        halt();
        voice.say(`You've arrived at ${destinationName(now)}.`);
      }

      publish(changed === null);
      if (changed) now.onPhaseChange?.(changed);
    }, TICK_MS);
  }, [halt, publish]);

  const stop = useCallback(() => {
    halt();
    simRef.current = null;
    voice.reset();
    setTrip(null);
  }, [halt]);

  const cycleSpeedTest = useCallback(() => {
    const i = speedTestRef.current;
    speedTestRef.current = i >= SPEED_TEST_OFFSETS.length - 1 ? -1 : i + 1;
    publish(false);
  }, [publish]);

  return { trip, start, stop, cycleSpeedTest };
}
