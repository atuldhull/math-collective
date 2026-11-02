import { createContext, useContext, useEffect, useRef, useState } from "react";
import { defaultThemeId, hasChosenTheme, markThemeChosen } from "@/components/lamp/season";
import "./themes.css";

export const PUBLIC_THEMES = [
  { id: "obsidian", name: "Obsidian", note: "Graphite / silver / violet", hue: 255 },
  { id: "arctic", name: "Arctic", note: "Ivory / ink / ice blue", hue: 214 },
  { id: "emerald", name: "Emerald Matrix", note: "Forest / mint / acid lime", hue: 151 },
  { id: "nebula", name: "Nebula", note: "Indigo / magenta / cyan", hue: 289 },
  { id: "haunted", name: "Haunted", note: "Midnight / pumpkin / slime", hue: 24 },
];
const ThemeContext = createContext(null);
const KEY = "mc-public-theme";
// A theme the visitor picked always wins; until they pick one, the
// season decides (orange Haunted during Halloween).
function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (hasChosenTheme() && PUBLIC_THEMES.some((item) => item.id === saved)) return saved;
  } catch {
    /* fall through to the default */
  }
  return defaultThemeId();
}
export function PublicThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* Private browsing still supports in-memory selection. */
    }
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme: (next) => { markThemeChosen(); setTheme(next); } }}>
      <div className="mc-public-theme" data-public-theme={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
export function usePublicTheme() {
  return useContext(ThemeContext);
}

export function PublicThemeSelector() {
  const { theme, setTheme } = usePublicTheme();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const active = PUBLIC_THEMES.find((item) => item.id === theme);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="mc-theme-control"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="mc-theme-trigger"
        aria-label={`Appearance: ${active.name}`}
        aria-expanded={open}
        aria-controls="mc-theme-options"
        onClick={() => setOpen(!open)}
      >
        <span className="mc-theme-orb" aria-hidden="true" />
        <span className="mc-theme-label">{active.name}</span>
        <span className="mc-theme-chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <fieldset id="mc-theme-options" className="mc-theme-options">
          <legend>Choose your atmosphere</legend>
          {PUBLIC_THEMES.map((item) => (
            <label key={item.id} data-swatch={item.id} className={theme === item.id ? "is-selected" : ""}>
              <input
                type="radio"
                name="public-theme"
                value={item.id}
                checked={theme === item.id}
                onChange={() => setTheme(item.id)}
              />
              <span className="mc-theme-swatch" aria-hidden="true" />
              <span>
                {item.name}
                <small>{item.note}</small>
              </span>
              <span className="mc-theme-check" aria-hidden="true">
                {theme === item.id ? "✓" : ""}
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
