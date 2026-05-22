export function randomId(prefix) {
  const seed = globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${seed}`;
}

export function getBrowserStorage(kind) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function readJson(storage, key, fallback) {
  if (!storage) {
    return fallback;
  }

  try {
    const value = storage.getItem(key);

    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(storage, key, value) {
  if (!storage) {
    return value;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    return value;
  }

  return value;
}
