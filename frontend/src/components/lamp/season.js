/**
 * Seasons — the member app changes a little every month.
 *
 * Each month can name a season pack. A pack re-tints the palette
 * (lamplight.css, html[data-season]), swaps the route transitions
 * (hauntedEffects.js), adds an ambient layer (SeasonAmbience.jsx) and
 * changes how page titles arrive (PageHeader). Months without a pack
 * use the normal member theme.
 *
 * Members can switch seasonal effects off; the choice is remembered.
 */
import { create } from "zustand";

// Month index (0 = January) → season pack. Add packs here as they ship.
const BY_MONTH = {
  9: "haunted",  // October
  10: "haunted", // November: Halloween runs on into the new month
};

export const SEASON_NAMES = { haunted: "Halloween" };

export function seasonFor(date = new Date()) {
  return BY_MONTH[date.getMonth()] || null;
}

const KEY = "mc-season-off";

function initialOff() {
  try { return window.localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export const useSeason = create((set, get) => ({
  current: typeof window === "undefined" ? null : seasonFor(),
  off: typeof window === "undefined" ? false : initialOff(),
  toggle: () => {
    const off = !get().off;
    try { window.localStorage.setItem(KEY, off ? "1" : "0"); } catch { /* in-memory only */ }
    set({ off });
  },
}));

/** The active season pack, or null when none applies or it's switched off. */
export function useActiveSeason() {
  return useSeason((s) => (s.off ? null : s.current));
}

/* ── Theme default ────────────────────────────────────────────────
   Shared by the public site and the member app (same storage key).
   Until someone picks a theme themselves, the season's theme is the
   default; an explicit pick is remembered and always wins. */
const CHOSEN = "mc-theme-chosen";
const SEASON_THEME = { haunted: "haunted" };

export function hasChosenTheme() {
  try { return window.localStorage.getItem(CHOSEN) === "1"; } catch { return false; }
}

export function markThemeChosen() {
  try { window.localStorage.setItem(CHOSEN, "1"); } catch { /* in-memory only */ }
}

export function defaultThemeId() {
  return SEASON_THEME[seasonFor()] || "obsidian";
}
