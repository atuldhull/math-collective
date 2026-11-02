/**
 * SkinProvider — decides which visual skin the current screen wears.
 *
 *   public     signed-out visitors. They get the public tree from
 *              features/guest, which brings its own themes; the shared
 *              tokens are left alone for it.
 *   legacy     a signed-in member on "/", which still renders the
 *              original cathedral-library home.
 *   lamplight  every other member screen: the redesigned app.
 *
 * Mirrored onto <html data-skin> so lamplight.css can re-point the
 * shared tokens, and exposed through useSkin() so shared primitives
 * (Button, Card, backgrounds) can branch their markup. "Member" follows
 * the same rule as SessionPresentation: a user object in the auth store.
 */
import { createContext, useContext, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import { useMemberTheme } from "./memberTheme";
import { useActiveSeason } from "./season";

const SkinContext = createContext("lamplight");

export function skinForPath(pathname, member) {
  if (!member) return "public";
  return pathname === "/" || pathname === "" ? "legacy" : "lamplight";
}

export function useSkin() {
  return useContext(SkinContext);
}

export function useIsLamplight() {
  return useContext(SkinContext) === "lamplight";
}

export default function SkinProvider({ children }) {
  const { pathname } = useLocation();
  const member = useAuthStore((s) => Boolean(s.user));
  const skin = skinForPath(pathname, member);
  const theme = useMemberTheme((s) => s.theme);
  const season = useActiveSeason();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.skin = skin;
    if (skin === "lamplight") root.dataset.memberTheme = theme;
    else delete root.dataset.memberTheme;
    if (skin === "lamplight" && season) root.dataset.season = season;
    else delete root.dataset.season;
  }, [skin, theme, season]);

  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}
