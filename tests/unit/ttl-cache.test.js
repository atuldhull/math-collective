/**
 * The small TTL cache behind the feature-flag lookup.
 *
 * checkFeatureFlag ran two queries — the organisation and its plan — on
 * every feature-gated request, for values that change when somebody
 * upgrades rather than sixty times a second.
 */

import { describe, it, expect, vi } from "vitest";
import { createTtlCache } from "../../backend/lib/ttlCache.js";

describe("createTtlCache", () => {
  it("returns a cached value without calling the loader again", async () => {
    const cache  = createTtlCache({ ttlMs: 1000 });
    const loader = vi.fn().mockResolvedValue({ plan: "pro" });

    expect(await cache.wrap("org-A", loader)).toEqual({ plan: "pro" });
    expect(await cache.wrap("org-A", loader)).toEqual({ plan: "pro" });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("keys entries separately", async () => {
    const cache = createTtlCache({ ttlMs: 1000 });
    await cache.wrap("org-A", async () => "a");
    await cache.wrap("org-B", async () => "b");
    expect(cache.get("org-A")).toBe("a");
    expect(cache.get("org-B")).toBe("b");
  });

  it("reloads once the entry has expired", async () => {
    const cache  = createTtlCache({ ttlMs: 1000 });
    const loader = vi.fn().mockResolvedValue("v");
    const t0 = 1_000_000;

    await cache.wrap("k", loader, t0);
    await cache.wrap("k", loader, t0 + 999);
    expect(loader).toHaveBeenCalledTimes(1);

    await cache.wrap("k", loader, t0 + 1001);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("treats an expired entry as absent", () => {
    const cache = createTtlCache({ ttlMs: 100 });
    cache.set("k", "v", 1000);
    expect(cache.get("k", 1050)).toBe("v");
    expect(cache.get("k", 1200)).toBeUndefined();
  });

  it("lets a caller drop everything after a plan change", async () => {
    const cache  = createTtlCache({ ttlMs: 10_000 });
    const loader = vi.fn().mockResolvedValue("old");
    await cache.wrap("k", loader);
    cache.clear();
    await cache.wrap("k", loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("stays bounded, dropping the oldest entry when full", () => {
    const cache = createTtlCache({ ttlMs: 10_000, maxEntries: 3 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4);
    expect(cache.size).toBe(3);
    expect(cache.get("a")).toBeUndefined();  // oldest, evicted
    expect(cache.get("d")).toBe(4);
  });

  it("does not evict when overwriting an existing key at capacity", () => {
    const cache = createTtlCache({ ttlMs: 10_000, maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 99);
    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBe(99);
    expect(cache.get("b")).toBe(2);
  });
});
