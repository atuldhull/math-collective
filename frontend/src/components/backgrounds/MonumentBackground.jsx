/**
 * MonumentBackground — Theme-aware animated backgrounds for each monument.
 *
 * Each scene is split into its own sub-component under ./monument/ for
 * maintainability. This file provides the switch logic and shared setup.
 */

import { ensureKeyframes } from "./monument/keyframes";
import DesertBg from "./monument/DesertBg";
import PyramidBg from "./monument/PyramidBg";
import GlacierBg from "./monument/GlacierBg";
import JungleBg from "./monument/JungleBg";
import CityBg from "./monument/CityBg";
import AbyssBg from "./monument/AbyssBg";
import SkyBg from "./monument/SkyBg";
import MagmaBg from "./monument/MagmaBg";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

const monumentMap = {
  desert: DesertBg,
  pyramid: PyramidBg,
  glacier: GlacierBg,
  jungle: JungleBg,
  city: CityBg,
  abyss: AbyssBg,
  sky: SkyBg,
  magma: MagmaBg,
};

function MonumentBackgroundScene({ monument, intensity = 0.15 }) {
  ensureKeyframes();

  const Scene = monumentMap[monument];
  if (!Scene) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: intensity, pointerEvents: "none", overflow: "hidden" }}>
        <Scene />
      </div>
    </div>
  );
}

// Off the home page the Lamplight shell paints one shared backdrop
// (LampBackdrop), so the per-page scenes step aside there.
export default function MonumentBackground(props) {
  return useIsLamplight() ? null : <MonumentBackgroundScene {...props} />;
}
