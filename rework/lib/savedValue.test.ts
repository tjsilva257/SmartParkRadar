import assert from 'node:assert/strict';
import { test } from 'node:test';
import { savedValue } from './savedValue';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    data,
    failReads: false,
    writes: 0,
    async getItem(key: string) {
      if (storage.failReads) throw new Error('unreadable');
      return data.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      storage.writes++;
      data.set(key, value);
    },
    async removeItem(key: string) {
      storage.writes++;
      data.delete(key);
    },
  };
  return storage;
}

const list = (raw: unknown): string[] => (Array.isArray(raw) ? raw : []);

test('reads what is stored, or what parse makes of nothing', async () => {
  assert.deepEqual(await savedValue(memoryStorage({ k: '["a"]' }), 'k', list).read(), ['a']);
  assert.deepEqual(await savedValue(memoryStorage(), 'k', list).read(), []);
});

test('corrupt JSON counts as nothing stored and can be overwritten', async () => {
  const storage = memoryStorage({ k: '{oops' });
  const value = savedValue(storage, 'k', list);
  assert.deepEqual(await value.read(), []);
  await value.update((l) => [...l, 'a']);
  assert.equal(storage.data.get('k'), '["a"]');
});

test('a failed read never writes over the stored value; the next update applies on top of it', async () => {
  const storage = memoryStorage({ k: '["a","b"]' });
  storage.failReads = true;
  const value = savedValue(storage, 'k', list);

  assert.deepEqual(await value.read(), []);
  assert.deepEqual(await value.update((l) => [...l, 'c']), ['c'], 'kept in memory for this session');
  assert.equal(storage.data.get('k'), '["a","b"]');
  assert.equal(storage.writes, 0);

  storage.failReads = false;
  assert.deepEqual(await value.update((l) => [...l, 'd']), ['a', 'b', 'd']);
  assert.equal(storage.data.get('k'), '["a","b","d"]');
});

test('rapid updates all land (two quick favorite taps)', async () => {
  const storage = memoryStorage();
  const value = savedValue(storage, 'k', list);
  await Promise.all([value.update((l) => [...l, 'a']), value.update((l) => [...l, 'b'])]);
  assert.equal(storage.data.get('k'), '["a","b"]');
});

test('an unchanged value is not rewritten; null removes the key', async () => {
  const storage = memoryStorage({ k: '"x"' });
  const value = savedValue<string | null>(storage, 'k', (raw) => (typeof raw === 'string' ? raw : null));
  await value.update((x) => x);
  assert.equal(storage.writes, 0);
  await value.update(() => null);
  assert.equal(storage.data.has('k'), false);
});
