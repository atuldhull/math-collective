/**
 * Member theme — the same four themes the public site offers, carried
 * into the app after sign-in. Shares the visitor's storage key, so the
 * theme someone picked on the public pages is still theirs once they
 * are a member. SkinProvider mirrors it onto <html data-member-theme>.
 */
import { create } from "zustand";
import { defaultThemeId, hasChosenTheme, markThemeChosen } from "./season";

export const MEMBER_THEMES = [
  { id: "obsidian", name: "Obsidian", swatch: ["#101114", "#b6a0ff", "#8bd7ed"] },
  { id: "arctic", name: "Arctic", swatch: ["#f7f8f5", "#245fb5", "#2f718d"] },
  { id: "emerald", name: "Emerald Matrix", swatch: ["#071713", "#a6ed75", "#66e0b5"] },
  { id: "nebula", name: "Nebula", swatch: ["#151022", "#efa1e8", "#7edde7"] },
  { id: "haunted", name: "Haunted", swatch: ["#09060a", "#ff7a1a", "#84eb62"] },
];

const KEY = "mc-public-theme";

// A theme the person picked always wins; until they pick one, the season
// decides (orange Haunted during Halloween).
function initial() {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (hasChosenTheme() && MEMBER_THEMES.some((t) => t.id === saved)) return saved;
  } catch { /* fall through to the default */ }
  return defaultThemeId();
}

export const useMemberTheme = create((set, get) => ({
  theme: typeof window === "undefined" ? "obsidian" : initial(),
  setTheme: (theme) => {
    try { window.localStorage.setItem(KEY, theme); } catch { /* in-memory only */ }
    markThemeChosen();
    set({ theme });
  },
  cycle: () => {
    const i = MEMBER_THEMES.findIndex((t) => t.id === get().theme);
    get().setTheme(MEMBER_THEMES[(i + 1) % MEMBER_THEMES.length].id);
  },
}));
