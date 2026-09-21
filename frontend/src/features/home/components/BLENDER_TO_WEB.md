# Blender → live 3D in the browser

Notes from an actual end-to-end test, not theory. The pipeline works;
the gotchas below are the things that cost the time.

## The pipeline

```bash
# Blender is installed but not on PATH
BL="/c/Program Files/Blender Foundation/Blender 4.3/blender.exe"

"$BL" scene.blend --background --python backend/scripts/export_glb.py -- out.glb
```

Then `MonumentGlbHero.jsx` loads it with Three.js `GLTFLoader`. A scratch
route is easy to add for evaluation; keep it unlinked and lazy so it
costs normal visitors nothing.

Measured on `asymptotes-logo/3d-v2/monument.blend`:

| | |
|---|---|
| GLB, no compression | 2.4 MB |
| GLB, Draco level 6 | **285 KB** |
| Meshes / materials | 27 / 17 |
| Triangles | ~82,000 |
| Textures exported | **0** |

285 KB is a perfectly reasonable hero payload — for comparison the
Three.js library itself is ~550 KB.

## The three things that bite

### 1. The render rig ships as visible geometry

A scene lit for offline rendering contains studio furniture: a backdrop
plane, bounce cards, area lights shaped like rectangles. Blender never
shows them because they are outside the camera frustum or configured as
render-only. Export to glTF and they come across as ordinary grey
meshes, right in the middle of the shot.

In the first test this was the single most visible problem — a large
grey wall and a white card floating in frame, dwarfing the monument.

**Fix:** move render-only objects to their own collection and exclude it
before exporting, or delete them in a copy of the scene.

### 2. Lighting is renderer output, not scene data

This is the important one. What makes the Blender render beautiful —
glossy floor reflections, neon bloom, soft falloff, colour grading — is
computed by Cycles/EEVEE and then thrown away. glTF carries geometry,
base colours, metalness, roughness and emissive strength. It has no way
to express "and then the compositor added glare".

So a faithful export can still look flat and dull in the browser, and
that is not a bug in the export.

**Two ways to close the gap, usually both:**

- **Bake in Blender.** Bake lighting and ambient occlusion into image
  textures. The browser then draws the baked result, which looks very
  close to the render. Costs texture weight — budget a few hundred KB —
  and the lighting becomes static.
- **Rebuild in Three.js.** Emissive materials plus a bloom pass is what
  makes neon read as neon; a reflective floor needs an environment map
  to reflect. `LibraryScene.jsx` already has a bloom/vignette pipeline
  worth borrowing from.

### 3. Scale and units are whatever Blender had

The monument scene exported at 400 × 70 × 400 units, because a large
ground plane dominated the bounds. Framing a camera on
`max(size.x, size.y, size.z)` put it 760 units away while the far
clipping plane was 200 — everything was clipped and the canvas rendered
black, which looks exactly like "the model failed to load".

**Fix:** set `far` generously, frame on the subject rather than the
bounding box, and log the bounding box the first time you load anything.

## Is it worth it over a still image?

A still costs 26 KB and zero GPU. Live 3D costs ~285 KB plus the
Three.js runtime plus per-frame GPU work, and only earns that if it
*does* something a still cannot — react to scroll, to the pointer, to
the theme.

Which is why the still ships to phones and reduced-motion today
(`StillHero.jsx`), and live 3D is worth pursuing for desktop where the
interaction pays for itself.
