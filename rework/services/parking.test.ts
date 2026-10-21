import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ParkingSpot, ParkingType } from '../types';
import { chooseParking, loadParkingOptions } from './parking';

function spot(id: string, type: ParkingType, distanceToDestMeters: number, pricePerHour = 0): ParkingSpot {
  return {
    id,
    title: id,
    type,
    facility: 'street',
    pricePerHour,
    priceLabel: '',
    rules: '',
    description: '',
    coordinate: { latitude: 52.37, longitude: 4.89 },
    distanceToDestMeters,
    walkMinutes: 1,
    source: 'rdw',
  };
}

test('free parking within the walk beats a closer paid spot', () => {
  const scan = chooseParking([spot('paid', 'paid', 50, 3), spot('free', 'free', 400)], 500);
  assert.equal(scan.best?.id, 'free');
  assert.equal(scan.freeHint, null);
});

test('nothing within the walk still gives a spot', () => {
  assert.equal(chooseParking([spot('far', 'paid', 900, 2)], 250).best?.id, 'far');
});

test('free parking beyond the walk: hint with the walk option that reaches it', () => {
  const scan = chooseParking([spot('paid', 'paid', 100, 2), spot('free', 'free', 600)], 500);
  assert.equal(scan.best?.id, 'paid');
  assert.equal(scan.freeHint?.spot.id, 'free');
  assert.equal(scan.freeHint?.walkMeters, 750);
});

test('free parking beyond every walk option: hint, but no farther walk to offer', () => {
  const scan = chooseParking([spot('paid', 'paid', 100, 2), spot('free', 'free', 1500)], 1200);
  assert.equal(scan.freeHint?.spot.id, 'free');
  assert.equal(scan.freeHint?.walkMeters, null);
});

test('no hint when the chosen spot is already free or a blue zone', () => {
  assert.equal(chooseParking([spot('blue', 'blue', 100), spot('free', 'free', 900)], 500).freeHint, null);
});

const okBody = {
  response: { docs: [{ gemeentecode: '0363' }] }, // PDOK: Amsterdam
  code: 'Ok', // OSRM nearest
  waypoints: [{ location: [4.8926, 52.3731], name: 'Damrak' }],
  elements: [], // Overpass
};

test('the place card and Directions share one lookup for the same destination', async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify(String(url).includes('opendata.rdw.nl') ? [] : okBody));
  });
  const dest = { latitude: 52.3731, longitude: 4.8926 };
  const from = { latitude: 52.36, longitude: 4.88 };

  const card = await loadParkingOptions(dest, from);
  const fetched = calls.length;
  const directions = await loadParkingOptions(dest, from);

  assert.ok(fetched > 0);
  assert.equal(calls.length, fetched, 'no second round of requests');
  assert.equal(directions, card);
});

test('a lookup that could not reach the parking registry is retried next time', async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    calls.push(String(url));
    return String(url).includes('api.pdok.nl')
      ? new Response('unavailable', { status: 503 })
      : new Response(JSON.stringify(okBody));
  });
  const dest = { latitude: 52.0907, longitude: 5.1214 };
  const from = { latitude: 52.08, longitude: 5.11 };

  await loadParkingOptions(dest, from);
  const fetched = calls.length;
  await loadParkingOptions(dest, from);

  assert.ok(calls.length > fetched);
});
