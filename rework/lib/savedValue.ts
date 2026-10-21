// One persisted value: read once, never written over when it couldn't be read, updates one at a time.
// Storage is a parameter so the rules can be tested on an in-memory stand-in (store.ts binds AsyncStorage).

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SavedValue<T> {
  /** The stored value, or what `parse` makes of nothing stored. While storage is unreadable: this session's value. */
  read(): Promise<T>;
  /**
   * Applies `fn` to the current value and saves the result, one update at a time. While storage is
   * unreadable the result stays in memory only; the next update retries the read and applies on top of
   * what's stored. Returning the current value unchanged skips the write; null removes the key.
   */
  update(fn: (current: T) => T): Promise<T>;
}

/** `parse` gets the stored JSON, or undefined when nothing (or nothing readable as JSON) is stored. */
export function savedValue<T>(storage: KeyValueStorage, key: string, parse: (raw: unknown) => T): SavedValue<T> {
  let current = parse(undefined);
  let loaded = false;
  let queue: Promise<unknown> = Promise.resolve();

  const serial = <R>(fn: () => Promise<R>): Promise<R> => {
    const run = queue.then(fn);
    queue = run.catch(() => undefined);
    return run;
  };

  async function ensureLoaded(): Promise<void> {
    if (loaded) return;
    let raw: string | null;
    try {
      raw = await storage.getItem(key);
    } catch {
      return; // unreadable right now: keep the in-memory value and write nothing
    }
    current = parse(decode(raw));
    loaded = true;
  }

  return {
    read: () =>
      serial(async () => {
        await ensureLoaded();
        return current;
      }),
    update: (fn) =>
      serial(async () => {
        await ensureLoaded();
        const next = fn(current);
        if (next === current) return current;
        current = next;
        if (loaded) await write(storage, key, next);
        return next;
      }),
  };
}

function decode(raw: string | null): unknown {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function write(storage: KeyValueStorage, key: string, value: unknown): Promise<void> {
  try {
    if (value == null) await storage.removeItem(key);
    else await storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the in-memory value still works for this session.
  }
}
