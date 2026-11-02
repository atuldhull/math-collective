/**
 * useHaunted — is the Halloween treatment on for what's on screen?
 *
 *   members   while the haunted season is active (unless they switched
 *             seasonal effects off), or when they picked the Haunted theme
 *   visitors  on every public page except the home page while the season
 *             is active, and everywhere, home included, once the visitor
 *             picks the Haunted theme from the colour menu
 *
 * Colours are a separate matter: in the public tree the season adds
 * spooky motion only; the page keeps whichever theme is selected.
 */
import { useLocation } from "react-router-dom";
import { usePublicTheme } from "@/features/guest/PublicTheme";
import { useSkin } from "./SkinProvider";
import { useMemberTheme } from "./memberTheme";
import { useActiveSeason } from "./season";

export default function useHaunted() {
  const season = useActiveSeason();
  const skin = useSkin();
  const { pathname } = useLocation();
  const publicTheme = usePublicTheme()?.theme;
  const memberTheme = useMemberTheme((s) => s.theme);

  if (skin === "lamplight") return season === "haunted" || memberTheme === "haunted";
  if (skin === "public") return publicTheme === "haunted" || (season === "haunted" && pathname !== "/");
  return false;
}
