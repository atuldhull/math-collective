/**
 * lib/ttlCache.js — a tiny in-process cache with per-entry expiry.
 *
 * Used for values that are read on almost every request but change
 * rarely, where a database round-trip per request is pure overhead:
 * an organisation's plan and feature flags, for instance, which change
 * when somebody upgrades — not sixty times a second.
 *
 * In-process on purpose, matching the rate limiter and quiz store: the
 * site runs a single Render instance. A second instance would each keep
 * their own copy, which for a TTL this short means a stale read for at
 * most `ttlMs` after a change on the other instance. If we ever scale
 * horizontally and that matters, this becomes Redis.
 */

export function createTtlCache({ ttlMs, maxEntries = 500 } = {}) {
  const entries = new Map(); // key -> { value, expiresAt }

  function get(key, now = Date.now()) {
    const hit = entries.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= now) {
      entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function set(key, value, now = Date.now()) {
    // Cheapest possible bound: drop the oldest insertion when full.
    // Map preserves insertion order, so the first key is the oldest.
    if (entries.size >= maxEntries && !entries.has(key)) {
      const oldest = entries.keys().next().value;
      entries.delete(oldest);
    }
    entries.set(key, { value, expiresAt: now + ttlMs });
    return value;
  }

  /** get-or-compute. Concurrent misses may both compute; that is fine
      here — the loader is a cheap idempotent read, and de-duping would
      cost a promise map for no real benefit at this scale. */
  async function wrap(key, loader, now = Date.now()) {
    const hit = get(key, now);
    if (hit !== undefined) return hit;
    return set(key, await loader(), now);
  }

  return { get, set, wrap, clear: () => entries.clear(), get size() { return entries.size; } };
}
