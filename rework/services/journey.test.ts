import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ParkingSpot, ParkingType, Place, RouteOption } from '../types';
import { initialJourney, JourneyAction, journeyReducer, JourneyState, viewOf } from './journey';

const place = (name: string, latitude: number): Place => ({
  id: name,
  name,
  subtitle: '',
  coordinate: { latitude, longitude: 4.9 },
});

const spot = (id: string, type: ParkingType, distanceToDestMeters: number, latitude: number): ParkingSpot => ({
  id,
  title: id,
  type,
  facility: 'street',
  pricePerHour: type === 'free' ? 0 : 3,
  priceLabel: '',
  rules: '',
  description: '',
  coordinate: { latitude, longitude: 4.9 },
  distanceToDestMeters,
  walkMinutes: 1,
  source: 'rdw',
});

const route = (id: string): RouteOption => ({
  id,
  summary: id,
  coordinates: [
    { latitude: 52.36, longitude: 4.88 },
    { latitude: 52.37, longitude: 4.9 },
  ],
  distanceMeters: 2000,
  durationSeconds: 300,
  maneuvers: [],
  isFastest: id === 'fast',
  delaySeconds: 0,
  isFallback: false,
});

const run = (actions: JourneyAction[], from: JourneyState = initialJourney()) => actions.reduce(journeyReducer, from);

const museum = place('Museum', 52.36);
const zoo = place('Zoo', 52.366);
// Paid next door, free 600 m away: max walk 500 picks the paid spot, 750 the free one.
const options = [spot('paid', 'paid', 50, 52.3601), spot('free', 'free', 600, 52.3655)];

function planned(): JourneyState {
  const s = run([{ type: 'plan', destination: museum }, { type: 'parkingLoaded', destination: museum, options }]);
  const key = viewOf(s).routesKey!;
  return run([{ type: 'routesLoaded', key, drive: [route('fast'), route('slow')], walk: null }], s);
}

test('new routes select the fastest', () => {
  const s = planned();
  assert.equal(viewOf(s).selectedRoute?.id, 'fast');
  assert.equal(viewOf(s).loading, false);
});

test('parking for a destination the user left behind is dropped', () => {
  const s = run([
    { type: 'plan', destination: museum },
    { type: 'plan', destination: zoo },
    { type: 'parkingLoaded', destination: museum, options },
  ]);
  assert.equal(s.options, null);
  assert.equal(viewOf(s).loading, true);
});

test('a parking result after GO never swaps the spot under the running trip', () => {
  const s = run([{ type: 'go', id: 'slow' }, { type: 'parkingLoaded', destination: museum, options: [] }], planned());
  assert.equal(s.phase, 'navigating');
  assert.equal(viewOf(s).parking?.id, 'paid');
  assert.equal(viewOf(s).selectedRoute?.id, 'slow');
});

test('a walk change that picks another spot clears its routes while the new ones load', () => {
  const before = planned();
  const oldKey = viewOf(before).routesKey!;
  const s = run([{ type: 'setMaxWalk', meters: 750 }], before);
  assert.equal(viewOf(s).parking?.id, 'free');
  assert.deepEqual(viewOf(s).drive, []);
  assert.equal(viewOf(s).loading, true);

  // The old spot's routes arriving late don't land on the new spot.
  const late = run([{ type: 'routesLoaded', key: oldKey, drive: [route('fast')], walk: null }], s);
  assert.equal(late.routes, null);
});

test('a walk change that keeps the same spot keeps its routes', () => {
  const s = run([{ type: 'setMaxWalk', meters: 250 }], planned());
  assert.equal(viewOf(s).parking?.id, 'paid');
  assert.equal(viewOf(s).drive.length, 2);
});

test('while navigating, route picks and walk changes are ignored', () => {
  const going = run([{ type: 'go', id: 'fast' }], planned());
  assert.equal(run([{ type: 'selectRoute', id: 'slow' }, { type: 'setMaxWalk', meters: 750 }], going), going);
});

test('GO needs a route of the current plan', () => {
  assert.equal(run([{ type: 'go', id: 'nope' }], planned()).phase, 'planning');
  assert.equal(run([{ type: 'plan', destination: museum }, { type: 'go', id: 'fast' }]).phase, 'planning');
});

test('ending a trip goes back to idle and keeps the max walk', () => {
  const going = run([{ type: 'setMaxWalk', meters: 250 }, { type: 'go', id: 'fast' }], planned());
  assert.equal(going.phase, 'navigating');
  assert.deepEqual(run([{ type: 'end' }], going), initialJourney(250));
});
