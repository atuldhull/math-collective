/**
 * Whether the desktop rail is folded into its icon strip. Remembered per
 * browser and mirrored onto <html style="--rail-w"> so anything that has
 * to clear the rail (content padding, the floating chat button) follows.
 */
import { create } from "zustand";

const KEY = "mc-rail-collapsed";
export const RAIL_OPEN = 256;
export const RAIL_FOLDED = 80;

function initial() {
  try { return window.localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export const useRail = create((set, get) => ({
  collapsed: typeof window === "undefined" ? false : initial(),
  toggle: () => {
    const collapsed = !get().collapsed;
    try { window.localStorage.setItem(KEY, collapsed ? "1" : "0"); } catch { /* in-memory only */ }
    set({ collapsed });
  },
}));
